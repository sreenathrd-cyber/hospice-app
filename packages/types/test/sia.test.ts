import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SIA_MAX_UNITS_PER_DAY,
  SIA_RATE_PER_UNIT_DOLLARS,
  createSiaEntryRequestSchema,
  siaDollarsForDay,
  siaSummaryForEntries,
  siaUnitsForEntry,
} from "../src/index";

describe("SIA unit math", () => {
  it("converts minutes to whole 15-minute units, rounding up", () => {
    assert.equal(siaUnitsForEntry(15), 1);
    assert.equal(siaUnitsForEntry(16), 2);
    assert.equal(siaUnitsForEntry(45), 3);
    assert.equal(siaUnitsForEntry(60), 4);
  });

  it("prices units at $17.44 each", () => {
    assert.equal(siaDollarsForDay(4), 4 * SIA_RATE_PER_UNIT_DOLLARS);
  });

  it("enforces the 4-hour (16-unit) daily cap", () => {
    assert.equal(siaDollarsForDay(20), SIA_MAX_UNITS_PER_DAY * SIA_RATE_PER_UNIT_DOLLARS);
    assert.equal(siaDollarsForDay(16), 16 * SIA_RATE_PER_UNIT_DOLLARS);
  });
});

describe("siaSummaryForEntries", () => {
  const PID = "11111111-1111-4111-8111-111111111111" as never;

  it("groups by day and applies the 16-unit cap", () => {
    const summary = siaSummaryForEntries(PID, [
      { minutes: 60, occurredAt: "2026-10-01T10:00:00.000Z" }, // 4 units
      { minutes: 30, occurredAt: "2026-10-01T14:00:00.000Z" }, // +2 = 6 units
      { minutes: 500, occurredAt: "2026-10-02T10:00:00.000Z" }, // 34 units -> capped 16
    ]);
    assert.equal(summary.days.length, 2);
    assert.equal(summary.totalUnits, 40);
    assert.equal(summary.cappedUnits, 22);
    assert.equal(summary.dollars, Math.round(22 * 17.44 * 100) / 100);
  });

  it("rounds partial units up", () => {
    const summary = siaSummaryForEntries(PID, [{ minutes: 16, occurredAt: "2026-10-01T10:00:00.000Z" }]);
    assert.equal(summary.totalUnits, 2); // 16 min -> 2 units
  });

  it("empty entries give a zero summary", () => {
    const summary = siaSummaryForEntries(PID, []);
    assert.deepEqual([summary.totalMinutes, summary.totalUnits, summary.dollars], [0, 0, 0]);
  });

  it("create request rejects video-visit-shaped entries and bad minutes", () => {
    assert.ok(
      createSiaEntryRequestSchema.parse({
        visitId: "22222222-2222-4222-8222-222222222222",
        clinicianRole: "rn",
        minutes: 45,
        occurredAt: new Date().toISOString(),
      }),
    );
    assert.throws(() =>
      createSiaEntryRequestSchema.parse({
        visitId: "22222222-2222-4222-8222-222222222222",
        clinicianRole: "physician",
        minutes: 45,
        occurredAt: new Date().toISOString(),
      }),
    );
    assert.throws(() =>
      createSiaEntryRequestSchema.parse({
        visitId: "22222222-2222-4222-8222-222222222222",
        clinicianRole: "rn",
        minutes: 0,
        occurredAt: new Date().toISOString(),
      }),
    );
  });
});
