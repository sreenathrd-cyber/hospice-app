import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PatientDirectoryEntry, QuestionnaireKind, ScheduleFrequency, ScheduleListItem } from "@repo/types";
import { useTheme } from "../../lib/theme";
import { createSchedule, listSchedules, updateSchedule } from "../../lib/questionnaires";
import { patientDirectory } from "../../lib/visits";

const KINDS: { kind: QuestionnaireKind; label: string }[] = [
  { kind: "esas", label: "ESAS" },
  { kind: "pps", label: "PPS" },
  { kind: "phq2_gad2", label: "PHQ-2 / GAD-2" },
  { kind: "bowel_bladder", label: "Bowel / bladder" },
  { kind: "caregiver_wellbeing", label: "Caregiver wellbeing" },
];

const FREQUENCIES: { frequency: ScheduleFrequency; label: string }[] = [
  { frequency: "daily", label: "Every morning" },
  { frequency: "weekly", label: "Every week" },
];

/**
 * Recurring questionnaire schedules. The team picks a patient, a
 * questionnaire and a rhythm — the server generates pending assignments on
 * schedule. Pause/resume without deleting.
 */
export default function TeamSchedules() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState<PatientDirectoryEntry["id"] | null>(null);
  const [kind, setKind] = useState<QuestionnaireKind>("esas");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [error, setError] = useState<string | null>(null);

  const dirQuery = useQuery({
    queryKey: ["patient-directory"],
    queryFn: async (): Promise<PatientDirectoryEntry[]> => {
      const result = await patientDirectory();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const listQuery = useQuery({
    queryKey: ["questionnaire-schedules"],
    queryFn: async (): Promise<ScheduleListItem[]> => {
      const result = await listSchedules();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (patientId === null) throw new Error("Pick a patient first.");
      const result = await createSchedule({ patientId, kind, frequency });
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["questionnaire-schedules"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: ScheduleListItem) => {
      const result = await updateSchedule(item.id, !item.active);
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["questionnaire-schedules"] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>Questionnaire schedules</Text>
      <Text style={styles.sub}>Set a rhythm once — new questionnaires appear for the family automatically.</Text>

      <Text style={styles.label}>Patient</Text>
      <View style={styles.chips}>
        {(dirQuery.data ?? []).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPatientId(p.id)}
            style={[styles.chip, patientId === p.id && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.chipText, patientId === p.id && styles.chipTextSelected]}>{p.displayName}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Questionnaire</Text>
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <Pressable
            key={k.kind}
            onPress={() => setKind(k.kind)}
            style={[styles.chip, kind === k.kind && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.chipText, kind === k.kind && styles.chipTextSelected]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>How often</Text>
      <View style={styles.chips}>
        {FREQUENCIES.map((f) => (
          <Pressable
            key={f.frequency}
            onPress={() => setFrequency(f.frequency)}
            style={[styles.chip, frequency === f.frequency && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.chipText, frequency === f.frequency && styles.chipTextSelected]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.primary, { backgroundColor: theme.primaryColor, opacity: createMutation.isPending ? 0.5 : 1 }]}
        onPress={() => createMutation.mutate()}
        disabled={createMutation.isPending}
      >
        <Text style={styles.primaryText}>{createMutation.isPending ? "Saving…" : "Start schedule"}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={[styles.label, styles.listLabel]}>Active schedules</Text>
      {listQuery.isPending ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (listQuery.data ?? []).length === 0 ? (
        <Text style={styles.muted}>No schedules yet.</Text>
      ) : (
        (listQuery.data ?? []).map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {kindLabel(item.kind)} · {item.frequency === "daily" ? "daily" : "weekly"}
              </Text>
              <Text style={styles.rowSub}>
                {item.patientName} · {item.active ? "running" : "paused"} · next {formatDate(item.nextDueAt)}
              </Text>
            </View>
            <Pressable onPress={() => toggleMutation.mutate(item)} disabled={toggleMutation.isPending}>
              <Text style={[styles.toggle, { color: theme.primaryColor }]}>
                {item.active ? "Pause" : "Resume"}
              </Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function kindLabel(kind: QuestionnaireKind): string {
  return KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 14, color: "#5B625E", marginTop: 4, marginBottom: 4 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 14, marginBottom: 8 },
  listLabel: { marginTop: 24 },
  muted: { fontSize: 15, color: "#5B625E" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#D8DCD9", backgroundColor: "#fff" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#1A1D1B" },
  chipTextSelected: { color: "#fff" },
  primary: { borderRadius: 22, paddingVertical: 13, alignItems: "center", marginTop: 20 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  error: { color: "#B3261E", fontSize: 14, marginTop: 8 },
  row: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowText: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 13, color: "#5B625E", marginTop: 2 },
  toggle: { fontSize: 14, fontWeight: "700" },
});
