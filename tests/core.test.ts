import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCompletedAttempt,
  createAttempt,
  defaultState,
  effectiveAttemptEndTime,
  eligibleQuestions,
  esatPacedDurationMs,
  finalizeAttempt,
  isAttemptExpired,
  isReadinessEvidence,
  mergeState,
  MIN_REPRESENTATIVE_QUESTIONS,
  moduleStats,
  remainingMs,
  scoreEstimateEligibility,
  storageKeyForUser,
  touchSyncSection,
  type Attempt,
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
  assert.equal(isAttemptExpired(attempt, attempt.endsAt ?? 0), true);
  assert.equal(
    isAttemptExpired({ ...attempt, pausedAt: attempt.startedAt + 10_000 }, (attempt.endsAt ?? 0) + 1_000_000),
    false,
  );
});

test("a delayed timeout finalizes at the deadline rather than browser wake time", () => {
  const item = question("q1");
  const attempt = createAttempt({ questions: [item], module: "maths1", mode: "exam", durationMinutes: 40, strictTimed: true, generated: true, progress: {} });
  const deadline = attempt.endsAt ?? 0;
  const lateWake = deadline + 600_000;
  attempt.responses.q1.selectedAnswer = "A";

  assert.equal(effectiveAttemptEndTime(attempt, true, lateWake), deadline);
  const finalized = finalizeAttempt(attempt, { q1: item }, true, lateWake);
  assert.equal(finalized.endedAt, deadline);
  assert.equal(finalized.durationMs, 2_400_000);
  assert.equal(finalized.responses.q1.timeSpentMs, 2_400_000);
  assert.equal(finalized.completionStatus, "timed-out");
});

