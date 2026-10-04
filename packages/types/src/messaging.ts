import { z } from "zod";
import {
  messageIdSchema,
  patientIdSchema,
  tenantIdSchema,
  threadIdSchema,
  userIdSchema,
  type ThreadId,
} from "./branded.js";
import { userRoleSchema } from "./roles.js";

const e164Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "must be E.164 format");

export const messageDirectionSchema = z.enum(["family_to_team", "team_to_family"]);
export type MessageDirection = z.infer<typeof messageDirectionSchema>;

export const messageSchema = z.object({
  id: messageIdSchema,
  tenantId: tenantIdSchema,
  threadId: threadIdSchema,
  senderId: userIdSchema,
  senderRole: userRoleSchema,
  direction: messageDirectionSchema,
  body: z.string().min(1).max(4000),
  sentAt: z.string().datetime(),
});
export type Message = z.infer<typeof messageSchema>;

/** Message with the sender's display name resolved — what list views render. */
export const messageWithSenderSchema = messageSchema.extend({
  senderName: z.string().min(1),
});
export type MessageWithSender = z.infer<typeof messageWithSenderSchema>;

/**
 * Push payloads must NEVER contain PHI. This helper is the only sanctioned way
 * to build a push body — generic text, full content loads after authenticated open.
 */
export function toSafePushBody(direction: MessageDirection): string {
  return direction === "family_to_team"
    ? "New message from a family"
    : "You have a new message from your care team";
}

export const smsSendRequestSchema = z.object({
  to: e164Phone,
  body: z.string().min(1).max(1600),
});
export type SmsSendRequest = z.infer<typeof smsSendRequestSchema>;

export const threadSchema = z.object({
  id: threadIdSchema,
  tenantId: tenantIdSchema,
  patientId: patientIdSchema,
  createdAt: z.string().datetime(),
});
export type Thread = z.infer<typeof threadSchema>;

/** A thread row for list views: participants' display names ride along (authenticated context only — never in push payloads). */
export const threadListItemSchema = threadSchema.extend({
  participantNames: z.array(z.string().min(1)).min(1),
  lastMessageAt: z.string().datetime(),
  unreadCount: z.number().int().min(0),
});
export type ThreadListItem = z.infer<typeof threadListItemSchema>;

export const createThreadRequestSchema = z.object({
  patientId: patientIdSchema,
});
export type CreateThreadRequest = z.infer<typeof createThreadRequestSchema>;

export const sendMessageRequestSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const messagesQuerySchema = z.object({
  cursor: messageIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

export const registerPushTokenRequestSchema = z.object({
  /** Expo push token, e.g. ExponentPushToken[...]. */
  token: z.string().min(1).max(256),
});
export type RegisterPushTokenRequest = z.infer<typeof registerPushTokenRequestSchema>;

/**
 * The ONLY push payload shapes the API may send. `new_message` carries the
 * thread id so the app can deep-link after an authenticated open; `care_alert`
 * carries nothing patient-specific at all. Neither shape has a field for
 * message content, sender names, or patient names — PHI cannot be smuggled
 * through because the type has nowhere to put it.
 */
export const pushPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("new_message"), threadId: threadIdSchema }),
  z.object({ kind: z.literal("care_alert") }),
]);
export type PushPayload = z.infer<typeof pushPayloadSchema>;

export const pushNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  data: pushPayloadSchema,
});
export type PushNotification = z.infer<typeof pushNotificationSchema>;

/** Build the push notification for a new message. The body is always generic — see toSafePushBody. */
export function buildPushNotification(
  agencyName: string,
  direction: MessageDirection,
  threadId: ThreadId,
): PushNotification {
  return {
    title: agencyName,
    body: toSafePushBody(direction),
    data: { kind: "new_message", threadId },
  };
}

/** Build the push notification for a red-flag care alert. Generic body — the alert loads after an authenticated open. */
export function buildAlertPushNotification(agencyName: string): PushNotification {
  return {
    title: agencyName,
    body: "A care alert needs your review",
    data: { kind: "care_alert" },
  };
}
