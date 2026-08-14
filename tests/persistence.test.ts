import assert from "node:assert/strict";
import test from "node:test";
import { compactForStorage, persistStoredState, type StorageLike } from "../app/lib/persistence";
import { defaultState, type Attempt, type ResponseRecord, type StoredState } from "../app/lib/core";

function response(questionId: string, changes: number): ResponseRecord {
  return {
    questionId,
    selectedAnswer: "C",
    firstSelectedAnswer: "A",
    finalAnswer: "C",
    correct: true,
    unanswered: false,
    timeSpentMs: 84_213,
    visits: 2,
    flagged: false,
    confidence: "Medium",
    answerChanges: Array.from({ length: changes }, (_, k) => ({ from: "A", to: "C", at: 1_760_000_000_000 + k })),
    errorClassifications: [],
    firstExposure: true,
    timestamps: Array.from({ length: changes }, (_, k) => 1_760_000_000_000 + k),
  };
}

function attempt(id: string, endedAt: number, questions = 27, changes = 4): Attempt {
  const questionIds = Array.from({ length: questions }, (_, i) => `${id}-q${i}`);
  return {
    attemptId: id,
    mode: "historic",
    module: "maths1",
    questionIds,
    questionBankVersion: "test",
    specificationVersion: "test",
    scoreConversionVersion: "test",
    benchmarkVersion: "test",
    startedAt: endedAt - 2_400_000,
    endsAt: endedAt,
    pausedAt: null,
    totalPausedDuration: 0,
    endedAt,
    durationMs: 2_400_000,
    strictTimed: true,
    generated: false,
    originalHistoricSet: true,
    sourceYears: [2019],
    sourceExams: ["NSAA"],
    sourceSetLabel: "NSAA 2019",
    sequenceSource: "archive",
    currentIndex: questions - 1,
    lastVisitStartedAt: endedAt,
    responses: Object.fromEntries(questionIds.map((q) => [q, response(q, changes)])),
    completionStatus: "submitted",
    rawScore: 18,
    freshQuestionCount: questions,
  };
}

function stateWith(attemptCount: number, active: Attempt | null = null): StoredState {
  return {
    ...defaultState(),
    attempts: Array.from({ length: attemptCount }, (_, n) => attempt(`a${n}`, 1_760_000_000_000 + n * 86_400_000)),
    activeAttempt: active,
    notes: { q1: "watch the sign convention" },
    syncMetadata: { settings: 5, targets: 6, notes: 7 },
  };
}

/** A store that refuses anything above `limit` bytes, as a browser quota does. */
function boundedStorage(limit: number): StorageLike & { value: string | null; writes: number } {
  return {
    value: null,
    writes: 0,
    setItem(_key: string, payload: string) {
      this.writes += 1;
      if (payload.length > limit) {
        const error = new Error("quota");
        error.name = "QuotaExceededError";
        throw error;
      }
      this.value = payload;
    },
  };
}

test("tier 0 stores the record exactly as given", () => {
  const state = stateWith(3);
  assert.equal(compactForStorage(state, 0), state);
});

test("tier 1 sheds only the fields nothing ever reads back", () => {
  const state = stateWith(2);
  const compacted = compactForStorage(state, 1);

  assert.equal(compacted.attempts.length, 2);
  for (const item of compacted.attempts) {
    for (const record of Object.values(item.responses)) {
      assert.deepEqual(record.answerChanges, []);
      assert.deepEqual(record.timestamps, []);
      // Everything the interface actually reads survives untouched.
      assert.equal(record.correct, true);
      assert.equal(record.timeSpentMs, 84_213);
      assert.equal(record.firstSelectedAnswer, "A");
      assert.equal(record.finalAnswer, "C");
      assert.equal(record.confidence, "Medium");
    }
  }
  assert.ok(JSON.stringify(compacted).length < JSON.stringify(state).length);
});

test("compaction never mutates the live state", () => {
  const state = stateWith(2);
  const before = JSON.stringify(state);
  compactForStorage(state, 4);
  assert.equal(JSON.stringify(state), before);
});

test("higher tiers keep the newest results and drop the oldest", () => {
  const state = stateWith(60);
  const tier2 = compactForStorage(state, 2);
  const tier3 = compactForStorage(state, 3);
  const tier4 = compactForStorage(state, 4);

  assert.equal(tier2.attempts.length, 40);
  assert.equal(tier3.attempts.length, 12);
  assert.equal(tier4.attempts.length, 0);
  // a59 is the most recent fixture; a0 the oldest.
  assert.equal(tier3.attempts[0].attemptId, "a59");
  assert.equal(tier3.attempts.some((item) => item.attemptId === "a0"), false);
});

