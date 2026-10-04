import {
  messageWithSenderSchema,
  threadListItemSchema,
  threadSchema,
  type MessageWithSender,
  type Result,
  type Thread,
  type ThreadListItem,
} from "@repo/types";
import { z } from "zod";
import { apiGet, apiPost } from "./api-client";

/** Messaging boundary — thin wrappers over the API client, nothing more. */

export function listThreads(): Promise<Result<ThreadListItem[]>> {
  return apiGet("/threads", (raw) => z.array(threadListItemSchema).parse(raw));
}

export function createThread(patientId: string): Promise<Result<Thread>> {
  return apiPost("/threads", { patientId }, (raw) => threadSchema.parse(raw));
}

export function getMessages(threadId: string, cursor?: string): Promise<Result<MessageWithSender[]>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiGet(`/threads/${encodeURIComponent(threadId)}/messages${query}`, (raw) =>
    z.array(messageWithSenderSchema).parse(raw),
  );
}

export function sendMessage(threadId: string, body: string): Promise<Result<MessageWithSender>> {
  return apiPost(`/threads/${encodeURIComponent(threadId)}/messages`, { body }, (raw) =>
    messageWithSenderSchema.parse(raw),
  );
}

const okSchema = z.object({ ok: z.literal(true) });

export function markThreadRead(threadId: string): Promise<Result<{ ok: true }>> {
  return apiPost(`/threads/${encodeURIComponent(threadId)}/read`, {}, (raw) =>
    okSchema.parse(raw),
  );
}

export function registerPushToken(token: string): Promise<Result<{ ok: true }>> {
  return apiPost("/notifications/push-token", { token }, (raw) => okSchema.parse(raw));
}
