import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { QuestionnaireAssignment } from "@repo/types";
import { useTheme } from "../../lib/theme";
import { pendingQuestionnaires } from "../../lib/questionnaires";
import { KIND_META } from "../../lib/questionnaire-meta";

/** Family's to-do list of questionnaires, soonest due first. */
export default function PatientQuestionnaires() {
  const theme = useTheme();
  const listQuery = useQuery({
    queryKey: ["pending-questionnaires"],
    queryFn: async (): Promise<QuestionnaireAssignment[]> => {
      const result = await pendingQuestionnaires();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>Questionnaires</Text>
      {listQuery.isPending ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : listQuery.isError ? (
        <View>
          <Text style={styles.muted}>Couldn't load questionnaires.</Text>
          <Pressable onPress={() => void listQuery.refetch()}>
            <Text style={[styles.retry, { color: theme.primaryColor }]}>Try again</Text>
          </Pressable>
        </View>
      ) : listQuery.data.length === 0 ? (
        <Text style={styles.muted}>Nothing assigned right now. You're all caught up.</Text>
      ) : (
        <FlatList
          data={listQuery.data}
          keyExtractor={(item) => item.id}
          onRefresh={() => void listQuery.refetch()}
          refreshing={listQuery.isRefetching}
          renderItem={({ item }) => (
            <Link
              href={{ pathname: "/(patient)/questionnaire/[id]", params: { id: item.id } }}
              asChild
            >
              <Pressable style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.title}>{KIND_META[item.kind].title}</Text>
                  <Text style={styles.due}>Due {formatDue(item.dueAt)}</Text>
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

function formatDue(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.getTime() < now.getTime()) return "now";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
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
