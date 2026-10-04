import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { VisitListItem } from "@repo/types";
import { useTheme } from "../../../lib/theme";
import { joinVisit, listVisits } from "../../../lib/visits";
import { formatWhen, visitTypeLabel } from "../visits";

/**
 * Family visit detail. Video visits join through an in-app WebView pointed at
 * the hosted video page — the join token is short-lived and room-scoped.
 */
export default function PatientVisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visitsQuery = useQuery({
    queryKey: ["visits"],
    queryFn: async (): Promise<VisitListItem[]> => {
      const result = await listVisits();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });
  const visit = visitsQuery.data?.find((v) => v.id === id);

  const joinMutation = useMutation({
    mutationFn: async () => {
      const result = await joinVisit(id);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    onSuccess: (data) => {
      setError(null);
      setJoinUrl(data.joinUrl);
      void queryClient.invalidateQueries({ queryKey: ["visits"] });
    },
    onError: (e) => setError(e instanceof Error ? friendlyJoinError(e.message) : "Couldn't start the video visit."),
  });

  if (joinUrl) {
    return (
      <View style={styles.webviewContainer}>
        <View style={styles.webviewHeader}>
          <Pressable onPress={() => setJoinUrl(null)}>
            <Text style={[styles.leave, { color: theme.primaryColor }]}>← Leave visit</Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: joinUrl }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    );
  }

  if (visitsQuery.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Visit not found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.retry, { color: theme.primaryColor }]}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>{visitTypeLabel(visit.visitType)}</Text>
      <Text style={styles.detail}>With {visit.clinicianName}</Text>
      <Text style={styles.detail}>{formatWhen(visit.scheduledAt)}</Text>
      <Text style={styles.detail}>For {visit.patientName}</Text>

      {visit.visitType === "video" && visit.status !== "completed" && visit.status !== "cancelled" && (
        <Pressable
          style={[styles.join, { backgroundColor: theme.primaryColor }]}
          onPress={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
          accessibilityLabel="Join video visit"
        >
          <Text style={styles.joinText}>
            {joinMutation.isPending ? "Starting…" : visit.status === "in_progress" ? "Rejoin video visit" : "Join video visit"}
          </Text>
        </Pressable>
      )}
      {visit.visitType !== "video" && (
        <Text style={styles.muted}>
          {visit.visitType === "phone"
            ? "Your care team will call you at the scheduled time."
            : "Your care team will come to you at the scheduled time."}
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function friendlyJoinError(message: string): string {
  if (message.includes("telnyx")) return "Video visits aren't available right now. Call your care team instead.";
  return "Couldn't start the video visit. Try again.";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7", padding: 20 },
  heading: { fontSize: 22, fontWeight: "700", marginTop: 40, marginBottom: 8 },
  detail: { fontSize: 15, color: "#1A1D1B", marginBottom: 4 },
  muted: { fontSize: 15, color: "#5B625E", marginTop: 12, lineHeight: 22 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8F7" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  join: { borderRadius: 22, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  joinText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { color: "#B3261E", fontSize: 14, marginTop: 12, lineHeight: 20 },
  webviewContainer: { flex: 1, backgroundColor: "#101413" },
  webviewHeader: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: "#101413" },
  leave: { fontSize: 15, fontWeight: "600" },
});
