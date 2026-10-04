import {
  alertListItemSchema,
  questionnaireAssignmentSchema,
  questionnaireResponseSchema,
  questionnaireScheduleSchema,
  scheduleListItemSchema,
  type AlertListItem,
  type QuestionnaireAssignment,
  type QuestionnaireKind,
  type QuestionnaireResponse,
  type QuestionnaireSchedule,
  type Result,
  type ScheduleFrequency,
  type ScheduleListItem,
  type SubmitQuestionnaireRequest,
} from "@repo/types";
import { z } from "zod";
import { apiGet, apiPatch, apiPost } from "./api-client";

/** Questionnaire boundary — thin wrappers over the API client, nothing more. */

export function pendingQuestionnaires(): Promise<Result<QuestionnaireAssignment[]>> {
  return apiGet("/questionnaires/assignments/pending", (raw) =>
    z.array(questionnaireAssignmentSchema).parse(raw),
  );
}

export function submitQuestionnaire(
  body: SubmitQuestionnaireRequest,
): Promise<Result<QuestionnaireResponse>> {
  return apiPost("/questionnaires/responses", body, (raw) => questionnaireResponseSchema.parse(raw));
}

export function responseHistory(patientId: string): Promise<Result<QuestionnaireResponse[]>> {
  return apiGet(`/questionnaires/responses?patientId=${encodeURIComponent(patientId)}`, (raw) =>
    z.array(questionnaireResponseSchema).parse(raw),
  );
}

export function listAlerts(): Promise<Result<AlertListItem[]>> {
  return apiGet("/alerts", (raw) => z.array(alertListItemSchema).parse(raw));
}

const okSchema = z.object({ ok: z.literal(true) });

export function acknowledgeAlert(alertId: string): Promise<Result<{ ok: true }>> {
  return apiPost(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, {}, (raw) =>
    okSchema.parse(raw),
  );
}

/* ---------------- Recurring schedules (team) ---------------- */

export function createSchedule(body: {
  patientId: string;
  kind: QuestionnaireKind;
  frequency: ScheduleFrequency;
}): Promise<Result<QuestionnaireSchedule>> {
  return apiPost("/questionnaires/schedules", body, (raw) => questionnaireScheduleSchema.parse(raw));
}

export function listSchedules(): Promise<Result<ScheduleListItem[]>> {
  return apiGet("/questionnaires/schedules", (raw) => z.array(scheduleListItemSchema).parse(raw));
}

export function updateSchedule(scheduleId: string, active: boolean): Promise<Result<QuestionnaireSchedule>> {
  return apiPatch(`/questionnaires/schedules/${encodeURIComponent(scheduleId)}`, { active }, (raw) =>
    questionnaireScheduleSchema.parse(raw),
  );
}
