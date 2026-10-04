import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ESAS_SYMPTOMS,
  type EsasScores,
  type QuestionnaireAssignment,
  type SubmitQuestionnaireRequest,
} from "@repo/types";
import { useTheme } from "../lib/theme";
import { submitQuestionnaire } from "../lib/questionnaires";
import {
  BM_OPTIONS,
  CAREGIVER_LABELS,
  ESAS_LABELS,
  FREQUENCY_ANCHORS,
  KIND_META,
  PHQ2_GAD2_LABELS,
} from "../lib/questionnaire-meta";
import { ChoiceInput, ScaleInput, StepperInput } from "./questionnaire-inputs";

/**
 * Schema-driven questionnaire renderer. The phone collects answers and the
 * server scores — no threshold lives in this file. One component per kind,
 * switched on the assignment.
 */
export function QuestionnaireForm({
  assignment,
  onSubmitted,
}: {
  assignment: QuestionnaireAssignment;
  onSubmitted: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (body: SubmitQuestionnaireRequest) => {
      const result = await submitQuestionnaire(body);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-questionnaires"] });
      onSubmitted();
    },
    onError: () => setError("Couldn't submit your answers. Try again."),
  });

  function doSubmit(body: SubmitQuestionnaireRequest) {
    setError(null);
    mutation.mutate(body);
  }

  const meta = KIND_META[assignment.kind];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.primaryColor }]}>{meta.title}</Text>
      <Text style={styles.intro}>{meta.intro}</Text>

      {assignment.kind === "esas" && (
        <EsasForm onSubmit={(s) => doSubmit({ assignmentId: assignment.id, kind: "esas", scores: s })} />
      )}
      {assignment.kind === "pps" && (
        <PpsForm onSubmit={(s) => doSubmit({ assignmentId: assignment.id, kind: "pps", scores: s })} />
      )}
      {assignment.kind === "phq2_gad2" && (
        <Phq2Gad2Form
          onSubmit={(s) => doSubmit({ assignmentId: assignment.id, kind: "phq2_gad2", scores: s })}
        />
      )}
      {assignment.kind === "bowel_bladder" && (
        <BowelBladderForm
          onSubmit={(s) => doSubmit({ assignmentId: assignment.id, kind: "bowel_bladder", scores: s })}
        />
      )}
      {assignment.kind === "caregiver_wellbeing" && (
        <CaregiverForm
          onSubmit={(s) => doSubmit({ assignmentId: assignment.id, kind: "caregiver_wellbeing", scores: s })}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {mutation.isPending && <Text style={styles.muted}>Submitting…</Text>}
    </ScrollView>
  );
}

function SubmitButton({ disabled, pending, onPress }: { disabled: boolean; pending: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || pending}
      style={[styles.submit, { backgroundColor: theme.primaryColor, opacity: disabled || pending ? 0.5 : 1 }]}
      accessibilityLabel="Submit answers"
    >
      <Text style={styles.submitText}>{pending ? "Submitting…" : "Submit"}</Text>
    </Pressable>
  );
}

type SymptomKey = (typeof ESAS_SYMPTOMS)[number];

function EsasForm({ onSubmit }: { onSubmit: (scores: EsasScores) => void }) {
  const [scores, setScores] = useState<Record<SymptomKey, number | null>>(
    Object.fromEntries(ESAS_SYMPTOMS.map((s) => [s, null])) as Record<SymptomKey, number | null>,
  );
  const complete = ESAS_SYMPTOMS.every((s) => scores[s] !== null);
  return (
    <View>
      {ESAS_SYMPTOMS.map((symptom) => (
        <ScaleInput
          key={symptom}
          label={ESAS_LABELS[symptom]}
          value={scores[symptom]}
          max={10}
          anchors={["No symptom", "Worst possible"]}
          onChange={(v) => setScores((p) => ({ ...p, [symptom]: v }))}
        />
      ))}
      <SubmitButton
        disabled={!complete}
        pending={false}
        onPress={() => onSubmit(scores as EsasScores)}
      />
      {!complete && <Text style={styles.hint}>Answer every item to submit.</Text>}
    </View>
  );
}

function PpsForm({ onSubmit }: { onSubmit: (score: number) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <View>
      <ScaleInput
        label="Activity level"
        value={value}
        max={100}
        step={10}
        anchors={["No activity", "Full activity"]}
        onChange={setValue}
      />
      <SubmitButton disabled={value === null} pending={false} onPress={() => value !== null && onSubmit(value)} />
    </View>
  );
}

