import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMBRIDGE_CONTEXT,
  ESAT_SCORE_DISTRIBUTIONS,
  SCORE_CURVE,
  SCORE_MODEL,
  cambridgeContextFor,
  combinedScoreEstimate,
  estimatedScaledScore,
  ordinal,
  pacingSummary,
  scaledScorePercentile,
  scoreEstimate,
  sectionBreakdown,
} from "../app/lib/scoring";
import { MODULE_ORDER, type ModuleId, type Question, type ResponseRecord } from "../app/lib/core";

function response(overrides: Partial<ResponseRecord> & { questionId: string }): ResponseRecord {
  return {
    selectedAnswer: null, firstSelectedAnswer: null, finalAnswer: null,
    correct: null, unanswered: false, timeSpentMs: 0, visits: 1, flagged: false, confidence: null,
    answerChanges: [], errorClassifications: [], firstExposure: true, timestamps: [], ...overrides,
  };
}

function question(id: string, topic: string): Question {
  return {
    id, questionBankVersion: "test", year: 2020, sourceExam: "NSAA", sourcePaper: "test",
    sourceSection: "Section 1", sourcePart: "A", originalQuestionNumber: 1, sourcePage: 1, sourcePages: [1],
    targetModule: "maths1", esatTopic: topic, esatSubtopic: topic, specificationVersion: "ESAT-2026-v7.1.1",
    answerOptions: ["A", "B", "C", "D"], correctAnswer: "A", excluded: false, exclusionReason: null,
    reviewRequired: false, importConfidence: "high", sourceHash: id, imageHash: id, searchText: id,
  };
}

test("every published module distribution is complete and sums to 100%", () => {
  for (const module of MODULE_ORDER) {
    const bins = ESAT_SCORE_DISTRIBUTIONS[module];
    assert.equal(bins.length, 17, `${module} must cover 1.0 to 9.0 in half-point steps`);
    assert.equal(bins[0].score, 1.0);
    assert.equal(bins[bins.length - 1].score, 9.0);
    const total = bins.reduce((sum, bin) => sum + bin.percent, 0);
    assert.ok(Math.abs(total - 100) < 0.6, `${module} sums to ${total.toFixed(1)}%, expected 100%`);
    for (let index = 1; index < bins.length; index += 1) {
      assert.ok(Math.abs(bins[index].score - bins[index - 1].score - 0.5) < 1e-9, `${module} bins must be evenly spaced`);
    }
  }
});

test("each published distribution reproduces the stated 10% above 7.0", () => {
  for (const module of MODULE_ORDER) {
    const atOrAbove = 100 - scaledScorePercentile(7.0, module);
    assert.ok(atOrAbove > 6 && atOrAbove < 14, `${module}: ${atOrAbove.toFixed(1)}% at or above 7.0, expected about 10%`);
  }
});

test("each published distribution puts the typical candidate near 4.5", () => {
  for (const module of MODULE_ORDER) {
    const percentile = scaledScorePercentile(SCORE_MODEL.typicalScore, module);
    assert.ok(percentile > 35 && percentile < 65, `${module}: 4.5 sits at the ${percentile.toFixed(0)}th percentile`);
  }
});

test("the score curve is monotone and stays inside the reported 1.0-9.0 scale", () => {
  let previousPercent = -1;
  let previousScore = -1;
  for (const point of SCORE_CURVE) {
    assert.ok(point.percentCorrect > previousPercent);
    assert.ok(point.scaledScore > previousScore);
    assert.ok(point.scaledScore >= SCORE_MODEL.scaleMin && point.scaledScore <= SCORE_MODEL.scaleMax);
    previousPercent = point.percentCorrect;
    previousScore = point.scaledScore;
  }
  assert.equal(SCORE_CURVE[0].percentCorrect, 0);
  assert.equal(SCORE_CURVE[SCORE_CURVE.length - 1].percentCorrect, 100);
});

test("the curve is pinned to the two published anchors", () => {
  assert.equal(estimatedScaledScore(0.5), SCORE_MODEL.typicalScore);
  assert.equal(estimatedScaledScore(0.8), 7);
});

test("percentiles rise monotonically with the score", () => {
  for (const module of [...MODULE_ORDER, null] as Array<ModuleId | null>) {
    let previous = -1;
    for (let score = 1; score <= 9; score += 0.1) {
      const percentile = scaledScorePercentile(Math.round(score * 10) / 10, module);
      assert.ok(percentile >= previous - 1e-9, `${module}: percentile fell at ${score.toFixed(1)}`);
      previous = percentile;
    }
  }
});

