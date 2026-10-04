import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { IdgSections, IdgSession } from "@repo/types";
import { useTheme } from "../../lib/theme";
import {
  completeIdgSession,
  createIdgSession,
  listIdgSessions,
  recordIdgConsent,
  startIdgRecording,
} from "../../lib/idg";

const SECTION_FIELDS: { key: keyof IdgSections; label: string }[] = [
  { key: "patientsDiscussed", label: "Patients discussed" },
  { key: "keyDecisions", label: "Key decisions" },
  { key: "carePlanUpdates", label: "Care plan updates" },
  { key: "followUpActions", label: "Follow-up actions" },
];

/**
 * IDG sessions. Schedule with attendees → record each person's consent →
 * start recording only when everyone has consented → close with a
 * structured note.
 */
export default function TeamIdg() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [scheduling, setScheduling] = useState(false);
  const [attendeeText, setAttendeeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["idg-sessions"],
    queryFn: async (): Promise<IdgSession[]> => {
      const result = await listIdgSessions();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["idg-sessions"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const attendees = attendeeText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, role] = line.split(",").map((p) => p.trim());
          if (!name) throw new Error("Each line needs a name, e.g. \"Jane Doe, RN\".");
          return { name, role: role || "Team member" };
        });
      if (attendees.length === 0) throw new Error("Add at least one attendee.");
      const result = await createIdgSession({
        scheduledAt: new Date().toISOString(),
        attendees,
      });
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => {
      setScheduling(false);
      setAttendeeText("");
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const sessions = listQuery.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>IDG sessions</Text>
      <Text style={styles.sub}>Recording starts only after every attendee consents.</Text>

      {!scheduling ? (
        <Pressable
          style={[styles.primary, { backgroundColor: theme.primaryColor }]}
          onPress={() => setScheduling(true)}
        >
          <Text style={styles.primaryText}>Schedule IDG session</Text>
        </Pressable>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Attendees — one per line, "Name, Role"</Text>
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={4}
            placeholder={"Jane Doe, RN\nJohn Smith, MSW"}
            value={attendeeText}
            onChangeText={setAttendeeText}
          />
          <Pressable
            style={[styles.primary, { backgroundColor: theme.primaryColor, opacity: createMutation.isPending ? 0.5 : 1 }]}
            onPress={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Text style={styles.primaryText}>{createMutation.isPending ? "Saving…" : "Schedule now"}</Text>
          </Pressable>
          <Pressable onPress={() => setScheduling(false)}>
            <Text style={[styles.cancel, { color: theme.primaryColor }]}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={[styles.label, styles.listLabel]}>Sessions</Text>
      {listQuery.isPending ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.muted}>No IDG sessions yet.</Text>
      ) : (
        sessions.map((s) => (
          <View key={s.id}>
            <Pressable style={styles.row} onPress={() => setOpenId(openId === s.id ? null : s.id)}>
              <View>
                <Text style={styles.rowTitle}>{formatDate(s.scheduledAt)}</Text>
                <Text style={styles.rowSub}>
                  {s.attendees.length} attendees · {s.status.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: theme.primaryColor }]}>
                {openId === s.id ? "▾" : "▸"}
              </Text>
            </Pressable>
            {openId === s.id && <SessionDetail session={s} onChanged={invalidate} />}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function SessionDetail({ session, onChanged }: { session: IdgSession; onChanged: () => void }) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sections, setSections] = useState<IdgSections>({});

  const mutate = useMutation({
    mutationFn: async (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
      const result = await fn();
      if (!result.ok) throw new Error(result.error?.message ?? "Something went wrong.");
    },
    onSuccess: () => {
      setError(null);
      setClosing(false);
      onChanged();
    },
    onError: (e: Error) => setError(e.message),
  });

  const consented = session.attendees.filter((a) => a.consentedAt !== null).length;

  return (
    <View style={styles.detail}>
      <Text style={styles.label}>Consent — {consented}/{session.attendees.length}</Text>
      {session.attendees.map((a) => (
        <View key={a.name} style={styles.attendeeRow}>
          <View style={styles.attendeeText}>
            <Text style={styles.attendeeName}>{a.name}</Text>
            <Text style={styles.attendeeRole}>{a.role}</Text>
          </View>
          {a.consentedAt ? (
            <Text style={styles.consented}>✓ consented</Text>
          ) : session.status === "scheduled" ? (
            <Pressable
              onPress={() => mutate.mutate(() => recordIdgConsent(session.id, { attendeeName: a.name }))}
              disabled={mutate.isPending}
            >
              <Text style={[styles.action, { color: theme.primaryColor }]}>Record consent</Text>
            </Pressable>
          ) : (
            <Text style={styles.muted}>—</Text>
          )}
        </View>
      ))}

      {session.status === "scheduled" && (
        <Pressable
          style={[styles.primary, { backgroundColor: theme.primaryColor, opacity: mutate.isPending ? 0.5 : 1 }]}
          onPress={() => mutate.mutate(() => startIdgRecording(session.id))}
          disabled={mutate.isPending}
        >
          <Text style={styles.primaryText}>Start recording</Text>
        </Pressable>
      )}

      {session.status === "recording" && !closing && (
        <Pressable
          style={[styles.primary, { backgroundColor: theme.primaryColor }]}
          onPress={() => setClosing(true)}
        >
          <Text style={styles.primaryText}>Close session</Text>
        </Pressable>
      )}

      {session.status === "recording" && closing && (
        <View>
          <Text style={styles.label}>Transcript (optional)</Text>
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={3}
            placeholder="Paste the session transcript…"
            value={transcript}
            onChangeText={setTranscript}
          />
          {SECTION_FIELDS.map((f) => (
            <View key={f.key}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                multiline
                value={sections[f.key] ?? ""}
                onChangeText={(t) => setSections((s) => ({ ...s, [f.key]: t || undefined }))}
              />
            </View>
          ))}
          <Pressable
            style={[styles.primary, { backgroundColor: theme.primaryColor, opacity: mutate.isPending ? 0.5 : 1 }]}
            onPress={() =>
              mutate.mutate(() =>
                completeIdgSession(session.id, {
                  transcript: transcript.trim() || undefined,
                  sections: Object.keys(sections).length > 0 ? sections : undefined,
                }),
              )
            }
            disabled={mutate.isPending}
          >
            <Text style={styles.primaryText}>Complete session</Text>
          </Pressable>
        </View>
      )}

      {session.status === "completed" && (
        <View>
          {SECTION_FIELDS.map(
            (f) =>
              session.sections[f.key] && (
                <View key={f.key} style={styles.section}>
                  <Text style={styles.sectionLabel}>{f.label}</Text>
                  <Text style={styles.sectionText}>{session.sections[f.key]}</Text>
                </View>
              ),
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 14, color: "#5B625E", marginTop: 4, marginBottom: 4 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 12, marginBottom: 8 },
  listLabel: { marginTop: 20 },
  muted: { fontSize: 14, color: "#5B625E" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: "#D8DCD9", borderRadius: 10, padding: 10,
    fontSize: 14, minHeight: 44, textAlignVertical: "top", backgroundColor: "#fff",
  },
  primary: { borderRadius: 22, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cancel: { textAlign: "center", marginTop: 10, fontSize: 14, fontWeight: "600" },
  error: { color: "#B3261E", fontSize: 14, marginTop: 8 },
  row: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 13, color: "#5B625E", marginTop: 2 },
  chevron: { fontSize: 18, fontWeight: "700" },
  detail: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginTop: -4, marginBottom: 8 },
  attendeeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#EEF0EE" },
  attendeeText: { flex: 1 },
  attendeeName: { fontSize: 14, fontWeight: "600" },
  attendeeRole: { fontSize: 12, color: "#8A918D" },
  consented: { fontSize: 13, color: "#1F6F5B", fontWeight: "700" },
  action: { fontSize: 14, fontWeight: "700" },
  section: { marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#5B625E" },
  sectionText: { fontSize: 14, lineHeight: 20 },
});
