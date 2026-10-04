import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { VisitListItem, VisitType } from "@repo/types";
import { useTheme } from "../../lib/theme";
import { listVisits } from "../../lib/visits";

/** Family's upcoming visits. */
export default function PatientVisits() {
  const theme = useTheme();
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
      <Text style={[styles.heading, { color: theme.primaryColor }]}>Visits</Text>
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
        <Text style={styles.muted}>No upcoming visits. Your care team will schedule them here.</Text>
      ) : (
        <FlatList
          data={visitsQuery.data}
          keyExtractor={(item) => item.id}
          onRefresh={() => void visitsQuery.refetch()}
          refreshing={visitsQuery.isRefetching}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/(patient)/visit/[id]", params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.title}>
                    {visitTypeLabel(item.visitType)} · {item.clinicianName}
                  </Text>
                  <Text style={styles.due}>{formatWhen(item.scheduledAt)}</Text>
                </View>
                <Text style={[styles.chevron, { color: theme.primaryColor }]}>→</Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

export function visitTypeLabel(t: VisitType): string {
  return t === "video" ? "Video visit" : t === "phone" ? "Phone visit" : "In-person visit";
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7", padding: 20 },
  heading: { fontSize: 22, fontWeight: "700", marginTop: 40, marginBottom: 16 },
  muted: { fontSize: 15, color: "#5B625E" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  rowText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600" },
  due: { fontSize: 13, color: "#8A918D", marginTop: 2 },
  chevron: { fontSize: 20, fontWeight: "600" },
});
