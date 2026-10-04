import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_POLICY,
  requestCodeResponseSchema,
  requestCodeSchema,
  verifyCodeResponseSchema,
  verifyCodeSchema,
} from "../src/index.js";

describe("auth schemas", () => {
  it("accepts E.164 phone numbers", () => {
    assert.equal(requestCodeSchema.safeParse({ phone: "+12692905396" }).success, true);
  });

  it("rejects non-E.164 phone numbers", () => {
    assert.equal(requestCodeSchema.safeParse({ phone: "2692905396" }).success, false);
    assert.equal(requestCodeSchema.safeParse({ phone: "+1" }).success, false);
  });

  it("accepts a 6-digit code and rejects anything else", () => {
    const base = { phone: "+12692905396" };
    assert.equal(verifyCodeSchema.safeParse({ ...base, code: "482910" }).success, true);
    assert.equal(verifyCodeSchema.safeParse({ ...base, code: "48291" }).success, false);
    assert.equal(verifyCodeSchema.safeParse({ ...base, code: "abcdef" }).success, false);
  });

  it("parses the verify response shape", () => {
    const parsed = verifyCodeResponseSchema.safeParse({
      token: "abc123",
      userId: "22222222-2222-4222-8222-222222222222",
      role: "clinician",
      tenantId: "11111111-1111-4111-8111-111111111111",
      theme: { agencyName: "Pine Haven", primaryColor: "#1F6F5B" },
    });
    assert.equal(parsed.success, true);
  });

  it("rejects unknown roles in the verify response", () => {
    const parsed = requestCodeResponseSchema.safeParse({ sent: "yes" });
    assert.equal(parsed.success, false);
  });

  it("keeps the auth policy constants sane", () => {
    assert.ok(AUTH_POLICY.codeTtlMinutes > 0);
    assert.ok(AUTH_POLICY.codeMaxAttempts > 0);
    assert.ok(AUTH_POLICY.sessionTtlDays > 0);
  });
});
