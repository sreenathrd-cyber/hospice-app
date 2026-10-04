import { z } from "zod";
import { tenantIdSchema, userIdSchema } from "./branded.js";

/**
 * Audit trail: who accessed what PHI, when. Append-only — no endpoint may
 * update or delete entries. Record IDs only, never PHI content.
 */
export const auditActionSchema = z.enum([
  "login",
  "view",
  "create",
  "update",
  "approve",
  "file",
  "acknowledge",
  "consent",
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditRecordTypeSchema = z.enum([
  "user",
  "thread",
  "message",
  "questionnaire",
  "questionnaire_response",
  "alert",
  "visit",
  "visit_note",
  "sia_entry",
  "idg_session",
  "patient",
]);
export type AuditRecordType = z.infer<typeof auditRecordTypeSchema>;

export const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  actorId: userIdSchema,
  actorName: z.string(),
  action: auditActionSchema,
  recordType: auditRecordTypeSchema,
  /** The record's ID, or "list" for collection reads. Never PHI content. */
  recordId: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogQuerySchema = z.object({
  actorId: userIdSchema.optional(),
  recordType: auditRecordTypeSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Cursor: createdAt of the last entry on the previous page. */
  cursor: z.string().datetime().optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