const PHQ_KEYS = ["littleInterest", "feelingDown", "nervous", "worrying"] as const;
type PhqKey = (typeof PHQ_KEYS)[number];

function Phq2Gad2Form({ onSubmit }: { onSubmit: (scores: Record<PhqKey, number>) => void }) {
  const [scores, setScores] = useState<Record<PhqKey, number | null>>({
    littleInterest: null, feelingDown: null, nervous: null, worrying: null,
  });
  const complete = PHQ_KEYS.every((k) => scores[k] !== null);
  return (
    <View>
      {PHQ_KEYS.map((key) => (
        <ScaleInput
          key={key}
          label={PHQ2_GAD2_LABELS[key] ?? key}
          value={scores[key]}
          max={3}
          anchors={[FREQUENCY_ANCHORS[0] ?? "", FREQUENCY_ANCHORS[3] ?? ""]}
          onChange={(v) => setScores((p) => ({ ...p, [key]: v }))}
        />
      ))}
      <SubmitButton
        disabled={!complete}
        pending={false}
        onPress={() => complete && onSubmit(scores as Record<PhqKey, number>)}
      />
    </View>
  );
}

function BowelBladderForm({
  onSubmit,
}: {
  onSubmit: (scores: {
    bowelMovementRecency: "today" | "yesterday" | "two_days_ago" | "longer";
    bladderDifficulty: boolean;
    nauseaPresent: boolean;
    vomitingEpisodes: number;
  }) => void;
}) {
  const [recency, setRecency] = useState<"today" | "yesterday" | "two_days_ago" | "longer" | null>(null);
  const [bladder, setBladder] = useState<boolean | null>(null);
  const [nausea, setNausea] = useState<boolean | null>(null);
  const [vomiting, setVomiting] = useState(0);
  const complete = recency !== null && bladder !== null && nausea !== null;
  const yesNo = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ] as const;
  return (
    <View>
      <ChoiceInput
        label="Last bowel movement"
        options={BM_OPTIONS}
        value={recency}
        onChange={setRecency}
      />
      <ChoiceInput
        label="Any difficulty with bladder?"
        options={yesNo}
        value={bladder === null ? null : bladder ? "yes" : "no"}
        onChange={(v) => setBladder(v === "yes")}
      />
      <ChoiceInput
        label="Any nausea?"
        options={yesNo}
        value={nausea === null ? null : nausea ? "yes" : "no"}
        onChange={(v) => setNausea(v === "yes")}
      />
      <StepperInput label="Vomiting episodes today" value={vomiting} min={0} max={20} onChange={setVomiting} />
      <SubmitButton
        disabled={!complete}
        pending={false}
        onPress={() =>
          complete &&
          onSubmit({
            bowelMovementRecency: recency as "today" | "yesterday" | "two_days_ago" | "longer",
            bladderDifficulty: bladder as boolean,
            nauseaPresent: nausea as boolean,
            vomitingEpisodes: vomiting,
          })
        }
      />
    </View>
  );
}

const CG_KEYS = ["strain", "sleepQuality", "feelingSupported"] as const;
type CgKey = (typeof CG_KEYS)[number];

function CaregiverForm({ onSubmit }: { onSubmit: (scores: Record<CgKey, number>) => void }) {
  const [scores, setScores] = useState<Record<CgKey, number | null>>({
    strain: null, sleepQuality: null, feelingSupported: null,
  });
  const complete = CG_KEYS.every((k) => scores[k] !== null);
  return (
    <View>
      {CG_KEYS.map((key) => {
        const meta = CAREGIVER_LABELS[key];
        if (!meta) return null;
        return (
          <ScaleInput
            key={key}
            label={meta.label}
            value={scores[key]}
            max={10}
            anchors={[meta.low, meta.high]}
            onChange={(v) => setScores((p) => ({ ...p, [key]: v }))}
          />
        );
      })}
      <SubmitButton
        disabled={!complete}
        pending={false}
        onPress={() => complete && onSubmit(scores as Record<CgKey, number>)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  intro: { fontSize: 14, color: "#5B625E", marginBottom: 20, lineHeight: 20 },
  submit: { borderRadius: 22, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 13, color: "#8A918D", textAlign: "center", marginTop: 8 },
  error: { color: "#B3261E", fontSize: 14, textAlign: "center", marginTop: 12 },
  muted: { fontSize: 14, color: "#5B625E", textAlign: "center", marginTop: 12 },
});
