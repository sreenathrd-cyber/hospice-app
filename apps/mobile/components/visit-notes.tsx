import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { VisitListItem, VisitNote, VisitNoteSections } from "@repo/types";
import { useTheme } from "../lib/theme";
import { createVisitNote, listVisitNotes, updateVisitNote } from "../lib/notes";

const SECTION_FIELDS: { key: keyof VisitNoteSections; label: string; placeholder: string }[] = [
  { key: "visitSummary", label: "Visit summary", placeholder: "What was this visit about?" },
  { key: "observations", label: "Observations", placeholder: "What did you observe?" },
  { key: "interventions", label: "Interventions", placeholder: "What did you do?" },
  { key: "plan", label: "Plan", placeholder: "What's the plan?" },
  { key: "followUp", label: "Follow-up", placeholder: "Any follow-up needed?" },
];

/**
 * Visit notes on the team visit detail. Draft → approve → file.
 * The transcript box is the transcription input until a speech-to-text
 * provider is configured — the workflow doesn't change when one is.
 */
export function VisitNotes({ visit }: { visit: VisitListItem }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const notesQuery = useQuery({
    queryKey: ["visit-notes", visit.id],
    queryFn: async (): Promise<VisitNote[]> => {
      const result = await listVisitNotes(visit.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await createVisitNote(visit.id, {
        transcript: transcript.trim() ? transcript.trim() : undefined,
      });
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => {
      setTranscript("");
      setComposing(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["visit-notes", visit.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Visit notes</Text>

      {(notesQuery.data ?? []).map((note) => (
        <NoteCard key={note.id} note={note} visitId={visit.id} />
      ))}
      {notesQuery.data?.length === 0 && !composing && (
        <Text style={styles.muted}>No notes yet. Draft one after the visit.</Text>
      )}

      {!composing ? (
        <Pressable
          style={[styles.secondary, { borderColor: theme.primaryColor }]}
          onPress={() => setComposing(true)}
        >
          <Text style={[styles.secondaryText, { color: theme.primaryColor }]}>New draft note</Text>
        </Pressable>
      ) : (
        <View>
          <Text style={styles.label}>Transcript (optional)</Text>
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={4}
            placeholder="Paste or type the visit transcript…"
            value={transcript}
            onChangeText={setTranscript}
          />
          <Pressable
            style={[styles.primary, { backgroundColor: theme.primaryColor, opacity: createMutation.isPending ? 0.5 : 1 }]}
            onPress={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Text style={styles.primaryText}>{createMutation.isPending ? "Saving…" : "Save draft"}</Text>
          </Pressable>
          <Pressable onPress={() => setComposing(false)}>
            <Text style={[styles.cancel, { color: theme.primaryColor }]}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function NoteCard({ note, visitId }: { note: VisitNote; visitId: string }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<VisitNoteSections>(note.sections);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (body: { sections?: VisitNoteSections; status?: VisitNote["status"] }) => {
      const result = await updateVisitNote(note.id, body);
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => {
      setEditing(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["visit-notes", visitId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const isDraft = note.status === "draft";

  return (
    <View style={styles.note}>
      <View style={styles.noteHead}>
        <Text style={styles.status}>{note.status.toUpperCase()}</Text>
        <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
      </View>

      {note.transcript && <Text style={styles.transcript}>"{note.transcript}"</Text>}

      {editing ? (
        <View>
          {SECTION_FIELDS.map((f) => (
            <View key={f.key}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                multiline
                placeholder={f.placeholder}
                value={sections[f.key] ?? ""}
                onChangeText={(t) => setSections((s) => ({ ...s, [f.key]: t || undefined }))}
              />
            </View>
          ))}
          <Pressable
            style={[styles.primary, { backgroundColor: theme.primaryColor }]}
            onPress={() => mutation.mutate({ sections })}
            disabled={mutation.isPending}
          >
            <Text style={styles.primaryText}>Save changes</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          {SECTION_FIELDS.map(
            (f) =>
              note.sections[f.key] && (
                <View key={f.key} style={styles.section}>
                  <Text style={styles.sectionLabel}>{f.label}</Text>
                  <Text style={styles.sectionText}>{note.sections[f.key]}</Text>
                </View>
              ),
          )}
          {Object.values(note.sections).every((v) => !v) && (
            <Text style={styles.muted}>No structured sections yet.</Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        {isDraft && !editing && (
          <Pressable onPress={() => setEditing(true)}>
            <Text style={[styles.action, { color: theme.primaryColor }]}>Structure</Text>
          </Pressable>
        )}
        {isDraft && (
          <Pressable onPress={() => mutation.mutate({ status: "approved" })} disabled={mutation.isPending}>
            <Text style={[styles.action, { color: theme.primaryColor }]}>Approve</Text>
          </Pressable>
        )}
        {note.status === "approved" && (
          <Pressable onPress={() => mutation.mutate({ status: "filed" })} disabled={mutation.isPending}>
            <Text style={[styles.action, { color: theme.primaryColor }]}>File to chart</Text>
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginTop: 16 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  muted: { fontSize: 14, color: "#5B625E", lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#D8DCD9",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    minHeight: 44,
    textAlignVertical: "top",
    backgroundColor: "#fff",
  },
  primary: { borderRadius: 22, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondary: { borderWidth: 1.5, borderRadius: 22, paddingVertical: 11, alignItems: "center", marginTop: 12 },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  cancel: { textAlign: "center", marginTop: 10, fontSize: 14, fontWeight: "600" },
  error: { color: "#B3261E", fontSize: 14, marginTop: 8 },
  note: { borderWidth: 1, borderColor: "#E4E7E4", borderRadius: 10, padding: 12, marginBottom: 10 },
  noteHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  status: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  noteDate: { fontSize: 12, color: "#8A918D" },
  transcript: { fontSize: 13, fontStyle: "italic", color: "#5B625E", marginBottom: 8, lineHeight: 18 },
  section: { marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#5B625E" },
  sectionText: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 16, marginTop: 8 },
  action: { fontSize: 14, fontWeight: "700" },
});
