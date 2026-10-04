import { z } from "zod";
import {
  patientIdSchema,
  questionnaireAssignmentIdSchema,
  questionnaireResponseIdSchema,
  tenantIdSchema,
} from "./branded.js";

/** Questionnaire kinds supported by the schema-driven questionnaire engine. */
export const questionnaireKindSchema = z.enum([
  "esas",
  "pps",
  "phq2_gad2",
  "bowel_bladder",
  "caregiver_wellbeing",
]);
export type QuestionnaireKind = z.infer<typeof questionnaireKindSchema>;

/* ---------------- ESAS: 9 symptoms, each 0–10 ---------------- */

const esasItem = z.number().int().min(0).max(10);

export const esasScoresSchema = z.object({
  pain: esasItem,
  tiredness: esasItem,
  drowsiness: esasItem,
  nausea: esasItem,
  appetite: esasItem,
  shortnessOfBreath: esasItem,
  depression: esasItem,
  anxiety: esasItem,
  wellbeing: esasItem,
});
export type EsasScores = z.infer<typeof esasScoresSchema>;

export const ESAS_SYMPTOMS = [
  "pain",
  "tiredness",
  "drowsiness",
  "nausea",
  "appetite",
  "shortnessOfBreath",
  "depression",
  "anxiety",
  "wellbeing",
] as const satisfies ReadonlyArray<keyof EsasScores>;

/* ---------------- PPS: 0–100 in steps of 10 ---------------- */

export const ppsScoreSchema = z.number().int().min(0).max(100).multipleOf(10);
export type PpsScore = z.infer<typeof ppsScoreSchema>;

/* ---------------- PHQ-2 / GAD-2: 4 items, each 0–3 ---------------- */

const frequencyItem = z.number().int().min(0).max(3);

export const phq2Gad2ScoresSchema = z.object({
  littleInterest: frequencyItem,
  feelingDown: frequencyItem,
  nervous: frequencyItem,
  worrying: frequencyItem,
});
export type Phq2Gad2Scores = z.infer<typeof phq2Gad2ScoresSchema>;

/* ---------------- Bowel / bladder / nausea ---------------- */

export const bowelBladderScoresSchema = z.object({
  bowelMovementRecency: z.enum(["today", "yesterday", "two_days_ago", "longer"]),
  bladderDifficulty: z.boolean(),
  nauseaPresent: z.boolean(),
  vomitingEpisodes: z.number().int().min(0).max(20),
});
export type BowelBladderScores = z.infer<typeof bowelBladderScoresSchema>;

/* ---------------- Caregiver wellbeing ---------------- */

const wellbeingItem = z.number().int().min(0).max(10);

export const caregiverWellbeingScoresSchema = z.object({
  strain: wellbeingItem,
  sleepQuality: wellbeingItem,
  feelingSupported: wellbeingItem,
});
export type CaregiverWellbeingScores = z.infer<typeof caregiverWellbeingScoresSchema>;

/* ---------------- Response envelope (discriminated by kind) ---------------- */

const responseBase = {
  id: questionnaireResponseIdSchema,
  patientId: patientIdSchema,
  submittedAt: z.string().datetime(),
};

export const questionnaireResponseSchema = z.discriminatedUnion("kind", [
  z.object({ ...responseBase, kind: z.literal("esas"), scores: esasScoresSchema }),
  z.object({ ...responseBase, kind: z.literal("pps"), scores: ppsScoreSchema }),
  z.object({ ...responseBase, kind: z.literal("phq2_gad2"), scores: phq2Gad2ScoresSchema }),
  z.object({ ...responseBase, kind: z.literal("bowel_bladder"), scores: bowelBladderScoresSchema }),
  z.object({
    ...responseBase,
    kind: z.literal("caregiver_wellbeing"),
    scores: caregiverWellbeingScoresSchema,
  }),
]);
export type QuestionnaireResponse = z.infer<typeof questionnaireResponseSchema>;

/* ---------------- Pure scoring helpers (no I/O) ---------------- */

