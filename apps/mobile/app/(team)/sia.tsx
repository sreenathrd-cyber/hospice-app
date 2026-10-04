import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PatientDirectoryEntry, SiaSummary } from "@repo/types";
import { useTheme } from "../../lib/theme";
import { siaSummary } from "../../lib/sia";
import { patientDirectory } from "../../lib/visits";

/**
 * SIA review: pick a patient, see captured in-person RN/MSW time converted
 * to units and dollars with the daily cap applied. Labeled "potential" —
 * the 7-day end-of-life lookback is a billing determination, not capture's job.
 */
export default function TeamSia() {
  const theme = useTheme();
  const [patientId, setPatientId] = useState<PatientDirectoryEntry["id"] | null>(null);

  const dirQuery = useQuery({
    queryKey: ["patient-directory"],
    queryFn: async (): Promise<PatientDirectoryEntry[]> => {
      const result = await patientDirectory();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["sia-summary", patientId],
    enabled: patientId !== null,
    queryFn: async (): Promise<SiaSummary> => {
      if (patientId === null) throw new Error("No patient selected");
      const result = await siaSummary(patientId);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>SIA capture</Text>
      <Text style={styles.sub}>Potential add-on revenue from captured in-person RN/MSW time.</Text>

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

      {summaryQuery.isPending && patientId && <Text style={styles.muted}>Loading summary…</Text>}
      {summaryQuery.data && <SummaryCard summary={summaryQuery.data} />}
    </ScrollView>
  );
}

function SummaryCard({ summary }: { summary: SiaSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.hero}>
        <Text style={styles.dollars}>${summary.dollars.toFixed(2)}</Text>
        <Text style={styles.heroSub}>
          {summary.cappedUnits} units · {summary.totalMinutes} min captured
          {summary.totalUnits !== summary.cappedUnits && ` (${summary.totalUnits - summary.cappedUnits} units over daily cap)`}
        </Text>
      </View>
      {summary.days.length === 0 ? (
        <Text style={styles.muted}>No timed entries yet. Start the visit timer on an in-person visit.</Text>
      ) : (
        summary.days.map((d) => (
          <View key={d.date} style={styles.dayRow}>
            <Text style={styles.dayDate}>{d.date}</Text>
            <Text style={styles.dayDetail}>
              {d.minutes} min → {d.cappedUnits} units · ${d.dollars.toFixed(2)}
            </Text>
          </View>
        ))
      )}
      <Text style={styles.fine}>
        Potential SIA: the 7-day end-of-life lookback is determined at billing. Capture's job is to not lose minutes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 14, color: "#5B625E", marginTop: 4, marginBottom: 8 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 12, marginBottom: 8 },
  muted: { fontSize: 15, color: "#5B625E" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#D8DCD9", backgroundColor: "#fff" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#1A1D1B" },
  chipTextSelected: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginTop: 16 },
  hero: { marginBottom: 12 },
  dollars: { fontSize: 34, fontWeight: "800" },
  heroSub: { fontSize: 13, color: "#5B625E", marginTop: 2 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#EEF0EE" },
  dayDate: { fontSize: 14, fontWeight: "600" },
  dayDetail: { fontSize: 14, color: "#5B625E" },
  fine: { fontSize: 12, color: "#8A918D", marginTop: 12, lineHeight: 16 },
});