test("manual submission excludes an in-progress pause from active duration", () => {
  const item = question("q1");
  const attempt = createAttempt({ questions: [item], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const pausedAt = attempt.startedAt + 10_000;
  const paused = {
    ...attempt,
    pausedAt,
    lastVisitStartedAt: pausedAt,
    responses: {
      q1: { ...attempt.responses.q1, timeSpentMs: 10_000 },
    },
  };
  const finalized = finalizeAttempt(paused, { q1: item }, false, pausedAt + 90_000);
  assert.equal(finalized.durationMs, 10_000);
  assert.equal(finalized.pausedAt, null);
});

test("historic paper limits preserve the exact ESAT pace", () => {
  assert.equal(esatPacedDurationMs(27), 2_400_000);
  assert.equal(esatPacedDurationMs(20), 1_777_778);
  assert.equal(esatPacedDurationMs(0), 0);
});

test("adaptive plan settings migrate safely from older or malformed stored state", () => {
  assert.equal(mergeState({ settings: { ...defaultState().settings, adaptivePlanMinutes: 74 } }).settings.adaptivePlanMinutes, 75);
  assert.equal(mergeState({ settings: { ...defaultState().settings, adaptivePlanMinutes: 999 } }).settings.adaptivePlanMinutes, 120);
  assert.equal(mergeState({ settings: { ...defaultState().settings, adaptivePlanMinutes: Number.NaN } }).settings.adaptivePlanMinutes, 45);
  const legacy = structuredClone(defaultState()) as unknown as { settings: Record<string, unknown> };
  delete legacy.settings.adaptivePlanMinutes;
  assert.equal(mergeState(legacy as never).settings.adaptivePlanMinutes, 45);
});

test("personal defaults and sync metadata migrate without stale or invalid timestamps", () => {
  const state = defaultState();
  assert.equal(state.settings.examDate, "");
  assert.deepEqual(state.syncMetadata, { settings: 0, targets: 0, notes: 0 });
  const migrated = mergeState({
    syncMetadata: { settings: 123.9, targets: Number.NaN, notes: -5 },
  });
  assert.deepEqual(migrated.syncMetadata, { settings: 123, targets: 0, notes: 0 });
  const touched = touchSyncSection(migrated, "settings", 200);
  assert.equal(touched.syncMetadata.settings, 200);
  assert.equal(touchSyncSection(touched, "settings", 150).syncMetadata.settings, 200);
});

test("user-scoped storage keys are stable, encoded and collision-resistant", () => {
  const first = storageKeyForUser("user/a");
  assert.equal(first, storageKeyForUser("user/a"));
  assert.notEqual(first, storageKeyForUser("user%2Fa"));
  assert.equal(first.includes("/"), false);
  assert.throws(() => storageKeyForUser(""), /non-empty Firebase UID/);
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

const SEEN_ONCE = {
  neverSeen: false, firstSeenAt: 1, firstAttemptCorrect: true, firstAttemptTime: 1,
  firstAttemptMode: "exam" as const, totalAttempts: 1, totalCorrect: 1, totalIncorrect: 0,
  mostRecentResult: true, mastered: false, exposureCount: 1, lastAttemptedAt: 1,
};

/** A full-length fresh strict paper: the only shape that counts as readiness evidence. */
function representativePaper(): { attempt: Attempt; map: Record<string, Question> } {
  const items = Array.from({ length: MIN_REPRESENTATIVE_QUESTIONS }, (_, index) => question(`q${index + 1}`));
  const map = Object.fromEntries(items.map((item) => [item.id, item]));
  const attempt = createAttempt({ questions: items, module: "maths1", mode: "exam", durationMinutes: 40, strictTimed: true, generated: true, progress: {} });
  for (const item of items) attempt.responses[item.id].selectedAnswer = "A";
  return { attempt: finalizeAttempt(attempt, map, false, attempt.startedAt + 10_000), map };
}

test("readiness statistics use fresh responses separately from retakes", () => {
  const { attempt: first, map } = representativePaper();
  const retry = createAttempt({ questions: [map.q1], module: "maths1", mode: "retry", durationMinutes: null, strictTimed: false, generated: true, progress: { q1: SEEN_ONCE } });
  retry.responses.q1.selectedAnswer = "B";
  const second = finalizeAttempt(retry, map, false, retry.startedAt + 10_000);
  const stats = moduleStats([first, second], "maths1");
  assert.equal(stats.freshAccuracy, 1);
  assert.equal(stats.retakeAccuracy, 0);
  assert.equal(stats.freshAttemptCount, 1);
});

test("only a complete, fresh, strictly timed full-length paper is readiness evidence", () => {
  const { attempt: paper } = representativePaper();
  assert.equal(scoreEstimateEligibility(paper), "eligible");
  assert.equal(isReadinessEvidence(paper), true);

  // Each disqualifying condition, reported one at a time.
  assert.equal(scoreEstimateEligibility({ ...paper, rawScore: null }), "incomplete");
  assert.equal(scoreEstimateEligibility({ ...paper, mode: "retry" }), "retrieval");
  assert.equal(scoreEstimateEligibility({ ...paper, mode: "practice" }), "practice");
  assert.equal(scoreEstimateEligibility({ ...paper, mode: "original" }), "original");
  assert.equal(scoreEstimateEligibility({ ...paper, strictTimed: false }), "not-strict");
  assert.equal(scoreEstimateEligibility({ ...paper, freshQuestionCount: paper.questionIds.length - 1 }), "repeated");

  const short = paper.questionIds.slice(0, MIN_REPRESENTATIVE_QUESTIONS - 1);
  assert.equal(
    scoreEstimateEligibility({ ...paper, questionIds: short, freshQuestionCount: short.length }),
    "too-short",
  );

  // A short set must not reach the readiness average even when every answer is correct.
  const shortPaper = { ...paper, questionIds: short, freshQuestionCount: short.length, rawScore: short.length };
  assert.equal(moduleStats([shortPaper], "maths1").freshAttemptCount, 0);
  assert.equal(moduleStats([shortPaper], "maths1").recentAccuracy, null);
});
