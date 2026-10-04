import { z } from "zod";
import { patientIdSchema, tenantIdSchema, userIdSchema, visitIdSchema } from "./branded.js";

/**
 * Visit notes: transcription → structured note → clinician approve → file.
 *
 * The transcript enters as text (pasted, dictated, or from a transcription
 * provider — see the TranscriptionProvider seam in apps/api). The clinician
 * structures it into sections, approves it, and files it to the chart.
 * Status only moves forward: draft → approved → filed.
 */
export const visitNoteIdSchema = z
  .string()
  .uuid()
  .brand<"VisitNoteId">();
export type VisitNoteId = z.infer<typeof visitNoteIdSchema>;

export const visitNoteStatusSchema = z.enum(["draft", "approved", "filed"]);
export type VisitNoteStatus = z.infer<typeof visitNoteStatusSchema>;

/** Structured sections of a hospice visit note. All optional — the clinician fills what applies. */
export const visitNoteSectionsSchema = z.object({
  visitSummary: z.string().max(2000).optional(),
  observations: z.string().max(2000).optional(),
  interventions: z.string().max(2000).optional(),
  plan: z.string().max(2000).optional(),
  followUp: z.string().max(1000).optional(),
});
export type VisitNoteSections = z.infer<typeof visitNoteSectionsSchema>;

export const visitNoteSchema = z.object({
  id: visitNoteIdSchema,
  tenantId: tenantIdSchema,
  visitId: visitIdSchema,
  patientId: patientIdSchema,
  /** Raw transcript text, if any. Null when the note was written directly. */
  transcript: z.string().nullable(),
  sections: visitNoteSectionsSchema,
  status: visitNoteStatusSchema,
  createdBy: userIdSchema,
  approvedBy: userIdSchema.nullable(),
  createdAt: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
});
export type VisitNote = z.infer<typeof visitNoteSchema>;

export const createVisitNoteRequestSchema = z.object({
  transcript: z.string().max(20000).optional(),
  sections: visitNoteSectionsSchema.optional(),
});
export type CreateVisitNoteRequest = z.infer<typeof createVisitNoteRequestSchema>;

export const updateVisitNoteRequestSchema = z.object({
  sections: visitNoteSectionsSchema.optional(),
  /** Forward-only: draft → approved → filed. */
  status: visitNoteStatusSchema.optional(),
});
export type UpdateVisitNoteRequest = z.infer<typeof updateVisitNoteRequestSchema>;

/** Pure: is this status transition allowed? Status only moves forward. */
export function canTransitionNote(from: VisitNoteStatus, to: VisitNoteStatus): boolean {
  const order: VisitNoteStatus[] = ["draft", "approved", "filed"];
  return order.indexOf(to) === order.indexOf(from) + 1;
}
