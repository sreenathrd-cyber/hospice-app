import { z } from "zod";

/**
 * Branded IDs. A PatientId is never assignable to a CaregiverId, a TenantId,
 * etc. — the compiler catches cross-entity ID mixups at every boundary.
 */
export const tenantIdSchema = z.string().uuid().brand<"TenantId">();
export type TenantId = z.infer<typeof tenantIdSchema>;

export const userIdSchema = z.string().uuid().brand<"UserId">();
export type UserId = z.infer<typeof userIdSchema>;

export const patientIdSchema = z.string().uuid().brand<"PatientId">();
export type PatientId = z.infer<typeof patientIdSchema>;

export const visitIdSchema = z.string().uuid().brand<"VisitId">();
export type VisitId = z.infer<typeof visitIdSchema>;

export const messageIdSchema = z.string().uuid().brand<"MessageId">();
export type MessageId = z.infer<typeof messageIdSchema>;

export const threadIdSchema = z.string().uuid().brand<"ThreadId">();
export type ThreadId = z.infer<typeof threadIdSchema>;

export const questionnaireResponseIdSchema = z.string().uuid().brand<"QuestionnaireResponseId">();
export type QuestionnaireResponseId = z.infer<typeof questionnaireResponseIdSchema>;

export const alertIdSchema = z.string().uuid().brand<"AlertId">();
export type AlertId = z.infer<typeof alertIdSchema>;

export const siaEntryIdSchema = z.string().uuid().brand<"SiaEntryId">();
export type SiaEntryId = z.infer<typeof siaEntryIdSchema>;

export const auditLogIdSchema = z.string().uuid().brand<"AuditLogId">();
export type AuditLogId = z.infer<typeof auditLogIdSchema>;

export const questionnaireAssignmentIdSchema = z.string().uuid().brand<"QuestionnaireAssignmentId">();
export type QuestionnaireAssignmentId = z.infer<typeof questionnaireAssignmentIdSchema>;
