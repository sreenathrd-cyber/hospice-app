import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { QuestionnaireAssignment } from "@repo/types";
import { QuestionnaireForm } from "../../../components/questionnaire-form";
import { useTheme } from "../../../lib/theme";
import { pendingQuestionnaires } from "../../../lib/questionnaires";

/** Renders the assigned questionnaire; on submit, back to the list. */
export default function PatientQuestionnaireDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const listQuery = useQuery({
    queryKey: ["pending-questionnaires"],
    queryFn: async (): Promise<QuestionnaireAssignment[]> => {
      const result = await pendingQuestionnaires();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });

  const assignment = listQuery.data?.find((a) => a.id === id);

  if (listQuery.isPending) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>This questionnaire is no longer pending.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.retry, { color: theme.primaryColor }]}>Back to list</Text>
        </Pressable>
      </View>
    );
  }

  return <QuestionnaireForm assignment={assignment} onSubmitted={() => router.back()} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8F7" },
  muted: { fontSize: 15, color: "#5B625E" },
  retry: { fontSize: 15, fontWeight: "600", marginTop: 12 },
});
