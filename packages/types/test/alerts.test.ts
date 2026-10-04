import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_THRESHOLDS,
  evaluateBowelBladder,
  evaluateCaregiverWellbeing,
  evaluateEsas,
  evaluatePhq2Gad2,
  evaluatePps,
  evaluateResponse,
  type NewAlert,
} from "../src/index";

const PATIENT_ID = "22222222-2222-4222-8222-222222222222" as never;
const RESPONSE_ID = "11111111-1111-4111-8111-111111111111" as never;

const calm = {
  pain: 1,
  tiredness: 2,
  drowsiness: 1,
  nausea: 0,
  appetite: 2,
  shortnessOfBreath: 1,
  depression: 1,
  anxiety: 2,
  wellbeing: 3,
};

describe("evaluateEsas", () => {
  it("raises a red alert for a pain spike at 8/10", () => {
    const alerts: NewAlert[] = evaluateEsas(PATIENT_ID, RESPONSE_ID, { ...calm, pain: 8 });
    const pain = alerts.find((a) => a.symptom === "pain");
    assert.ok(pain);
    assert.equal(pain.severity, "red");
    assert.equal(pain.questionnaireKind, "esas");
  });

  it("raises a warning (not red) at 5/10", () => {
    const alerts = evaluateEsas(PATIENT_ID, RESPONSE_ID, { ...calm, pain: 5 });
    const pain = alerts.find((a) => a.symptom === "pain");
    assert.ok(pain);
    assert.equal(pain.severity, "warning");
  });

  it("raises nothing when all symptoms are mild", () => {
    assert.equal(evaluateEsas(PATIENT_ID, RESPONSE_ID, calm).length, 0);
  });

  it("flags every severe symptom independently", () => {
    const alerts = evaluateEsas(PATIENT_ID, RESPONSE_ID, {
      ...calm,
      pain: 9,
      anxiety: 8,
    });
    assert.equal(
      alerts.filter((a) => a.severity === "red").length,
      2,
    );
  });
});

describe("evaluatePhq2Gad2", () => {
  it("flags positive screens as red", () => {
    const alerts: NewAlert[] = evaluatePhq2Gad2(PATIENT_ID, RESPONSE_ID, {
      littleInterest: 2, feelingDown: 2, nervous: 0, worrying: 1,
    });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]?.severity, "red");
    assert.equal(alerts[0]?.symptom, "depression_screen");
  });

  it("stays quiet below threshold", () => {
    assert.equal(
      evaluatePhq2Gad2(PATIENT_ID, RESPONSE_ID, {
        littleInterest: 1, feelingDown: 1, nervous: 1, worrying: 0,
      }).length,
      0,
    );
  });
});

describe("evaluatePps", () => {
  it("red at 30 and below, warning at 50 and below", () => {
    assert.equal(evaluatePps(PATIENT_ID, RESPONSE_ID, 20)[0]?.severity, "red");
    assert.equal(evaluatePps(PATIENT_ID, RESPONSE_ID, 40)[0]?.severity, "warning");
    assert.equal(evaluatePps(PATIENT_ID, RESPONSE_ID, 80).length, 0);
  });
});

describe("evaluateBowelBladder", () => {
  it("flags constipation, vomiting, bladder difficulty", () => {
    const alerts = evaluateBowelBladder(PATIENT_ID, RESPONSE_ID, {
      bowelMovementRecency: "longer",
      bladderDifficulty: true,
      nauseaPresent: false,
      vomitingEpisodes: 4,
    });
    const severities = alerts.map((a) => a.severity).sort();
    assert.deepEqual(severities, ["red", "warning", "warning"]);
  });

  it("stays quiet when all clear", () => {
    assert.equal(
      evaluateBowelBladder(PATIENT_ID, RESPONSE_ID, {
        bowelMovementRecency: "today",
        bladderDifficulty: false,
        nauseaPresent: false,
        vomitingEpisodes: 0,
      }).length,
      0,
    );
  });
});

describe("evaluateCaregiverWellbeing", () => {
  it("flags high strain as red and low support as warning", () => {
    const alerts = evaluateCaregiverWellbeing(PATIENT_ID, RESPONSE_ID, {
      strain: 9, sleepQuality: 8, feelingSupported: 2,
    });
    assert.equal(alerts.length, 2);
    assert.ok(alerts.some((a) => a.severity === "red" && a.symptom === "caregiver_strain"));
  });

  it("stays quiet for a coping caregiver", () => {
    assert.equal(
      evaluateCaregiverWellbeing(PATIENT_ID, RESPONSE_ID, {
        strain: 3, sleepQuality: 7, feelingSupported: 8,
      }).length,
      0,
    );
  });
});

describe("evaluateResponse dispatcher", () => {
  it("routes every kind to its evaluator", () => {
    const red = evaluateResponse(PATIENT_ID, RESPONSE_ID, {
      kind: "esas",
      scores: {
        pain: 9, tiredness: 0, drowsiness: 0, nausea: 0, appetite: 0,
        shortnessOfBreath: 0, depression: 0, anxiety: 0, wellbeing: 0,
      },
    });
    assert.ok(red.length > 0 && red.every((a) => a.questionnaireKind === "esas"));

    const pps = evaluateResponse(PATIENT_ID, RESPONSE_ID, { kind: "pps", scores: 20 });
    assert.ok(pps.length > 0 && pps.every((a) => a.questionnaireKind === "pps"));
  });

  it("thresholds are sane constants", () => {
    assert.equal(ALERT_THRESHOLDS.version, 1);
    assert.ok(ALERT_THRESHOLDS.esasItemRed > ALERT_THRESHOLDS.esasItemWarning);
  });
});
