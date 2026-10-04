import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scheduleVisitRequestSchema,
  visitJoinResponseSchema,
  visitListItemSchema,
  visitSchema,
  visitsQuerySchema,
} from "../src/index";

const VISIT_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const CLINICIAN_ID = "33333333-3333-4333-8333-333333333333";

describe("visit schemas", () => {
  it("accepts a scheduled video visit", () => {
    const visit = visitSchema.parse({
      id: VISIT_ID,
      patientId: PATIENT_ID,
      clinicianId: CLINICIAN_ID,
      visitType: "video",
      status: "scheduled",
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    assert.equal(visit.status, "scheduled");
    assert.equal(visit.telnyxRoomId, undefined);
  });

  it("rejects unknown status and type", () => {
    assert.throws(() =>
      scheduleVisitRequestSchema.parse({
        patientId: PATIENT_ID,
        visitType: "hologram",
        scheduledAt: new Date().toISOString(),
      }),
    );
  });

  it("schedule request allows omitting clinicianId (defaults to caller)", () => {
    const parsed = scheduleVisitRequestSchema.parse({
      patientId: PATIENT_ID,
      visitType: "phone",
      scheduledAt: new Date().toISOString(),
    });
    assert.equal(parsed.clinicianId, undefined);
  });

  it("list item requires resolved names", () => {
    assert.throws(() =>
      visitListItemSchema.parse({
        id: VISIT_ID,
        patientId: PATIENT_ID,
        clinicianId: CLINICIAN_ID,
        visitType: "video",
        status: "scheduled",
        scheduledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        clinicianName: "R. Nurse",
      }),
    );
  });

  it("join response requires room, token, and join URL", () => {
    const join = visitJoinResponseSchema.parse({
      roomId: "room-123",
      token: "tok-abc",
      joinUrl: "https://video.example.com/visit/join?roomId=room-123&token=tok-abc",
      expiresAt: new Date().toISOString(),
    });
    assert.ok(join.joinUrl.startsWith("https://"));
    assert.throws(() =>
      visitJoinResponseSchema.parse({
        roomId: "room-123",
        token: "tok-abc",
        joinUrl: "not-a-url",
        expiresAt: new Date().toISOString(),
      }),
    );
  });

  it("visits query patientId is optional", () => {
    assert.deepEqual(visitsQuerySchema.parse({}), {});
    assert.ok(visitsQuerySchema.parse({ patientId: PATIENT_ID }).patientId);
  });
});
