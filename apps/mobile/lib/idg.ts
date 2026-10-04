import {
  completeIdgSessionRequestSchema,
  createIdgSessionRequestSchema,
  idgSessionSchema,
  recordIdgConsentRequestSchema,
  type CompleteIdgSessionRequest,
  type CreateIdgSessionRequest,
  type IdgSession,
  type RecordIdgConsentRequest,
  type Result,
} from "@repo/types";
import { z } from "zod";
import { apiGet, apiPost } from "./api-client";

/** IDG boundary — thin wrappers over the API client, nothing more. */

export function createIdgSession(body: CreateIdgSessionRequest): Promise<Result<IdgSession>> {
  const parsed = createIdgSessionRequestSchema.parse(body);
  return apiPost("/idg/sessions", parsed, (raw) => idgSessionSchema.parse(raw));
}

export function listIdgSessions(): Promise<Result<IdgSession[]>> {
  return apiGet("/idg/sessions", (raw) => z.array(idgSessionSchema).parse(raw));
}

export function recordIdgConsent(
  sessionId: string,
  body: RecordIdgConsentRequest,
): Promise<Result<IdgSession>> {
  const parsed = recordIdgConsentRequestSchema.parse(body);
  return apiPost(`/idg/sessions/${encodeURIComponent(sessionId)}/consent`, parsed, (raw) =>
    idgSessionSchema.parse(raw),
  );
}

export function startIdgRecording(sessionId: string): Promise<Result<IdgSession>> {
  return apiPost(`/idg/sessions/${encodeURIComponent(sessionId)}/start`, {}, (raw) =>
    idgSessionSchema.parse(raw),
  );
}

export function completeIdgSession(
  sessionId: string,
  body: CompleteIdgSessionRequest,
): Promise<Result<IdgSession>> {
  const parsed = completeIdgSessionRequestSchema.parse(body);
  return apiPost(`/idg/sessions/${encodeURIComponent(sessionId)}/complete`, parsed, (raw) =>
    idgSessionSchema.parse(raw),
  );
}
