import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCode, generateToken, hashSecret, isExpired } from "../src/auth/auth.logic.js";

describe("auth logic", () => {
  it("generates 6-digit numeric codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      assert.match(code, /^\d{6}$/);
    }
  });

  it("generates unique tokens", () => {
    assert.notEqual(generateToken(), generateToken());
  });

  it("hashes deterministically and never returns the input", () => {
    const hash = hashSecret("482910");
    assert.equal(hash, hashSecret("482910"));
    assert.notEqual(hash, "482910");
    assert.equal(hash.length, 64);
  });

  it("detects expiry against the clock", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    assert.equal(isExpired(new Date("2026-10-03T11:59:59Z"), now), true);
    assert.equal(isExpired(new Date("2026-10-03T12:00:01Z"), now), false);
  });
});
