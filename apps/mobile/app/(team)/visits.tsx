import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PatientDirectoryEntry, VisitListItem, VisitType } from "@repo/types";
import { useTheme } from "../../lib/theme";
import { listVisits, patientDirectory, scheduleVisit } from "../../lib/visits";
import { formatWhen, visitTypeLabel } from "../(patient)/visits";

const VISIT_TYPES: VisitType[] = ["video", "phone", "in_person"];
const TIME_SLOTS = [8, 9, 10, 11, 13, 14, 15, 16, 17];

/** Team schedule: today's and upcoming visits, plus scheduling. */
export default function TeamVisits() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [scheduling, setScheduling] = useState(false);

  const visitsQuery = useQuery({
    queryKey: ["visits"],
    queryFn: async (): Promise<VisitListItem[]> => {
      const result = await listVisits();
      if (!result.ok) throw new Error(result.error.message);
      return result.value.filter((v) => v.status === "scheduled" || v.status === "in_progress");
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.primaryColor }]}>Visits</Text>
        <Pressable
          style={[styles.scheduleButton, { backgroundColor: theme.primaryColor }]}
          onPress={() => setScheduling(true)}
          accessibilityLabel="Schedule a visit"
        >
          <Text style={styles.scheduleButtonText}>+ Schedule</Text>
        </Pressable>
      </View>

      {visitsQuery.isPending ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : visitsQuery.isError ? (
        <View>
          <Text style={styles.muted}>Couldn't load visits.</Text>
          <Pressable onPress={() => void visitsQuery.refetch()}>
            <Text style={[styles.retry, { color: theme.primaryColor }]}>Try again</Text>
          </Pressable>
        </View>
      ) : visitsQuery.data.length === 0 ? (
        <Text style={styles.muted}>Nothing scheduled. Tap + Schedule to book a visit.</Text>
      ) : (
        <FlatList
          data={visitsQuery.data}
          keyExtractor={(item) => item.id}
          onRefresh={() => void visitsQuery.refetch()}
          refreshing={visitsQuery.isRefetching}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/(team)/visit/[id]", params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.title}>
                    {visitTypeLabel(item.visitType)} · {item.patientName}
                  </Text>
                  <Text style={styles.due}>
                    {formatWhen(item.scheduledAt)} · {item.clinicianName}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </Pressable>
            </Link>
          )}
        />
      )}

      <Modal visible={scheduling} animationType="slide" onRequestClose={() => setScheduling(false)}>
        <ScheduleForm
          onDone={() => {
            setScheduling(false);
            void queryClient.invalidateQueries({ queryKey: ["visits"] });
          }}
          onCancel={() => setScheduling(false)}
        />
      </Modal>
    </View>
  );
}

function StatusPill({ status }: { status: VisitListItem["status"] }) {
  const bg = status === "in_progress" ? "#1F6F5B" : "#8A918D";
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={styles.pillText}>{status === "in_progress" ? "LIVE" : "SCHEDULED"}</Text>
    </View>
  );
}

function ScheduleForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const theme = useTheme();
  const [patientId, setPatientId] = useState<PatientDirectoryEntry["id"] | null>(null);
  const [visitType, setVisitType] = useState<VisitType>("video");
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirQuery = useQuery({
    queryKey: ["patient-directory"],
    queryFn: async (): Promise<PatientDirectoryEntry[]> => {
      const result = await patientDirectory();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!patientId || hour === null) throw new Error("Pick a patient, day, and time.");
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + dayOffset);
      scheduledAt.setHours(hour, 0, 0, 0);
      const result = await scheduleVisit({ patientId: patientId, visitType, scheduledAt: scheduledAt.toISOString() });
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't schedule the visit."),
  });

  const complete = patientId !== null && hour !== null;

  return (
    <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>Schedule visit</Text>

      <Text style={styles.label}>Patient</Text>
      {dirQuery.isPending ? (
        <Text style={styles.muted}>Loading patients…</Text>
      ) : (
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
      )}

      <Text style={styles.label}>Visit type</Text>
      <View style={styles.chips}>
        {VISIT_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setVisitType(t)}
            style={[styles.chip, visitType === t && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.chipText, visitType === t && styles.chipTextSelected]}>{visitTypeLabel(t)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Day</Text>
      <View style={styles.chips}>
        {[0, 1].map((d) => (
          <Pressable
            key={d}
            onPress={() => setDayOffset(d)}
            style={[styles.chip, dayOffset === d && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.chipText, dayOffset === d && styles.chipTextSelected]}>{d === 0 ? "Today" : "Tomorrow"}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Time</Text>
      <View style={styles.chips}>
        {TIME_SLOTS.map((h) => (
          <Pressable
            key={h}
            onPress={() => setHour(h)}
            style={[styles.chip, hour === h && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.chipText, hour === h && styles.chipTextSelected]}>{formatHour(h)}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.submit, { backgroundColor: theme.primaryColor, opacity: complete && !mutation.isPending ? 1 : 0.5 }]}
        onPress={() => mutation.mutate()}
        disabled={!complete || mutation.isPending}
      >
        <Text style={styles.submitText}>{mutation.isPending ? "Scheduling…" : "Schedule visit"}</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.cancel}>
        <Text style={[styles.cancelText, { color: theme.primaryColor }]}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

function formatHour(h: number): string {
  return h <= 12 ? `${h}a` : `${h - 12}p`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7", padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 40, marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: "700" },
  scheduleButton: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  scheduleButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  muted: { fontSize: 15, color: "#5B625E" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10 },
  rowText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600" },
  due: { fontSize: 13, color: "#8A918D", marginTop: 2 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  form: { flex: 1, backgroundColor: "#F7F8F7" },
  formContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#D8DCD9", backgroundColor: "#fff" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#1A1D1B" },
  chipTextSelected: { color: "#fff" },
  submit: { borderRadius: 22, paddingVertical: 14, alignItems: "center", marginTop: 28 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancel: { alignItems: "center", marginTop: 12, paddingVertical: 8 },
  cancelText: { fontSize: 15, fontWeight: "600" },
  error: { color: "#B3261E", fontSize: 14, marginTop: 12 },
});
