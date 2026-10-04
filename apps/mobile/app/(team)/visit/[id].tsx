import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { VisitListItem } from "@repo/types";
import { useTheme } from "../../../lib/theme";
import { completeVisit, joinVisit, listVisits } from "../../../lib/visits";
import { SiaTimer } from "../../../components/sia-timer";
import { VisitNotes } from "../../../components/visit-notes";
import { formatWhen, visitTypeLabel } from "../../(patient)/visits";

/** Team visit detail: join the video room, mark complete. */
export default function TeamVisitDetail() {
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
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't start the video visit."),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const result = await completeVisit(id);
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["visits"] });
      router.back();
    },
    onError: () => setError("Couldn't mark the visit complete."),
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

  const active = visit.status === "scheduled" || visit.status === "in_progress";

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>{visitTypeLabel(visit.visitType)}</Text>
      <Text style={styles.detail}>{visit.patientName}</Text>
      <Text style={styles.detail}>{formatWhen(visit.scheduledAt)}</Text>
      <Text style={styles.detail}>Clinician: {visit.clinicianName}</Text>
      <Text style={styles.detail}>Status: {visit.status.replace("_", " ")}</Text>

      {visit.visitType === "video" && active && (
        <Pressable
          style={[styles.primary, { backgroundColor: theme.primaryColor }]}
          onPress={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
          accessibilityLabel="Join video visit"
        >
          <Text style={styles.primaryText}>{joinMutation.isPending ? "Starting…" : "Join video visit"}</Text>
        </Pressable>
      )}
      {visit.visitType === "in_person" && <SiaTimer visit={visit} />}
      <VisitNotes visit={visit} />
      {active && (
        <Pressable
          style={styles.secondary}
          onPress={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          accessibilityLabel="Mark visit complete"
        >
          <Text style={[styles.secondaryText, { color: theme.primaryColor }]}>
            {completeMutation.isPending ? "Working…" : "Mark complete"}
          </Text>
        </Pressable>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7", padding: 20 },
  heading: { fontSize: 22, fontWeight: "700", marginTop: 40, marginBottom: 8 },
  detail: { fontSize: 15, color: "#1A1D1B", marginBottom: 4 },
  muted: { fontSize: 15, color: "#5B625E" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8F7" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  primary: { borderRadius: 22, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { borderRadius: 22, paddingVertical: 14, alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: "#D8DCD9", backgroundColor: "#fff" },
  secondaryText: { fontSize: 16, fontWeight: "700" },
  error: { color: "#B3261E", fontSize: 14, marginTop: 12, lineHeight: 20 },
  webviewContainer: { flex: 1, backgroundColor: "#101413" },
  webviewHeader: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: "#101413" },
  leave: { fontSize: 15, fontWeight: "600" },
});