export function esasTotal(scores: EsasScores): number {
  return ESAS_SYMPTOMS.reduce((sum, symptom) => sum + scores[symptom], 0);
}

export function phq2Score(scores: Phq2Gad2Scores): number {
  return scores.littleInterest + scores.feelingDown;
}

export function gad2Score(scores: Phq2Gad2Scores): number {
  return scores.nervous + scores.worrying;
}

/* ---------------- Assignments (the send schedule) ---------------- */

export const assignmentStatusSchema = z.enum(["pending", "completed", "cancelled"]);
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;

export const questionnaireAssignmentSchema = z.object({
  id: questionnaireAssignmentIdSchema,
  tenantId: tenantIdSchema,
  patientId: patientIdSchema,
  kind: questionnaireKindSchema,
  status: assignmentStatusSchema,
  dueAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type QuestionnaireAssignment = z.infer<typeof questionnaireAssignmentSchema>;

export const assignQuestionnaireRequestSchema = z.object({
  patientId: patientIdSchema,
  kind: questionnaireKindSchema,
  /** When the family should complete it by. Defaults to now (due immediately). */
  dueAt: z.string().datetime().optional(),
});
export type AssignQuestionnaireRequest = z.infer<typeof assignQuestionnaireRequestSchema>;

/* ---------------- Submit (family → API) ---------------- */

const submitBase = { assignmentId: questionnaireAssignmentIdSchema };

export const submitQuestionnaireRequestSchema = z.discriminatedUnion("kind", [
  z.object({ ...submitBase, kind: z.literal("esas"), scores: esasScoresSchema }),
  z.object({ ...submitBase, kind: z.literal("pps"), scores: ppsScoreSchema }),
  z.object({ ...submitBase, kind: z.literal("phq2_gad2"), scores: phq2Gad2ScoresSchema }),
  z.object({ ...submitBase, kind: z.literal("bowel_bladder"), scores: bowelBladderScoresSchema }),
  z.object({
    ...submitBase,
    kind: z.literal("caregiver_wellbeing"),
    scores: caregiverWellbeingScoresSchema,
  }),
]);
export type SubmitQuestionnaireRequest = z.infer<typeof submitQuestionnaireRequestSchema>;

export const responsesQuerySchema = z.object({
  patientId: patientIdSchema,
});
export type ResponsesQuery = z.infer<typeof responsesQuerySchema>;

/* ---------------- Recurring schedules ---------------- */

/** How often a scheduled questionnaire recurs. */
export const scheduleFrequencySchema = z.enum(["daily", "weekly"]);
export type ScheduleFrequency = z.infer<typeof scheduleFrequencySchema>;

export const questionnaireScheduleSchema = z.object({
  id: questionnaireAssignmentIdSchema,
  tenantId: tenantIdSchema,
  patientId: patientIdSchema,
  kind: questionnaireKindSchema,
  frequency: scheduleFrequencySchema,
  active: z.boolean(),
  /** When the next assignment should be generated. */
  nextDueAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type QuestionnaireSchedule = z.infer<typeof questionnaireScheduleSchema>;

export const createScheduleRequestSchema = z.object({
  patientId: patientIdSchema,
  kind: questionnaireKindSchema,
  frequency: scheduleFrequencySchema,
  /** First due date. Defaults to now. */
  startAt: z.string().datetime().optional(),
});
export type CreateScheduleRequest = z.infer<typeof createScheduleRequestSchema>;

export const updateScheduleRequestSchema = z.object({
  active: z.boolean(),
});
export type UpdateScheduleRequest = z.infer<typeof updateScheduleRequestSchema>;

/** Schedule with the patient's name resolved — what the team list renders. */
export const scheduleListItemSchema = questionnaireScheduleSchema.extend({
  patientName: z.string().min(1),
});
export type ScheduleListItem = z.infer<typeof scheduleListItemSchema>;

/** Pure: advance a due date by one frequency interval. */
export function advanceDueDate(from: Date, frequency: ScheduleFrequency): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + (frequency === "daily" ? 1 : 7));
  return next;
}
