import { z } from "zod";
import {
  ESAS_SYMPTOMS,
  type BowelBladderScores,
  type CaregiverWellbeingScores,
  type EsasScores,
  type Phq2Gad2Scores,
  type PpsScore,
  type QuestionnaireKind,
} from "./questionnaires.js";
import { phq2Score, gad2Score } from "./questionnaires.js";
import { alertIdSchema, patientIdSchema, questionnaireResponseIdSchema } from "./branded.js";

export const alertSeveritySchema = z.enum(["info", "warning", "red"]);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

/**
 * Alert thresholds — versioned so a threshold change never rewrites history.
 * These live in exactly one module and are evaluated server-side only.
 */
export const ALERT_THRESHOLDS = {
  version: 1,
  esasItemRed: 7,
  esasItemWarning: 4,
  esasTotalRed: 45,
  phq2Red: 3,
  gad2Red: 3,
  ppsRed: 30,
  ppsWarning: 50,
  noBmWarningDays: 2,
  vomitingRed: 3,
  vomitingWarning: 1,
  caregiverStrainRed: 7,
  caregiverSupportWarning: 3,
  caregiverSleepWarning: 3,
} as const;

export const alertSchema = z.object({
  id: alertIdSchema,
  patientId: patientIdSchema,
  responseId: questionnaireResponseIdSchema,
  questionnaireKind: z.custom<QuestionnaireKind>(),
  symptom: z.string().min(1),
  score: z.number(),
  severity: alertSeveritySchema,
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  acknowledged: z.boolean(),
});
export type Alert = z.infer<typeof alertSchema>;

export type NewAlert = Omit<Alert, "id" | "createdAt" | "acknowledged">;

function esasSeverity(score: number): AlertSeverity | null {
  if (score >= ALERT_THRESHOLDS.esasItemRed) return "red";
  if (score >= ALERT_THRESHOLDS.esasItemWarning) return "warning";
  return null;
}

/** Server-side ESAS flag evaluation. Pure — no I/O, fully unit-tested. */
export function evaluateEsas(
  patientId: Alert["patientId"],
  responseId: Alert["responseId"],
  scores: EsasScores,
): NewAlert[] {
  const alerts: NewAlert[] = [];
  for (const symptom of ESAS_SYMPTOMS) {
    const severity = esasSeverity(scores[symptom]);
    if (severity !== null) {
      alerts.push({
        patientId,
        responseId,
        questionnaireKind: "esas",
        symptom,
        score: scores[symptom],
        severity,
        message: `ESAS ${symptom} scored ${scores[symptom]}/10 (${severity})`,
      });
    }
  }
  return alerts;
}

/** Server-side PHQ-2 / GAD-2 flag evaluation. Score ≥ 3 on either subscale is a positive screen. */
export function evaluatePhq2Gad2(
  patientId: Alert["patientId"],
  responseId: Alert["responseId"],
  scores: Phq2Gad2Scores,
): NewAlert[] {
  const alerts: NewAlert[] = [];
  const phq2 = phq2Score(scores);
  const gad2 = gad2Score(scores);
  if (phq2 >= ALERT_THRESHOLDS.phq2Red) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "phq2_gad2",
      symptom: "depression_screen",
      score: phq2,
      severity: "red",
      message: `PHQ-2 scored ${phq2}/6 — positive depression screen`,
    });
  }
  if (gad2 >= ALERT_THRESHOLDS.gad2Red) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "phq2_gad2",
      symptom: "anxiety_screen",
      score: gad2,
      severity: "red",
      message: `GAD-2 scored ${gad2}/6 — positive anxiety screen`,
    });
  }
  return alerts;
}

/** Server-side PPS flag evaluation. Falling PPS is the classic decline signal. */
export function evaluatePps(
  patientId: Alert["patientId"],
  responseId: Alert["responseId"],
  score: PpsScore,
): NewAlert[] {
  const alerts: NewAlert[] = [];
  if (score <= ALERT_THRESHOLDS.ppsRed) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "pps",
      symptom: "functional_decline",
      score,
      severity: "red",
      message: `PPS ${score}% — severe functional decline`,
    });
  } else if (score <= ALERT_THRESHOLDS.ppsWarning) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "pps",
      symptom: "functional_decline",
      score,
      severity: "warning",
      message: `PPS ${score}% — declining function, watch closely`,
    });
  }
  return alerts;
}

