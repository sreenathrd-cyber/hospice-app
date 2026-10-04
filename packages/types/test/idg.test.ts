import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransitionIdg, idgReadyToRecord } from "../src/index";

describe("idgReadyToRecord", () => {
  it("requires every attendee consented", () => {
    assert.equal(idgReadyToRecord([]), false);
    assert.equal(
      idgReadyToRecord([{ name: "A", role: "RN", consentedAt: null }]),
      false,
    );
    assert.equal(
      idgReadyToRecord([
        { name: "A", role: "RN", consentedAt: "2026-10-03T10:00:00.000Z" },
        { name: "B", role: "MSW", consentedAt: null },
      ]),
      false,
    );
    assert.equal(
      idgReadyToRecord([
        { name: "A", role: "RN", consentedAt: "2026-10-03T10:00:00.000Z" },
        { name: "B", role: "MSW", consentedAt: "2026-10-03T10:01:00.000Z" },
      ]),
      true,
    );
  });
});

describe("canTransitionIdg", () => {
  it("moves forward only", () => {
    assert.equal(canTransitionIdg("scheduled", "recording"), true);
    assert.equal(canTransitionIdg("recording", "completed"), true);
    assert.equal(canTransitionIdg("scheduled", "completed"), false);
    assert.equal(canTransitionIdg("completed", "scheduled"), false);
  });
});
