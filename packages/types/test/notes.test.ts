import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransitionNote } from "../src/index";

describe("canTransitionNote", () => {
  it("moves forward only", () => {
    assert.equal(canTransitionNote("draft", "approved"), true);
    assert.equal(canTransitionNote("approved", "filed"), true);
  });

  it("rejects skips, stays, and backward moves", () => {
    assert.equal(canTransitionNote("draft", "filed"), false);
    assert.equal(canTransitionNote("draft", "draft"), false);
    assert.equal(canTransitionNote("approved", "draft"), false);
    assert.equal(canTransitionNote("filed", "approved"), false);
  });
});
