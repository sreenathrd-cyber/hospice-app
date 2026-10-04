import {
  patientDirectoryEntrySchema,
  scheduleVisitRequestSchema,
  visitJoinResponseSchema,
  visitListItemSchema,
  type PatientDirectoryEntry,
  type Result,
  type ScheduleVisitRequest,
  type VisitJoinResponse,
  type VisitListItem,
} from "@repo/types";
import { z } from "zod";
import { apiGet, apiPost } from "./api-client";

/** Visit boundary — thin wrappers over the API client, nothing more. */

export function listVisits(patientId?: string): Promise<Result<VisitListItem[]>> {
  const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  return apiGet(`/visits${qs}`, (raw) => z.array(visitListItemSchema).parse(raw));
}

export function scheduleVisit(body: ScheduleVisitRequest): Promise<Result<VisitListItem>> {
  const parsed = scheduleVisitRequestSchema.parse(body);
  return apiPost("/visits", parsed, (raw) => visitListItemSchema.parse(raw));
}

export function joinVisit(visitId: string): Promise<Result<VisitJoinResponse>> {
  return apiPost(`/visits/${encodeURIComponent(visitId)}/join`, {}, (raw) =>
    visitJoinResponseSchema.parse(raw),
  );
}

const okSchema = z.object({ ok: z.literal(true) });

export function completeVisit(visitId: string): Promise<Result<{ ok: true }>> {
  return apiPost(`/visits/${encodeURIComponent(visitId)}/complete`, {}, (raw) =>
    okSchema.parse(raw),
  );
}

export function patientDirectory(): Promise<Result<PatientDirectoryEntry[]>> {
  return apiGet("/patients", (raw) => z.array(patientDirectoryEntrySchema).parse(raw));
}
