"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Phase =
  | { kind: "missing" }
  | { kind: "joining" }
  | { kind: "live" }
  | { kind: "ended" }
  | { kind: "error"; message: string };

/**
 * Video visit room. The mobile app opens this page in a WebView with a
 * short-lived, room-scoped Telnyx client token in the URL — the token IS the
 * credential, so this page needs no login. No PHI is rendered here.
 */
export default function VisitJoinPage() {
  return (
    <Suspense fallback={<Centered title="Loading…" body="" />}>
      <VisitJoin />
    </Suspense>
  );
}

function VisitJoin() {
  const params = useSearchParams();
  const roomId = params.get("roomId");
  const token = params.get("token");

  const [phase, setPhase] = useState<Phase>(roomId && token ? { kind: "joining" } : { kind: "missing" });
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<{ disconnect: () => Promise<void> } | null>(null);
  const remoteIdsRef = useRef<Set<string>>(new Set());
  const tracksRef = useRef<{ audio?: MediaStreamTrack; video?: MediaStreamTrack }>({});

  const leave = useCallback(async () => {
    try {
      await roomRef.current?.disconnect();
    } finally {
      tracksRef.current.audio?.stop();
      tracksRef.current.video?.stop();
      setPhase({ kind: "ended" });
    }
  }, []);

  useEffect(() => {
    if (!roomId || !token) return;
    let cancelled = false;

    async function join() {
      try {
        const { initialize } = await import("@telnyx/video");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        if (audioTrack) tracksRef.current.audio = audioTrack;
        if (videoTrack) tracksRef.current.video = videoTrack;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const room = await initialize({ roomId: roomId as string, clientToken: token as string });
        if (cancelled) {
          await room.disconnect();
          return;
        }
        roomRef.current = room;

        room.on("participant_joined", (participantId) => {
          remoteIdsRef.current.add(participantId);
        });
        room.on("stream_published", async (participantId, key) => {
          remoteIdsRef.current.add(participantId);
          await room.addSubscription(participantId, key, { audio: true, video: true });
          renderRemote(room);
        });
        room.on("stream_unpublished", () => renderRemote(room));
        room.on("participant_left", (participantId) => {
          remoteIdsRef.current.delete(participantId);
          renderRemote(room);
        });
        room.on("disconnected", () => {
          if (!cancelled) setPhase({ kind: "ended" });
        });

        await room.connect();
        await room.addStream(
          "self",
          Object.fromEntries(
            [
              ["audio", audioTrack],
              ["video", videoTrack],
            ].filter(([, t]) => t !== undefined),
          ) as { audio?: MediaStreamTrack; video?: MediaStreamTrack },
        );
        renderRemote(room);
        if (!cancelled) setPhase({ kind: "live" });
      } catch (error) {
        if (!cancelled) {
          setPhase({
            kind: "error",
            message:
              error instanceof DOMException && error.name === "NotAllowedError"
                ? "Camera and microphone access was denied. Allow access and try again."
                : "Couldn't join the video visit. Check your connection and try again.",
          });
        }
      }
    }

    function renderRemote(room: {
      getParticipantStreams: (id: string) => Map<string, { videoTrack?: MediaStreamTrack; audioTrack?: MediaStreamTrack }>;
    }) {
      // Render the first remote video track found, if any.
      for (const id of remoteIdsRef.current) {
        for (const s of room.getParticipantStreams(id).values()) {
          if (s.videoTrack && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream([s.videoTrack]);
            return;
          }
        }
      }
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    }

    void join();
    return () => {
      cancelled = true;
      void roomRef.current?.disconnect();
      tracksRef.current.audio?.stop();
      tracksRef.current.video?.stop();
    };
  }, [roomId, token]);

  function toggleMute() {
    const track = tracksRef.current.audio;
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  function toggleCamera() {
    const track = tracksRef.current.video;
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  }

  return (
    <main style={styles.page}>
      {phase.kind === "missing" && (
        <Centered title="Invalid visit link" body="This video link is missing its credentials. Ask your care team for a fresh link." />
      )}
      {phase.kind === "joining" && <Centered title="Joining your visit…" body="Getting your camera ready." />}
      {phase.kind === "error" && (
        <Centered title="Couldn't join" body={phase.message} action={{ label: "Try again", onClick: () => window.location.reload() }} />
      )}
      {phase.kind === "ended" && (
        <Centered title="Visit ended" body="Thanks for joining. You can close this window." />
      )}
      {phase.kind === "live" && (
        <div style={styles.live}>
          <video ref={remoteVideoRef} autoPlay playsInline style={styles.remote} />
          <video ref={localVideoRef} autoPlay playsInline muted style={styles.local} />
          <div style={styles.controls}>
            <ControlButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute} active={!muted} />
            <ControlButton label={cameraOff ? "Camera on" : "Camera off"} onClick={toggleCamera} active={!cameraOff} />
            <ControlButton label="Leave" onClick={() => void leave()} danger />
          </div>
        </div>
      )}
      {/* Local preview also needs mounting during joining so getUserMedia has a target */}
      {phase.kind === "joining" && <video ref={localVideoRef} autoPlay playsInline muted style={{ display: "none" }} />}
    </main>
  );
}

function Centered({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={styles.centered}>
      <h1 style={styles.title}>{title}</h1>
      <p style={styles.body}>{body}</p>
      {action && (
        <button onClick={action.onClick} style={styles.retry}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  active,
  danger,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.control,
        background: danger ? "#B3261E" : active === false ? "#5B625E" : "#1A1D1B",
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#101413", color: "#fff", display: "flex", flexDirection: "column" },
  centered: { margin: "auto", textAlign: "center", padding: 24, maxWidth: 420 },
  title: { fontSize: 22, marginBottom: 8 },
  body: { fontSize: 15, color: "#B9C0BC", lineHeight: 1.5 },
  retry: { marginTop: 16, padding: "12px 24px", borderRadius: 24, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  live: { position: "relative", flex: 1, minHeight: "100dvh" },
  remote: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#1A1D1B" },
  local: { position: "absolute", right: 16, top: 16, width: 120, height: 160, objectFit: "cover", borderRadius: 12, background: "#2A2E2C" },
  controls: { position: "absolute", bottom: 32, left: 0, right: 0, display: "flex", gap: 12, justifyContent: "center" },
  control: { padding: "12px 20px", borderRadius: 24, border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};
