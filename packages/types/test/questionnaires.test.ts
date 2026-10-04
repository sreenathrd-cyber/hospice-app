import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceDueDate,
  assignQuestionnaireRequestSchema,
  createScheduleRequestSchema,
  esasScoresSchema,
  esasTotal,
  ppsScoreSchema,
  phq2Gad2ScoresSchema,
  phq2Score,
  gad2Score,
  questionnaireAssignmentSchema,
  questionnaireResponseSchema,
  submitQuestionnaireRequestSchema,
  type EsasScores,
} from "../src/index";

const validEsas: EsasScores = {
  pain: 8,
  tiredness: 5,
  drowsiness: 2,
  nausea: 0,
  appetite: 6,
  shortnessOfBreath: 3,
  depression: 4,
  anxiety: 7,
  wellbeing: 5,
};

describe("ESAS schema", () => {
  it("accepts a valid 0–10 score set", () => {
    assert.equal(esasScoresSchema.safeParse(validEsas).success, true);
  });

  it("rejects out-of-range and non-integer scores", () => {
    assert.equal(esasScoresSchema.safeParse({ ...validEsas, pain: 11 }).success, false);
    assert.equal(esasScoresSchema.safeParse({ ...validEsas, pain: -1 }).success, false);
    assert.equal(esasScoresSchema.safeParse({ ...validEsas, pain: 4.5 }).success, false);
  });

  it("totals the nine symptoms", () => {
    assert.equal(esasTotal(validEsas), 40);
  });
});

describe("PPS schema", () => {
  it("accepts multiples of 10 within 0–100", () => {
    assert.equal(ppsScoreSchema.safeParse(70).success, true);
  });

  it("rejects non-multiples of 10 and out-of-range values", () => {
    assert.equal(ppsScoreSchema.safeParse(75).success, false);
    assert.equal(ppsScoreSchema.safeParse(110).success, false);
  });
});

describe("PHQ-2/GAD-2 schema", () => {
  it("scores the subscales correctly", () => {
    const scores = phq2Gad2ScoresSchema.parse({
      littleInterest: 2,
      feelingDown: 1,
      nervous: 3,
      worrying: 0,
    });
    assert.equal(phq2Score(scores), 3);
    assert.equal(gad2Score(scores), 3);
  });

  it("rejects scores above 3", () => {
    assert.equal(
      phq2Gad2ScoresSchema.safeParse({
        littleInterest: 4,
        feelingDown: 0,
        nervous: 0,
        worrying: 0,
      }).success,
      false,
    );
  });
});

describe("questionnaire response envelope", () => {
  it("parses a discriminated ESAS response", () => {
    const parsed = questionnaireResponseSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      patientId: "22222222-2222-4222-8222-222222222222",
      submittedAt: new Date().toISOString(),
      kind: "esas",
      scores: validEsas,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects a response whose scores do not match its kind", () => {
    const parsed = questionnaireResponseSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      patientId: "22222222-2222-4222-8222-222222222222",
      submittedAt: new Date().toISOString(),
      kind: "pps",
      scores: validEsas,
    });
    assert.equal(parsed.success, false);
  });
});

describe("assignment schemas", () => {
  it("accepts a pending assignment", () => {
    const parsed = questionnaireAssignmentSchema.parse({
      id: "44444444-4444-4444-8444-444444444444",
      tenantId: "33333333-3333-4333-8333-333333333333",
      patientId: "11111111-1111-4111-8111-111111111111",
      kind: "esas",
      status: "pending",
      dueAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    assert.equal(parsed.status, "pending");
  });

  it("assign request requires patient and kind; dueAt optional", () => {
    assert.ok(
      assignQuestionnaireRequestSchema.parse({
        patientId: "11111111-1111-4111-8111-111111111111",
        kind: "pps",
      }),
    );
    assert.throws(() => assignQuestionnaireRequestSchema.parse({ kind: "pps" }));
    assert.throws(() =>
      assignQuestionnaireRequestSchema.parse({
        patientId: "11111111-1111-4111-8111-111111111111",
        kind: "xray",
      }),
    );
  });
});

describe("submit request", () => {
  it("accepts a full ESAS submission", () => {
    const parsed = submitQuestionnaireRequestSchema.parse({
      assignmentId: "44444444-4444-4444-8444-444444444444",
      kind: "esas",
      scores: {
        pain: 8, tiredness: 5, drowsiness: 2, nausea: 0, appetite: 4,
        shortnessOfBreath: 1, depression: 3, anxiety: 6, wellbeing: 5,
      },
    });
    assert.equal(parsed.kind, "esas");
  });

  it("rejects out-of-range scores", () => {
    assert.throws(() =>
      submitQuestionnaireRequestSchema.parse({
        assignmentId: "44444444-4444-4444-8444-444444444444",
        kind: "esas",
        scores: {
          pain: 11, tiredness: 0, drowsiness: 0, nausea: 0, appetite: 0,
          shortnessOfBreath: 0, depression: 0, anxiety: 0, wellbeing: 0,
        },
      }),
    );
  });

  it("rejects PPS not in steps of 10", () => {
    assert.throws(() =>
      submitQuestionnaireRequestSchema.parse({
        assignmentId: "44444444-4444-4444-8444-444444444444",
        kind: "pps",
        scores: 45,
      }),
    );
  });
});

describe("advanceDueDate", () => {
  it("daily advances one day, weekly seven", () => {
    const from = new Date("2026-10-03T06:00:00.000Z");
    assert.equal(advanceDueDate(from, "daily").toISOString(), "2026-10-04T06:00:00.000Z");
    assert.equal(advanceDueDate(from, "weekly").toISOString(), "2026-10-10T06:00:00.000Z");
  });

  it("create schedule request defaults startAt", () => {
    const parsed = createScheduleRequestSchema.parse({
      patientId: "11111111-1111-4111-8111-111111111111",
      kind: "esas",
      frequency: "daily",
    });
    assert.equal(parsed.startAt, undefined);
    assert.throws(() =>
      createScheduleRequestSchema.parse({
        patientId: "11111111-1111-4111-8111-111111111111",
        kind: "esas",
        frequency: "hourly",
      }),
    );
  });
});
