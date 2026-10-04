import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { ThreadListItem } from "@repo/types";
import { useTheme } from "../lib/theme";
import { listThreads } from "../lib/messaging";

/**
 * Conversation list, shared by the family and care-team apps. Unread badges
 * come from the server's read watermarks — the client never guesses.
 */
export function ThreadList({ basePath }: { basePath: "(patient)" | "(team)" }) {
  const theme = useTheme();
  const threadsQuery = useQuery({
    queryKey: ["threads"],
    queryFn: async (): Promise<ThreadListItem[]> => {
      const result = await listThreads();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  if (threadsQuery.isPending) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading conversations…</Text>
      </View>
    );
  }

  if (threadsQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Couldn't load conversations.</Text>
        <Pressable onPress={() => void threadsQuery.refetch()}>
          <Text style={[styles.retry, { color: theme.primaryColor }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (threadsQuery.data.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No conversations yet.</Text>
        <Text style={styles.hint}>Messages with your care team will appear here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={threadsQuery.data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      onRefresh={() => void threadsQuery.refetch()}
      refreshing={threadsQuery.isRefetching}
      renderItem={({ item }) => (
        <Link
          href={{ pathname: `/${basePath}/thread/[id]`, params: { id: item.id } }}
          asChild
        >
          <Pressable style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.names} numberOfLines={1}>
                {item.participantNames.join(", ")}
              </Text>
              <Text style={styles.date}>{formatDate(item.lastMessageAt)}</Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.primaryColor }]}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </Link>
      )}
    />
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { fontSize: 15, color: "#5B625E" },
  hint: { fontSize: 13, color: "#8A918D", marginTop: 6, textAlign: "center" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  list: { padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  rowText: { flex: 1 },
  names: { fontSize: 16, fontWeight: "600" },
  date: { fontSize: 13, color: "#8A918D", marginTop: 2 },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