test("estimates clamp at both ends and never invent precision", () => {
  assert.equal(scoreEstimate(0, 27).scaledScore, 1);
  assert.equal(scoreEstimate(27, 27).scaledScore, 9);
  assert.equal(scoreEstimate(30, 27).accuracy, 1, "a raw score above the count cannot exceed 100%");
  assert.equal(scoreEstimate(5, 0).questionCount, 1, "an empty set must not divide by zero");
  assert.ok(scoreEstimate(27, 27).topPercent < scoreEstimate(0, 27).topPercent);
});

test("standing wording never claims a top percentage below the typical candidate", () => {
  assert.equal(scoreEstimate(80, 100, "maths1").standing, "top 10%");
  const weak = scoreEstimate(20, 100, "maths1");
  assert.ok(weak.standing.endsWith("percentile"), `expected a percentile, got "${weak.standing}"`);
  assert.equal(ordinal(1), "1st");
  assert.equal(ordinal(2), "2nd");
  assert.equal(ordinal(3), "3rd");
  assert.equal(ordinal(11), "11th");
  assert.equal(ordinal(22), "22nd");
});

test("module-specific distributions actually differ from one another", () => {
  const maths1 = scoreEstimate(18, 27, "maths1").percentile;
  const physics = scoreEstimate(18, 27, "physics").percentile;
  assert.notEqual(maths1.toFixed(1), physics.toFixed(1), "the same raw score should not land identically in every module");
});

test("combined estimates aggregate raw marks, not averaged scores", () => {
  const combined = combinedScoreEstimate([
    { rawScore: 20, questionCount: 27 },
    { rawScore: 10, questionCount: 27 },
    { rawScore: 15, questionCount: 27 },
  ]);
  assert.ok(combined);
  assert.equal(combined.rawScore, 45);
  assert.equal(combined.questionCount, 81);
  assert.equal(combinedScoreEstimate([]), null);
});

test("Cambridge context is framed against offer-holder averages, never as a cut-off", () => {
  assert.equal(CAMBRIDGE_CONTEXT.offerHolderAverage, 6.1);
  assert.equal(cambridgeContextFor(7.5).tone, "good");
  assert.equal(cambridgeContextFor(6.1).tone, "neutral");
  assert.equal(cambridgeContextFor(3.0).tone, "bad");
  // No message may promise an outcome or imply a threshold the candidate must clear.
  for (const score of [2, 4, 6.1, 8]) {
    const { message } = cambridgeContextFor(score);
    assert.doesNotMatch(message, /guarantee|you (?:will|need)|required score|minimum score|pass mark/i, message);
    assert.match(message, /offer holders/i, message);
  }
  assert.match(SCORE_MODEL.noCutOff, /no pass or fail/i);
});

test("section breakdown groups by topic and orders the weakest first", () => {
  const questionMap: Record<string, Question> = {
    q1: question("q1", "Mechanics"), q2: question("q2", "Mechanics"),
    q3: question("q3", "Waves"), q4: question("q4", "Waves"),
  };
  const rows = sectionBreakdown(
    [
      response({ questionId: "q1", correct: true, timeSpentMs: 60_000 }),
      response({ questionId: "q2", correct: true, timeSpentMs: 40_000 }),
      response({ questionId: "q3", correct: false, timeSpentMs: 90_000 }),
      response({ questionId: "q4", correct: false, unanswered: true, timeSpentMs: 10_000 }),
      response({ questionId: "missing-from-bank", correct: true, timeSpentMs: 1000 }),
    ],
    questionMap,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, "Waves");
  assert.equal(rows[0].accuracy, 0);
  assert.equal(rows[0].unanswered, 1);
  assert.equal(rows[1].label, "Mechanics");
  assert.equal(rows[1].accuracy, 1);
  assert.equal(rows[1].averageMs, 50_000);
});

test("pacing is measured against the 40-minute, 27-question ESAT reference", () => {
  const responses = [
    response({ questionId: "q1", correct: false, timeSpentMs: 20_000 }),
    response({ questionId: "q2", correct: false, timeSpentMs: 260_000 }),
    response({ questionId: "q3", correct: true, timeSpentMs: 80_000 }),
    response({ questionId: "q4", correct: false, unanswered: true, timeSpentMs: 1_000 }),
  ];
  const summary = pacingSummary(responses, 4, 400_000);
  assert.equal(Math.round(summary.targetMsPerQuestion), Math.round((40 * 60_000) / 27));
  assert.equal(summary.rushedIncorrect, 1, "a blank must not be counted as a rushed wrong answer");
  assert.equal(summary.slowIncorrect, 1);
  assert.equal(summary.overtimeQuestions, 1);
});
