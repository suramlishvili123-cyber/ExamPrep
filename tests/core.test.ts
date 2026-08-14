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
  settleCurrentVisit,
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

test("a malformed persisted record is coerced rather than trusted", () => {
  // Everything here is a type the interface would later call a method on: a string target
  // reaches .toFixed, a non-array attempts list reaches .map, a bad theme reaches the
  // document dataset. None of it can be assumed, because both localStorage and Firestore
  // are outside this application's control.
  const merged = mergeState({
    settings: {
      theme: "chartreuse",
      keyboardShortcuts: "yes",
      examDate: 20260814,
      weeklyHours: "abc",
      adaptivePlanMinutes: -5,
      pacingAid: 1,
      showScoreEstimate: 0,
    },
    targets: { maths1: "8.25", physics: 99, maths2: null },
    notes: { q1: "keep", q2: { nope: true } },
    attempts: { not: "an array" },
    progress: [1, 2, 3],
    mistakes: "corrupt",
  } as never);

  assert.equal(merged.settings.theme, "light");
  assert.equal(merged.settings.keyboardShortcuts, true);
  assert.equal(merged.settings.examDate, "");
  assert.equal(merged.settings.weeklyHours, 8);
  assert.equal(merged.settings.adaptivePlanMinutes, 15);
  assert.equal(merged.settings.pacingAid, false);
  assert.equal(merged.settings.showScoreEstimate, true);
  assert.deepEqual(merged.targets, { maths1: 8.3, physics: 9, maths2: 7 });
  assert.deepEqual(merged.notes, { q1: "keep" });
  assert.deepEqual(merged.attempts, []);
  assert.deepEqual(merged.progress, {});
  assert.deepEqual(merged.mistakes, {});
  assert.equal(typeof merged.targets.maths1.toFixed(1), "string");
});

test("attempts are ordered newest first regardless of how they were stored", () => {
  const at = (id: string, endedAt: number | null, startedAt = 0) => ({
    attemptId: id, questionIds: ["q1"], responses: {}, endedAt, startedAt,
  });
  const merged = mergeState({
    attempts: [at("old", 1_000), at("newest", 9_000), at("middle", 5_000), at("unfinished", null, 7_000)],
  } as never);

  assert.deepEqual(merged.attempts.map((item) => item.attemptId), ["newest", "unfinished", "middle", "old"]);
});

