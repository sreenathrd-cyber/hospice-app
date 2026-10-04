import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { type MessageWithSender } from "@repo/types";
import { useSession } from "../lib/session-context";
import { useTheme } from "../lib/theme";
import { getMessages, markThreadRead, sendMessage } from "../lib/messaging";

const PAGE_SIZE = 50;

/**
 * One conversation, shared by the family and care-team apps. Messages load
 * newest-first via keyset pagination; sending invalidates the thread list
 * so unread badges stay honest.
 */
export function Conversation({ threadId }: { threadId: string }) {
  const theme = useTheme();
  const { state } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const myUserId = state.status === "ready" && state.session.kind === "some"
    ? state.session.value.userId
    : null;

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", threadId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }): Promise<MessageWithSender[]> => {
      const result = await getMessages(threadId, pageParam);
      if (!result.ok) throw new Error(result.error.message);
      if (pageParam === undefined) void markThreadRead(threadId);
      return result.value;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1]?.id : undefined,
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string): Promise<MessageWithSender> => {
      const result = await sendMessage(threadId, body);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    onSuccess: () => {
      setDraft("");
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: () => {
      setSendError("Couldn't send. Try again.");
    },
  });

  async function onSend(): Promise<void> {
    const body = draft.trim();
    if (body.length === 0 || sendMutation.isPending) return;
    sendMutation.mutate(body);
  }

  const allMessages = messagesQuery.data?.pages.flat() ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {messagesQuery.isPending ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Loading messages…</Text>
        </View>
      ) : messagesQuery.isError ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Couldn't load messages.</Text>
          <Pressable onPress={() => void messagesQuery.refetch()}>
            <Text style={[styles.retry, { color: theme.primaryColor }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={allMessages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onRefresh={() => void messagesQuery.refetch()}
          refreshing={messagesQuery.isRefetching}
          ListFooterComponent={
            messagesQuery.hasNextPage ? (
              <Pressable
                style={styles.loadEarlier}
                onPress={() => void messagesQuery.fetchNextPage()}
                disabled={messagesQuery.isFetchingNextPage}
              >
                <Text style={[styles.loadEarlierText, { color: theme.primaryColor }]}>
                  {messagesQuery.isFetchingNextPage ? "Loading…" : "Show earlier messages"}
                </Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const mine = item.senderId === myUserId;
            return (
              <View style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: theme.primaryColor }
                      : { backgroundColor: "#fff" },
                  ]}
                >
                  {!mine && <Text style={styles.senderName}>{item.senderName}</Text>}
                  <Text style={[styles.body, mine ? styles.bodyMine : styles.bodyTheirs]}>
                    {item.body}
                  </Text>
                  <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
                    {formatTime(item.sentAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        {sendError && <Text style={styles.sendError}>{sendError}</Text>}
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          placeholderTextColor="#8A918D"
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={() => void onSend()}
        />
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: theme.primaryColor, opacity: sendMutation.isPending ? 0.6 : 1 },
          ]}
          onPress={() => void onSend()}
          disabled={sendMutation.isPending}
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { fontSize: 15, color: "#5B625E" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  list: { padding: 16, paddingBottom: 8 },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  mine: { justifyContent: "flex-end" },
  theirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12 },
  senderName: { fontSize: 12, fontWeight: "600", color: "#5B625E", marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 21 },
  bodyMine: { color: "#fff" },
  bodyTheirs: { color: "#1A1D1B" },
  time: { fontSize: 11, marginTop: 4 },
  timeMine: { color: "rgba(255,255,255,0.8)", textAlign: "right" },
  timeTheirs: { color: "#8A918D", textAlign: "right" },
  loadEarlier: { alignItems: "center", padding: 12 },
  loadEarlierText: { fontSize: 14, fontWeight: "600" },
  composer: { padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E8EAe9" },
  input: {
    backgroundColor: "#F1F3F1",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 110,
    marginBottom: 8,
  },
  sendButton: { borderRadius: 20, paddingVertical: 12, alignItems: "center" },
  sendText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sendError: { color: "#B3261E", fontSize: 13, marginBottom: 8, textAlign: "center" },
});