test("the active attempt and the whole profile survive every tier", () => {
  const active = { ...attempt("live", 1_760_500_000_000), completionStatus: "active" as const, endedAt: null, rawScore: null };
  const state = stateWith(60, active);

  for (const tier of [0, 1, 2, 3, 4] as const) {
    const compacted = compactForStorage(state, tier);
    // An unfinished session has not reached the cloud, so it is never shed — and it
    // keeps full detail, including the fields completed attempts give up first.
    assert.equal(compacted.activeAttempt?.attemptId, "live");
    assert.equal(compacted.activeAttempt?.responses["live-q0"].answerChanges.length, 4);
    assert.equal(compacted.activeAttempt?.responses["live-q0"].timestamps.length, 4);
    assert.deepEqual(compacted.progress, state.progress);
    assert.deepEqual(compacted.mistakes, state.mistakes);
    assert.deepEqual(compacted.notes, state.notes);
    assert.deepEqual(compacted.targets, state.targets);
    assert.deepEqual(compacted.settings, state.settings);
    assert.deepEqual(compacted.syncMetadata, state.syncMetadata);
  }
});

test("a record that fits is written whole, in a single attempt", () => {
  const storage = boundedStorage(10_000_000);
  const result = persistStoredState(storage, "key", stateWith(3));

  assert.equal(result.stored, true);
  assert.equal(result.tier, 0);
  assert.equal(result.reason, "ok");
  assert.equal(result.droppedAttempts, 0);
  assert.equal(storage.writes, 1);
});

test("a record over quota sheds detail until it fits, and reports what it kept", () => {
  const state = stateWith(60);
  const full = JSON.stringify(state).length;
  const stripped = JSON.stringify(compactForStorage(state, 1)).length;
  // A budget between the two forces exactly one step of shedding.
  const storage = boundedStorage(Math.floor((full + stripped) / 2));
  const result = persistStoredState(storage, "key", state);

  assert.equal(result.stored, true);
  assert.equal(result.tier, 1);
  assert.equal(result.reason, "compacted");
  assert.equal(result.droppedAttempts, 0);
  assert.equal(storage.writes, 2);
  assert.equal(JSON.parse(storage.value ?? "{}").attempts.length, 60);
});

test("a severely constrained device still stores the session in progress", () => {
  const active = { ...attempt("live", 1_760_500_000_000), completionStatus: "active" as const, endedAt: null, rawScore: null };
  const state = stateWith(200, active);
  // Only the smallest tier can fit here.
  const storage = boundedStorage(JSON.stringify(compactForStorage(state, 4)).length);
  const result = persistStoredState(storage, "key", state);

  assert.equal(result.stored, true);
  assert.equal(result.tier, 4);
  assert.equal(result.droppedAttempts, 200);
  const written = JSON.parse(storage.value ?? "{}") as StoredState;
  assert.equal(written.activeAttempt?.attemptId, "live");
  assert.equal(written.attempts.length, 0);
  assert.deepEqual(written.notes, state.notes);
});

test("a device that cannot store anything reports quota rather than claiming success", () => {
  const storage = boundedStorage(10);
  const result = persistStoredState(storage, "key", stateWith(5));

  assert.equal(result.stored, false);
  assert.equal(result.reason, "quota");
  assert.equal(storage.writes, 5);
  assert.equal(storage.value, null);
});

test("blocked storage fails immediately instead of retrying every tier", () => {
  let writes = 0;
  const storage: StorageLike = {
    setItem() {
      writes += 1;
      const error = new Error("access denied");
      error.name = "SecurityError";
      throw error;
    },
  };
  const result = persistStoredState(storage, "key", stateWith(5));

  assert.equal(result.stored, false);
  assert.equal(result.reason, "unavailable");
  // Shrinking the payload cannot fix a storage backend that is switched off.
  assert.equal(writes, 1);
});

test("shedding actually solves the realistic overflow it exists for", () => {
  // A year of heavy revision — 300 completed papers, a candidate who revises answers
  // often, and progress for the whole archive. This is the shape that overflows a 5 MB
  // origin quota, which is the entire reason this module exists.
  const state: StoredState = {
    ...defaultState(),
    attempts: Array.from({ length: 300 }, (_, n) => attempt(`a${n}`, 1_760_000_000_000 + n * 86_400_000, 27, 8)),
    progress: Object.fromEntries(Array.from({ length: 598 }, (_, i) => [`archive-q${i}`, {
      neverSeen: false, firstSeenAt: 1_760_000_000_000, firstAttemptCorrect: true, firstAttemptTime: 84_213,
      firstAttemptMode: "historic" as const, totalAttempts: 2, totalCorrect: 1, totalIncorrect: 1,
      mostRecentResult: true, mastered: false, exposureCount: 2, lastAttemptedAt: 1_760_002_400_000,
    }])),
  };
  const quota = 5 * 1024 * 1024;
  assert.ok(JSON.stringify(state).length > quota, "fixture should exceed a browser quota");

  const storage = boundedStorage(quota);
  const result = persistStoredState(storage, "key", state);
  assert.equal(result.stored, true);
  assert.ok(result.tier <= 2, `expected mild shedding, used tier ${result.tier}`);
  assert.ok((storage.value ?? "").length <= quota);
});
