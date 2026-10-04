import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPushNotification,
  createThreadRequestSchema,
  messagesQuerySchema,
  pushNotificationSchema,
  registerPushTokenRequestSchema,
  sendMessageRequestSchema,
  threadListItemSchema,
  threadSchema,
  toSafePushBody,
} from "../src/messaging.js";

const threadId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const patientId = "33333333-3333-4333-8333-333333333333";

describe("thread schemas", () => {
  it("accepts a well-formed thread", () => {
    const parsed = threadSchema.parse({
      id: threadId,
      tenantId,
      patientId,
      createdAt: new Date().toISOString(),
    });
    assert.equal(parsed.id, threadId);
  });

  it("rejects create-thread without a patient id", () => {
    assert.throws(() => createThreadRequestSchema.parse({}));
  });

  it("thread list item requires participants and counts", () => {
    assert.throws(() =>
      threadListItemSchema.parse({
        id: threadId,
        tenantId,
        patientId,
        createdAt: new Date().toISOString(),
        participantNames: [],
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      }),
    );
  });
});

describe("send message", () => {
  it("rejects empty and over-long bodies", () => {
    assert.throws(() => sendMessageRequestSchema.parse({ body: "   " }));
    assert.throws(() => sendMessageRequestSchema.parse({ body: "x".repeat(2001) }));
  });

  it("trims the body", () => {
    assert.equal(sendMessageRequestSchema.parse({ body: "  hello  " }).body, "hello");
  });

  it("messages query defaults limit to 50 and caps at 100", () => {
    assert.equal(messagesQuerySchema.parse({}).limit, 50);
    assert.throws(() => messagesQuerySchema.parse({ limit: 101 }));
  });
});

describe("nowhere-PHI notification rule", () => {
  it("push body never contains message content or names", () => {
    const body = toSafePushBody("team_to_family");
    assert.equal(body, "You have a new message from your care team");
    assert.equal(toSafePushBody("family_to_team"), "New message from a family");
  });

  it("push notification carries only the thread id in data", () => {
    const notif = buildPushNotification(
      "Pine Haven Hospice",
      "team_to_family",
      threadId as never,
    );
    const parsed = pushNotificationSchema.parse(notif);
    assert.deepEqual(parsed.data, { kind: "new_message", threadId });
    assert.ok(!JSON.stringify(parsed).includes("secret body"));
  });

  it("push payload variants carry no content or name fields", () => {
    const options = pushNotificationSchema.shape.data.options;
    const shapes = options.map((o) => Object.keys(o.shape).sort());
    assert.deepEqual(shapes, [
      ["kind", "threadId"],
      ["kind"],
    ]);
    // no variant may ever grow a content/name field — this test guards the type
    for (const keys of shapes) {
      assert.ok(
        !keys.includes("body") && !keys.includes("senderName") && !keys.includes("patientName"),
      );
    }
  });

  it("register push token requires a token", () => {
    assert.throws(() => registerPushTokenRequestSchema.parse({ token: "" }));
  });
});
