import {
  createVisitNoteRequestSchema,
  updateVisitNoteRequestSchema,
  visitNoteSchema,
  type CreateVisitNoteRequest,
  type Result,
  type UpdateVisitNoteRequest,
  type VisitNote,
} from "@repo/types";
import { z } from "zod";
import { apiGet, apiPatch, apiPost } from "./api-client";

/** Visit notes boundary — thin wrappers over the API client, nothing more. */

export function createVisitNote(
  visitId: string,
  body: CreateVisitNoteRequest,
): Promise<Result<VisitNote>> {
  const parsed = createVisitNoteRequestSchema.parse(body);
  return apiPost(`/visits/${encodeURIComponent(visitId)}/notes`, parsed, (raw) =>
    visitNoteSchema.parse(raw),
  );
}

export function listVisitNotes(visitId: string): Promise<Result<VisitNote[]>> {
  return apiGet(`/visits/${encodeURIComponent(visitId)}/notes`, (raw) =>
    z.array(visitNoteSchema).parse(raw),
  );
}

export function updateVisitNote(
  noteId: string,
  body: UpdateVisitNoteRequest,
): Promise<Result<VisitNote>> {
  const parsed = updateVisitNoteRequestSchema.parse(body);
  return apiPatch(`/notes/${encodeURIComponent(noteId)}`, parsed, (raw) =>
    visitNoteSchema.parse(raw),
  );
}
