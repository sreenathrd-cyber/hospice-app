import { z } from "zod";
import { patientIdSchema, userIdSchema, visitIdSchema } from "./branded.js";

/** How a visit happens. Mirrors the visit_type enum in @repo/db. */
export const visitTypeSchema = z.enum(["in_person", "video", "phone"]);
export type VisitType = z.infer<typeof visitTypeSchema>;

/** Visit lifecycle. A visit is scheduled, goes live when someone joins, then completes. */
export const visitStatusSchema = z.enum(["scheduled", "in_progress", "completed", "cancelled"]);
export type VisitStatus = z.infer<typeof visitStatusSchema>;

export const visitSchema = z.object({
  id: visitIdSchema,
  patientId: patientIdSchema,
  clinicianId: userIdSchema,
  visitType: visitTypeSchema,
  status: visitStatusSchema,
  scheduledAt: z.string().datetime(),
  telnyxRoomId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});
export type Visit = z.infer<typeof visitSchema>;

export const scheduleVisitRequestSchema = z.object({
  patientId: patientIdSchema,
  /** Defaults to the scheduling team member. */
  clinicianId: userIdSchema.optional(),
  visitType: visitTypeSchema,
  scheduledAt: z.string().datetime(),
});
export type ScheduleVisitRequest = z.infer<typeof scheduleVisitRequestSchema>;

/** Visit with resolved names — what the lists render. */
export const visitListItemSchema = visitSchema.extend({
  patientName: z.string().min(1),
  clinicianName: z.string().min(1),
});
export type VisitListItem = z.infer<typeof visitListItemSchema>;

export const visitsQuerySchema = z.object({
  patientId: patientIdSchema.optional(),
});
export type VisitsQuery = z.infer<typeof visitsQuerySchema>;

/**
 * What the client needs to join a video visit. The Telnyx client token is
 * short-lived and room-scoped — the client must re-request rather than cache.
 * joinUrl is the hosted video page; the mobile app opens it in a WebView.
 */
export const visitJoinResponseSchema = z.object({
  roomId: z.string().min(1),
  token: z.string().min(1),
  joinUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type VisitJoinResponse = z.infer<typeof visitJoinResponseSchema>;

/** Minimal patient directory entry for the team scheduler. */
export const patientDirectoryEntrySchema = z.object({
  id: patientIdSchema,
  displayName: z.string().min(1),
});
export type PatientDirectoryEntry = z.infer<typeof patientDirectoryEntrySchema>;
