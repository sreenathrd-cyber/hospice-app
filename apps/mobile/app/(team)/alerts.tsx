import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, FlatList, StyleSheet, Text, View } from "react-native";
import type { AlertListItem, AlertSeverity } from "@repo/types";
import { useTheme } from "../../lib/theme";
import { acknowledgeAlert, listAlerts } from "../../lib/questionnaires";

/** Care-team alert inbox — red flags first, one-tap acknowledge. */
export default function TeamAlerts() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: async (): Promise<AlertListItem[]> => {
      const result = await listAlerts();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const ackMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const result = await acknowledgeAlert(alertId);
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const sorted = [...(alertsQuery.data ?? [])].sort((a, b) =>
    severityRank(a.severity) === severityRank(b.severity)
      ? b.createdAt.localeCompare(a.createdAt)
      : severityRank(a.severity) - severityRank(b.severity),
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>Alerts</Text>
      {alertsQuery.isPending ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : alertsQuery.isError ? (
        <View>
          <Text style={styles.muted}>Couldn't load alerts.</Text>
          <Pressable onPress={() => void alertsQuery.refetch()}>
            <Text style={[styles.retry, { color: theme.primaryColor }]}>Try again</Text>
          </Pressable>
        </View>
      ) : sorted.length === 0 ? (
        <Text style={styles.muted}>No unacknowledged alerts. You're all clear.</Text>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          onRefresh={() => void alertsQuery.refetch()}
          refreshing={alertsQuery.isRefetching}
          renderItem={({ item }) => (
            <View style={[styles.card, severityBorder(item.severity)]}>
              <View style={styles.cardHeader}>
                <Text style={styles.patient}>{item.patientName}</Text>
                <SeverityPill severity={item.severity} />
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
              <Pressable
                style={styles.ackButton}
                onPress={() => ackMutation.mutate(item.id)}
                disabled={ackMutation.isPending}
                accessibilityLabel={`Acknowledge alert for ${item.patientName}`}
              >
                <Text style={[styles.ackText, { color: theme.primaryColor }]}>
                  {ackMutation.isPending ? "Working…" : "Acknowledge"}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

function severityRank(s: AlertSeverity): number {
  return s === "red" ? 0 : s === "warning" ? 1 : 2;
}

function SeverityPill({ severity }: { severity: AlertSeverity }) {
  const bg = severity === "red" ? "#B3261E" : severity === "warning" ? "#B7791F" : "#5B625E";
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={styles.pillText}>{severity.toUpperCase()}</Text>
    </View>
  );
}

function severityBorder(severity: AlertSeverity) {
  return {
    borderLeftWidth: 4,
    borderLeftColor: severity === "red" ? "#B3261E" : severity === "warning" ? "#B7791F" : "#D8DCD9",
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7", padding: 20 },
  heading: { fontSize: 22, fontWeight: "700", marginTop: 40, marginBottom: 16 },
  muted: { fontSize: 15, color: "#5B625E" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  patient: { fontSize: 16, fontWeight: "700" },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  message: { fontSize: 14, color: "#1A1D1B", lineHeight: 20 },
  time: { fontSize: 12, color: "#8A918D", marginTop: 6 },
  ackButton: { marginTop: 10, alignSelf: "flex-start" },
  ackText: { fontSize: 14, fontWeight: "700" },
});
