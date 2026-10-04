import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidPushToken, resolveDirection } from "../src/messaging/messaging.logic.js";

describe("resolveDirection", () => {
  it("maps patient/caregiver to family_to_team", () => {
    assert.equal(resolveDirection("patient"), "family_to_team");
    assert.equal(resolveDirection("caregiver"), "family_to_team");
  });

  it("maps clinician/admin to team_to_family", () => {
    assert.equal(resolveDirection("clinician"), "team_to_family");
    assert.equal(resolveDirection("admin"), "team_to_family");
  });
});

describe("isValidPushToken", () => {
  it("accepts Expo push tokens", () => {
    assert.equal(isValidPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"), true);
  });

  it("rejects anything else — never send pushes to unvalidated endpoints", () => {
    assert.equal(isValidPushToken(""), false);
    assert.equal(isValidPushToken("ExponentPushToken[abc"), false);
    assert.equal(isValidPushToken("fcm-token-123"), false);
  });
});