test("attempts that cannot be scored or reopened are dropped, not half-rendered", () => {
  const usable = createAttempt({ questions: [question("q1")], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const merged = mergeState({
    attempts: [
      usable,
      { attemptId: "", questionIds: [], responses: {} },
      { attemptId: "no-questions", responses: {} },
      { attemptId: "responses-are-an-array", questionIds: ["q1"], responses: [] },
      { questionIds: ["q1"], responses: {} },
      null,
    ],
    activeAttempt: { attemptId: "broken", questionIds: "nope" },
  } as never);

  assert.equal(merged.attempts.length, 1);
  assert.equal(merged.attempts[0].attemptId, usable.attemptId);
  assert.equal(merged.activeAttempt, null);
});

test("a legacy attempt keeps its identity while gaining current defaults", () => {
  const legacy = {
    attemptId: "legacy",
    questionIds: ["q1"],
    responses: { q1: { questionId: "q1", selectedAnswer: "A" } },
    module: "physics",
    mode: "historic",
    rawScore: 1,
    endedAt: 1_000,
  };
  const merged = mergeState({ attempts: [legacy] } as never);

  assert.equal(merged.attempts.length, 1);
  assert.equal(merged.attempts[0].attemptId, "legacy");
  assert.deepEqual(merged.attempts[0].sourceExams, []);
  assert.deepEqual(merged.attempts[0].sourceYears, []);
  assert.equal(merged.attempts[0].sequenceSource, "archive");
  assert.equal(merged.attempts[0].sourceSetLabel, "Practice set");
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

test("freshness is permanent and one correct redo clears the mistake", () => {
  const item = question("q1");
  const first = createAttempt({ questions: [item], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const firstFinished = finalizeAttempt(first, { q1: item }, false, first.startedAt + 10_000);
  let state = applyCompletedAttempt(defaultState(), firstFinished);
  assert.equal(state.progress.q1.neverSeen, false);
  assert.equal(state.progress.q1.firstAttemptCorrect, false);
  assert.equal(state.mistakes.q1.intervalDays, 1);

  const retry = createAttempt({ questions: [item], module: "maths1", mode: "retry", durationMinutes: null, strictTimed: false, generated: true, progress: state.progress });
  // First exposure is permanent: a later correct answer never rewrites it.
  assert.equal(retry.responses.q1.firstExposure, false);
  retry.responses.q1.selectedAnswer = "A";
  state = applyCompletedAttempt(state, finalizeAttempt(retry, { q1: item }, false, retry.startedAt + 8_000));

  assert.equal(state.mistakes.q1, undefined);
  assert.equal(state.progress.q1.mastered, true);
  assert.equal(state.progress.q1.firstAttemptCorrect, false);
});

test("progress and retrieval scheduling share one completion clock", () => {
  const item = question("q1");
  const attempt = createAttempt({ questions: [item], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const endedAt = attempt.startedAt + 10_000;
  const state = applyCompletedAttempt(defaultState(), finalizeAttempt(attempt, { q1: item }, false, endedAt));

  assert.equal(state.progress.q1.lastAttemptedAt, endedAt);
  assert.equal(state.mistakes.q1.dueDate, endedAt + 86_400_000);
});

test("a completion with no recorded end time still stamps a usable progress clock", () => {
  // A record rebuilt from an older or partially written cloud document can arrive with a
  // null endedAt. The merge in the client resolves per-question progress by comparing
  // lastAttemptedAt, so a null there would make an offline edit win or lose arbitrarily.
  const item = question("q1");
  const attempt = createAttempt({ questions: [item], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const finalized = finalizeAttempt(attempt, { q1: item }, false, attempt.startedAt + 10_000);
  const before = Date.now();
  const state = applyCompletedAttempt(defaultState(), { ...finalized, endedAt: null });

  const stamped = state.progress.q1.lastAttemptedAt;
  assert.equal(typeof stamped, "number");
  assert.equal(Number.isFinite(stamped ?? Number.NaN), true);
  assert.equal((stamped ?? 0) >= before, true);
});

test("a wrong redo re-queues the question rather than dropping it", () => {
  const item = question("q1");
  const first = createAttempt({ questions: [item], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  let state = applyCompletedAttempt(defaultState(), finalizeAttempt(first, { q1: item }, false, first.startedAt + 10_000));

  // "Once" means one correct answer, not one attempt: missing it again must not clear it.
  const retry = createAttempt({ questions: [item], module: "maths1", mode: "retry", durationMinutes: null, strictTimed: false, generated: true, progress: state.progress });
  retry.responses.q1.selectedAnswer = "B";
  const retryEnd = retry.startedAt + 8_000;
  state = applyCompletedAttempt(state, finalizeAttempt(retry, { q1: item }, false, retryEnd));

  assert.ok(state.mistakes.q1, "a still-wrong question must stay in the queue");
  assert.equal(state.mistakes.q1.dueDate, retryEnd + 86_400_000);
  assert.equal(state.progress.q1.mastered, false);
});

test("clearing a question is not permanent: missing it again re-queues it", () => {
  const item = question("q1");
  const first = createAttempt({ questions: [item], module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  let state = applyCompletedAttempt(defaultState(), finalizeAttempt(first, { q1: item }, false, first.startedAt + 10_000));

  const cleared = createAttempt({ questions: [item], module: "maths1", mode: "retry", durationMinutes: null, strictTimed: false, generated: true, progress: state.progress });
  cleared.responses.q1.selectedAnswer = "A";
  state = applyCompletedAttempt(state, finalizeAttempt(cleared, { q1: item }, false, 2_000_000));
  assert.equal(state.mistakes.q1, undefined);
  assert.equal(state.progress.q1.mastered, true);

  // Meeting it again in a later paper and getting it wrong restarts the cycle.
  const later = createAttempt({ questions: [item], module: "maths1", mode: "exam", durationMinutes: null, strictTimed: false, generated: true, progress: state.progress });
  later.responses.q1.selectedAnswer = "C";
  state = applyCompletedAttempt(state, finalizeAttempt(later, { q1: item }, false, 3_000_000));
  assert.ok(state.mistakes.q1);
  assert.equal(state.progress.q1.mastered, false);
  assert.equal(state.mistakes.q1.intervalDays, 1);
});

test("a queue entry left over from the older schedule is retired on load", () => {
  const migrated = mergeState({
    mistakes: {
      done: { questionId: "done", dueDate: 5_000, intervalDays: 14, correctStreak: 3, lastResult: true },
      open: { questionId: "open", dueDate: 6_000, intervalDays: 1, correctStreak: 0, lastResult: false },
    },
    progress: {
      done: { neverSeen: false, firstSeenAt: 1, firstAttemptCorrect: false, firstAttemptTime: 1, firstAttemptMode: "practice", totalAttempts: 4, totalCorrect: 3, totalIncorrect: 1, mostRecentResult: true, mastered: true, exposureCount: 4, lastAttemptedAt: 5 },
      open: { neverSeen: false, firstSeenAt: 1, firstAttemptCorrect: false, firstAttemptTime: 1, firstAttemptMode: "practice", totalAttempts: 1, totalCorrect: 0, totalIncorrect: 1, mostRecentResult: false, mastered: false, exposureCount: 1, lastAttemptedAt: 5 },
    },
  } as never);

  assert.equal(migrated.mistakes.done, undefined, "an already-cleared question must not linger in the queue");
  assert.ok(migrated.mistakes.open);
  assert.equal(migrated.progress.done.mastered, true);
});

test("per-question time records the visit and excludes time spent on the review list", () => {
  const items = [question("q1"), question("q2")];
  const map = Object.fromEntries(items.map((entry) => [entry.id, entry]));
  const attempt = createAttempt({ questions: items, module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const start = attempt.startedAt;

  // 30s on Q1, then move to Q2 and spend 45s there.
  const onQ2 = settleCurrentVisit({ ...attempt }, start + 30_000);
  const viewingQ2 = { ...onQ2, currentIndex: 1, lastVisitStartedAt: start + 30_000 };
  // The candidate opens the review list at +75s, then checks the paper for two minutes.
  const reviewOpenedAt = start + 75_000;
  const atReview = settleCurrentVisit(viewingQ2, reviewOpenedAt);
  const submittedAt = reviewOpenedAt + 120_000;

  const finalized = finalizeAttempt(atReview, map, false, submittedAt, atReview.lastVisitStartedAt);

  assert.equal(finalized.responses.q1.timeSpentMs, 30_000);
  assert.equal(finalized.responses.q2.timeSpentMs, 45_000);
  // The session still took the full time; only the per-question attribution excludes it.
  assert.equal(finalized.durationMs, 195_000);
});

test("review handover is correct whether or not the settle already applied", () => {
  const items = [question("q1")];
  const map = { q1: items[0] };
  const attempt = createAttempt({ questions: items, module: "maths1", mode: "practice", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const start = attempt.startedAt;
  const reviewOpenedAt = start + 60_000;
  const submittedAt = reviewOpenedAt + 90_000;

  // Committed: the visit was already settled to the review-open moment.
  const settled = settleCurrentVisit(attempt, reviewOpenedAt);
  const fromSettled = finalizeAttempt(settled, map, false, submittedAt, reviewOpenedAt);

  // Not yet committed: a timer expiry can reach finalize before React applies the settle.
  const fromUnsettled = finalizeAttempt(attempt, map, false, submittedAt, reviewOpenedAt);

  // Both must attribute the same 60s, and neither may charge the 90s of checking.
  assert.equal(fromSettled.responses.q1.timeSpentMs, 60_000);
  assert.equal(fromUnsettled.responses.q1.timeSpentMs, 60_000);
  assert.equal(fromSettled.durationMs, 150_000);
  assert.equal(fromUnsettled.durationMs, 150_000);
});

test("without the review handover the last question absorbs the checking time", () => {
  // Guards the default: a submission that did not leave the question still bills it.
  const items = [question("q1")];
  const attempt = createAttempt({ questions: items, module: "maths1", mode: "retry", durationMinutes: null, strictTimed: false, generated: true, progress: {} });
  const finalized = finalizeAttempt(attempt, { q1: items[0] }, false, attempt.startedAt + 42_000);
  assert.equal(finalized.responses.q1.timeSpentMs, 42_000);
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
