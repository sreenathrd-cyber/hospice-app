import { z } from "zod";
import { tenantIdSchema, userIdSchema } from "./branded.js";

/**
 * IDG (Interdisciplinary Group) ambient capture.
 *
 * The team schedules an IDG session with its attendees. Recording can't start
 * until every listed attendee has consented — fresh consent per session, no
 * blanket opt-ins. The transcript enters as text until a speech-to-text
 * provider is configured (same seam as visit notes); the session then closes
 * with structured sections.
 */
export const idgSessionIdSchema = z
  .string()
  .uuid()
  .brand<"IdgSessionId">();
export type IdgSessionId = z.infer<typeof idgSessionIdSchema>;

export const idgSessionStatusSchema = z.enum(["scheduled", "recording", "completed"]);
export type IdgSessionStatus = z.infer<typeof idgSessionStatusSchema>;

export const idgAttendeeSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  /** Null until this person consents to this session being recorded. */
  consentedAt: z.string().datetime().nullable(),
});
export type IdgAttendee = z.infer<typeof idgAttendeeSchema>;

/** Structured close-out of an IDG session. */
export const idgSectionsSchema = z.object({
  patientsDiscussed: z.string().max(3000).optional(),
  keyDecisions: z.string().max(3000).optional(),
  carePlanUpdates: z.string().max(3000).optional(),
  followUpActions: z.string().max(2000).optional(),
});
export type IdgSections = z.infer<typeof idgSectionsSchema>;

export const idgSessionSchema = z.object({
  id: idgSessionIdSchema,
  tenantId: tenantIdSchema,
  scheduledAt: z.string().datetime(),
  status: idgSessionStatusSchema,
  attendees: z.array(idgAttendeeSchema),
  transcript: z.string().nullable(),
  sections: idgSectionsSchema,
  createdBy: userIdSchema,
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type IdgSession = z.infer<typeof idgSessionSchema>;

export const createIdgSessionRequestSchema = z.object({
  scheduledAt: z.string().datetime(),
  attendees: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        role: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(30),
});
export type CreateIdgSessionRequest = z.infer<typeof createIdgSessionRequestSchema>;

export const recordIdgConsentRequestSchema = z.object({
  attendeeName: z.string().min(1).max(120),
});
export type RecordIdgConsentRequest = z.infer<typeof recordIdgConsentRequestSchema>;

export const completeIdgSessionRequestSchema = z.object({
  transcript: z.string().max(40000).optional(),
  sections: idgSectionsSchema.optional(),
});
export type CompleteIdgSessionRequest = z.infer<typeof completeIdgSessionRequestSchema>;

/** Pure: can this session start recording? Every attendee must have consented. */
export function idgReadyToRecord(attendees: IdgAttendee[]): boolean {
  return attendees.length > 0 && attendees.every((a) => a.consentedAt !== null);
}

/** Pure: forward-only status moves for an IDG session. */
export function canTransitionIdg(
  from: IdgSessionStatus,
  to: IdgSessionStatus,
): boolean {
  const order: IdgSessionStatus[] = ["scheduled", "recording", "completed"];
  return order.indexOf(to) === order.indexOf(from) + 1;
}
