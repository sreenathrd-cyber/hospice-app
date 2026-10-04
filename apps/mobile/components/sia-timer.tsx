import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import type { SiaClinicianRole, VisitListItem } from "@repo/types";
import { useTheme } from "../lib/theme";
import { createSiaEntry } from "../lib/sia";

/**
 * Visit timer for in-person SIA capture. Start on arrival, stop on departure;
 * the elapsed minutes are logged as an RN/MSW timed entry. The timer is
 * session-local — if the app is killed mid-visit the time is lost, which the
 * UI states plainly.
 *
 * useEffect ledger: one effect runs the 1s display tick while the timer is
 * running. It does no data fetching, no prop sync, no derived state.
 */
export function SiaTimer({ visit }: { visit: VisitListItem }) {
  const theme = useTheme();
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [role, setRole] = useState<SiaClinicianRole>("rn");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const elapsedMin = startedAt === null ? 0 : Math.max(1, Math.round((now - startedAt) / 60000));

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await createSiaEntry({
        visitId: visit.id,
        clinicianRole: role,
        minutes: elapsedMin,
        occurredAt: new Date().toISOString(),
      });
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => {
      setSaved(true);
      setRunning(false);
      setStartedAt(null);
      setError(null);
    },
    onError: () => setError("Couldn't save the timed entry. Your minutes are still on screen — try again."),
  });

  function start() {
    setSaved(false);
    setError(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>SIA visit timer</Text>
      <Text style={styles.muted}>In-person RN/MSW time converts to 15-minute billing units.</Text>

      {!running && startedAt === null && !saved && (
        <Pressable
          style={[styles.primary, { backgroundColor: theme.primaryColor }]}
          onPress={start}
          accessibilityLabel="Start visit timer"
        >
          <Text style={styles.primaryText}>Start timer on arrival</Text>
        </Pressable>
      )}

      {(running || startedAt !== null) && !saved && (
        <View>
          <Text style={styles.elapsed}>{formatElapsed(startedAt === null ? 0 : now - startedAt)}</Text>
          <View style={styles.roleRow}>
            {(["rn", "msw"] as SiaClinicianRole[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={[styles.roleChip, role === r && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }]}
              >
                <Text style={[styles.roleText, role === r && styles.roleTextSelected]}>
                  {r === "rn" ? "RN" : "MSW"}
                </Text>
              </Pressable>
            ))}
          </View>
          {running ? (
            <Pressable style={styles.stop} onPress={stop} accessibilityLabel="Stop visit timer">
              <Text style={styles.stopText}>Stop on departure</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primary, { backgroundColor: theme.primaryColor, opacity: mutation.isPending ? 0.5 : 1 }]}
              onPress={() => mutation.mutate()}
              disabled={mutation.isPending}
              accessibilityLabel={`Save ${elapsedMin} minutes`}
            >
              <Text style={styles.primaryText}>
                {mutation.isPending ? "Saving…" : `Save ${elapsedMin} min as ${role.toUpperCase()}`}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {saved && <Text style={styles.saved}>✓ Saved. The minutes are now in this patient's SIA summary.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.fine}>Keep the app open during the visit — the timer doesn't survive an app restart.</Text>
    </View>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginTop: 16 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  muted: { fontSize: 13, color: "#5B625E", marginBottom: 12, lineHeight: 18 },
  primary: { borderRadius: 22, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  elapsed: { fontSize: 40, fontWeight: "700", textAlign: "center", marginVertical: 8, fontVariant: ["tabular-nums"] },
  roleRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 12 },
  roleChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#D8DCD9", backgroundColor: "#fff" },
  roleText: { fontSize: 14, fontWeight: "700", color: "#1A1D1B" },
  roleTextSelected: { color: "#fff" },
  stop: { borderRadius: 22, paddingVertical: 13, alignItems: "center", backgroundColor: "#B3261E", marginTop: 4 },
  stopText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  saved: { fontSize: 14, color: "#1F6F5B", fontWeight: "600", marginTop: 8, lineHeight: 20 },
  error: { color: "#B3261E", fontSize: 14, marginTop: 8, lineHeight: 20 },
  fine: { fontSize: 12, color: "#8A918D", marginTop: 10, lineHeight: 16 },
});