/** Server-side bowel/bladder flag evaluation. */
export function evaluateBowelBladder(
  patientId: Alert["patientId"],
  responseId: Alert["responseId"],
  scores: BowelBladderScores,
): NewAlert[] {
  const alerts: NewAlert[] = [];
  if (scores.bowelMovementRecency === "two_days_ago" || scores.bowelMovementRecency === "longer") {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "bowel_bladder",
      symptom: "constipation",
      score: 1,
      severity: "warning",
      message: "No bowel movement for 2+ days",
    });
  }
  if (scores.vomitingEpisodes >= ALERT_THRESHOLDS.vomitingRed) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "bowel_bladder",
      symptom: "vomiting",
      score: scores.vomitingEpisodes,
      severity: "red",
      message: `${scores.vomitingEpisodes} vomiting episodes reported`,
    });
  } else if (scores.vomitingEpisodes >= ALERT_THRESHOLDS.vomitingWarning) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "bowel_bladder",
      symptom: "vomiting",
      score: scores.vomitingEpisodes,
      severity: "warning",
      message: `${scores.vomitingEpisodes} vomiting episode(s) reported`,
    });
  }
  if (scores.bladderDifficulty) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "bowel_bladder",
      symptom: "bladder_difficulty",
      score: 1,
      severity: "warning",
      message: "Difficulty with bladder reported",
    });
  }
  return alerts;
}

/**
 * Server-side caregiver-wellbeing flag evaluation.
 * Scale directions: strain 0–10 (higher = worse), sleepQuality 0–10
 * (higher = better), feelingSupported 0–10 (higher = better).
 */
export function evaluateCaregiverWellbeing(
  patientId: Alert["patientId"],
  responseId: Alert["responseId"],
  scores: CaregiverWellbeingScores,
): NewAlert[] {
  const alerts: NewAlert[] = [];
  if (scores.strain >= ALERT_THRESHOLDS.caregiverStrainRed) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "caregiver_wellbeing",
      symptom: "caregiver_strain",
      score: scores.strain,
      severity: "red",
      message: `Caregiver strain ${scores.strain}/10 — needs support call`,
    });
  }
  if (scores.feelingSupported <= ALERT_THRESHOLDS.caregiverSupportWarning) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "caregiver_wellbeing",
      symptom: "caregiver_unsupported",
      score: scores.feelingSupported,
      severity: "warning",
      message: `Caregiver feels unsupported (${scores.feelingSupported}/10)`,
    });
  }
  if (scores.sleepQuality <= ALERT_THRESHOLDS.caregiverSleepWarning) {
    alerts.push({
      patientId,
      responseId,
      questionnaireKind: "caregiver_wellbeing",
      symptom: "caregiver_poor_sleep",
      score: scores.sleepQuality,
      severity: "warning",
      message: `Caregiver sleep quality ${scores.sleepQuality}/10`,
    });
  }
  return alerts;
}

export type ScoredSubmission =
  | { kind: "esas"; scores: EsasScores }
  | { kind: "pps"; scores: PpsScore }
  | { kind: "phq2_gad2"; scores: Phq2Gad2Scores }
  | { kind: "bowel_bladder"; scores: BowelBladderScores }
  | { kind: "caregiver_wellbeing"; scores: CaregiverWellbeingScores };

/**
 * Single dispatcher the API calls after persisting a response. Exhaustive —
 * adding a questionnaire kind without a case is a compile error.
 */
export function evaluateResponse(
  patientId: Alert["patientId"],
  responseId: Alert["responseId"],
  submission: ScoredSubmission,
): NewAlert[] {
  switch (submission.kind) {
    case "esas":
      return evaluateEsas(patientId, responseId, submission.scores);
    case "pps":
      return evaluatePps(patientId, responseId, submission.scores);
    case "phq2_gad2":
      return evaluatePhq2Gad2(patientId, responseId, submission.scores);
    case "bowel_bladder":
      return evaluateBowelBladder(patientId, responseId, submission.scores);
    case "caregiver_wellbeing":
      return evaluateCaregiverWellbeing(patientId, responseId, submission.scores);
  }
}

export const alertsQuerySchema = z.object({
  // NB: z.coerce.boolean() maps the string "false" to true — parse explicitly.
  unacknowledgedOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .default(true),
});
export type AlertsQuery = z.infer<typeof alertsQuerySchema>;

/** Alert with the patient's display name resolved — what the inbox renders. */
export const alertListItemSchema = alertSchema.extend({
  patientName: z.string().min(1),
});
export type AlertListItem = z.infer<typeof alertListItemSchema>;
