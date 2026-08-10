import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCompletedAttempt,
  createAttempt,
  defaultState,
  eligibleQuestions,
  esatPacedDurationMs,
  finalizeAttempt,
  moduleStats,
  remainingMs,
  type Question,
} from "../app/lib/core";

function question(id: string, answer = "A", excluded = false): Question {
  return {
    id,
    questionBankVersion: "test",
    year: 2023,
    sourceExam: "NSAA",
    sourcePaper: "paper.pdf",
    sourceSection: "Section 1",
    sourcePart: "A",
    originalQuestionNumber: 1,
    sourcePage: 1,
    sourcePages: [1],
    targetModule: "maths1",
    esatTopic: "Algebra",
    esatSubtopic: "Functions",
    specificationVersion: "test",
    questionImage: "/q.webp",
    answerOptions: ["A", "B", "C", "D"],
    correctAnswer: answer,
    excluded,
    exclusionReason: excluded ? "review" : null,
    reviewRequired: excluded,
    importConfidence: "high",
    sourceHash: "source",
    imageHash: "image",
    searchText: "",
  };
}

test("strict timer stores exact timestamps and derives remaining time", () => {
  const item = question("q1");
  const before = Date.now();
  const attempt = createAttempt({ questions: [item], module: "maths1", mode: "exam", durationMinutes: 40, strictTimed: true, generated: true, progress: {} });
  assert.equal((attempt.endsAt ?? 0) - attempt.startedAt, 2_400_000);
  assert.ok(attempt.startedAt >= before);
  assert.equal(remainingMs(attempt, attempt.startedAt + 35_000), 2_365_000);
  assert.equal(remainingMs({ ...attempt, pausedAt: attempt.startedAt + 10_000 }, attempt.startedAt + 99_000), 2_390_000);
  assert.equal(remainingMs(attempt, attempt.startedAt + 3_000_000), 0);
});

test("historic paper limits preserve the exact ESAT pace", () => {
  assert.equal(esatPacedDurationMs(27), 2_400_000);
  assert.equal(esatPacedDurationMs(20), 1_777_778);
  assert.equal(esatPacedDurationMs(0), 0);
});

test("scoring handles correct, incorrect and unanswered with no negative marks", () => {
  const items = [question("q1", "A"), question("q2", "B"), question("q3", "C")];
  const attempt = createAttempt({ questions: items, module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  attempt.responses.q1.selectedAnswer = "A";
  attempt.responses.q2.selectedAnswer = "A";
  const finalized = finalizeAttempt(attempt, Object.fromEntries(items.map((item) => [item.id, item])), false, attempt.startedAt + 30_000);
  assert.equal(finalized.rawScore, 1);
  assert.equal(finalized.responses.q1.correct, true);
  assert.equal(finalized.responses.q2.correct, false);
  assert.equal(finalized.responses.q3.unanswered, true);
});

test("freshness is permanent and retry mastery advances only after delayed successes", () => {
  const item = question("q1");
  const first = createAttempt({ questions: [item], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const firstFinished = finalizeAttempt(first, { q1: item }, false, first.startedAt + 10_000);
  let state = applyCompletedAttempt(defaultState(), firstFinished);
  assert.equal(state.progress.q1.neverSeen, false);
  assert.equal(state.progress.q1.firstAttemptCorrect, false);
  assert.equal(state.mistakes.q1.correctStreak, 0);

  const retry = createAttempt({ questions: [item], module: "maths1", mode: "retry", durationMinutes: null, strictTimed: false, generated: true, progress: state.progress });
  assert.equal(retry.responses.q1.firstExposure, false);
  retry.responses.q1.selectedAnswer = "A";
  state = applyCompletedAttempt(state, finalizeAttempt(retry, { q1: item }, false, retry.startedAt + 8_000));
  assert.equal(state.mistakes.q1.correctStreak, 1);
  assert.equal(state.mistakes.q1.intervalDays, 3);
  assert.equal(state.progress.q1.mastered, false);
});

test("excluded or unresolved questions cannot enter sessions", () => {
  const held = question("held", "A", true);
  assert.equal(eligibleQuestions([held], "maths1").length, 0);
  assert.equal(eligibleQuestions([question("verified")], "maths1").length, 1);
});

test("attempts preserve exact source provenance and authored bank version", () => {
  const item = {
    ...question("original-q1"),
    questionBankVersion: "original-v1",
    sourceExam: "ESAT Atlas Original",
    sourcePaper: "Challenge Mock A",
    year: 2026,
    questionImage: undefined,
    questionText: "An original checked question",
    authored: true,
  };
  const attempt = createAttempt({ questions: [item], module: "maths1", mode: "original", durationMinutes: 40, strictTimed: true, generated: true, progress: {}, sequenceSource: "original" });
  assert.equal(attempt.questionBankVersion, "original-v1");
  assert.deepEqual(attempt.sourceExams, ["ESAT Atlas Original"]);
  assert.deepEqual(attempt.sourceYears, [2026]);
  assert.equal(attempt.sourceSetLabel, "ESAT Atlas Original 2026");
  assert.equal(attempt.sequenceSource, "original");
});

test("readiness statistics use fresh responses separately from retakes", () => {
  const item = question("q1");
  const strict = createAttempt({ questions: [item], module: "maths1", mode: "exam", durationMinutes: 40, strictTimed: true, generated: true, progress: {} });
  strict.responses.q1.selectedAnswer = "A";
  const first = finalizeAttempt(strict, { q1: item }, false, strict.startedAt + 10_000);
  const retry = createAttempt({ questions: [item], module: "maths1", mode: "retry", durationMinutes: null, strictTimed: false, generated: true, progress: { q1: { neverSeen: false, firstSeenAt: 1, firstAttemptCorrect: true, firstAttemptTime: 1, firstAttemptMode: "exam", totalAttempts: 1, totalCorrect: 1, totalIncorrect: 0, mostRecentResult: true, mastered: false, exposureCount: 1, lastAttemptedAt: 1 } } });
  retry.responses.q1.selectedAnswer = "B";
  const second = finalizeAttempt(retry, { q1: item }, false, retry.startedAt + 10_000);
  const stats = moduleStats([first, second], "maths1");
  assert.equal(stats.freshAccuracy, 1);
  assert.equal(stats.retakeAccuracy, 0);
  assert.equal(stats.freshAttemptCount, 1);
});
