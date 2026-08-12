import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  defaultState,
  type Attempt,
  type AttemptMode,
  type BankPayload,
  type ModuleId,
  type Question,
  type QuestionProgress,
  type ResponseRecord,
  type StoredState,
} from "../app/lib/core";
import { buildAdaptiveStudyPlan } from "../app/lib/study-plan";

const NOW = new Date(2026, 7, 12, 12, 0, 0).getTime();
const DAY_MS = 86_400_000;

function question(
  id: string,
  module: ModuleId = "maths1",
  topic = "Algebra",
  year = 2020,
  number = 1,
  overrides: Partial<Question> = {},
): Question {
  return {
    id,
    questionBankVersion: "test-bank-v1",
    year,
    sourceExam: module === "maths2" ? "TMUA" : "NSAA",
    sourcePaper: `${module}-${year}.pdf`,
    sourceSection: "Section 1",
    sourcePart: "A",
    originalQuestionNumber: number,
    sourcePage: number,
    sourcePages: [number],
    targetModule: module,
    esatTopic: topic,
    esatSubtopic: `${topic} detail`,
    specificationVersion: "test-spec",
    questionText: `Question ${id}`,
    answerOptions: ["A", "B", "C", "D"],
    correctAnswer: "A",
    excluded: false,
    exclusionReason: null,
    reviewRequired: false,
    importConfidence: "high",
    sourceHash: `source-${id}`,
    imageHash: `image-${id}`,
    searchText: id,
    ...overrides,
  };
}

function questionSeries(
  prefix: string,
  count: number,
  module: ModuleId,
  topic: string,
  year: number,
  overrides: Partial<Question> = {},
): Question[] {
  return Array.from({ length: count }, (_, index) => (
    question(`${prefix}-${index + 1}`, module, topic, year, index + 1, overrides)
  ));
}

function progress(
  correct: boolean,
  mode: AttemptMode = "exam",
  timestamp = NOW - 10 * DAY_MS,
  overrides: Partial<QuestionProgress> = {},
): QuestionProgress {
  return {
    neverSeen: false,
    firstSeenAt: timestamp,
    firstAttemptCorrect: correct,
    firstAttemptTime: 60_000,
    firstAttemptMode: mode,
    totalAttempts: 1,
    totalCorrect: correct ? 1 : 0,
    totalIncorrect: correct ? 0 : 1,
    mostRecentResult: correct,
    mastered: false,
    exposureCount: 1,
    lastAttemptedAt: timestamp,
    ...overrides,
  };
}

function response(questionId: string, correct: boolean, firstExposure = true): ResponseRecord {
  return {
    questionId,
    selectedAnswer: correct ? "A" : "B",
    firstSelectedAnswer: correct ? "A" : "B",
    finalAnswer: correct ? "A" : "B",
    correct,
    unanswered: false,
    timeSpentMs: 60_000,
    visits: 1,
    flagged: false,
    confidence: null,
    answerChanges: [],
    errorClassifications: [],
    firstExposure,
    timestamps: [],
  };
}

function attempt(args: {
  id: string;
  module?: ModuleId;
  mode?: AttemptMode;
  strictTimed?: boolean;
  questionIds?: string[];
  endedAt?: number | null;
  durationMs?: number | null;
  rawScore?: number | null;
  active?: boolean;
  firstExposure?: boolean;
}): Attempt {
  const module = args.module ?? "maths1";
  const questionIds = args.questionIds ?? ["attempt-question"];
  const endedAt = args.active ? null : (args.endedAt ?? NOW - DAY_MS);
  const rawScore = args.active ? null : (args.rawScore ?? 0);
  return {
    attemptId: args.id,
    mode: args.mode ?? "practice",
    module,
    questionIds,
    questionBankVersion: "test-bank-v1",
    specificationVersion: "test-spec",
    scoreConversionVersion: "test-score",
    benchmarkVersion: "test-benchmark",
    startedAt: (endedAt ?? NOW) - 60_000,
    endsAt: args.active ? NOW + 60_000 : null,
    pausedAt: null,
    totalPausedDuration: 0,
    endedAt,
    durationMs: args.active ? null : (args.durationMs ?? 60_000),
    strictTimed: args.strictTimed ?? false,
    generated: true,
    originalHistoricSet: false,
    sourceYears: [2020],
    sourceExams: ["NSAA"],
    sourceSetLabel: "Synthetic set",
    sequenceSource: "archive",
    currentIndex: 0,
    lastVisitStartedAt: NOW,
    responses: Object.fromEntries(questionIds.map((id) => [id, response(id, false, args.firstExposure ?? true)])),
    completionStatus: args.active ? "active" : "submitted",
    rawScore,
    freshQuestionCount: args.firstExposure === false ? 0 : questionIds.length,
    sequenceRemaining: [],
  };
}

function setPlanMinutes(state: StoredState, minutes: unknown): void {
  (state.settings as unknown as Record<string, unknown>).adaptivePlanMinutes = minutes;
}

function examDateAfter(days: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function markStrictEvidence(state: StoredState, questions: Question[], results: boolean[]): void {
  questions.slice(0, results.length).forEach((item, index) => {
    state.progress[item.id] = progress(results[index], "exam", NOW - (results.length - index) * DAY_MS);
  });
}

test("planner is deterministic, insertion-order independent and does not mutate frozen input", () => {
  const archive = [
    ...questionSeries("m1-a", 14, "maths1", "Algebra", 2020),
    ...questionSeries("m1-g", 14, "maths1", "Geometry", 2021),
    ...questionSeries("p-m", 14, "physics", "Mechanics", 2020),
  ];
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  markStrictEvidence(state, archive.filter((item) => item.targetModule === "maths1").slice(0, 10), [false, false, false, false, true, true, true, true, true, true]);
  state.mistakes[archive[28].id] = {
    questionId: archive[28].id,
    dueDate: NOW,
    intervalDays: 1,
    correctStreak: 0,
    lastResult: false,
  };
  state.progress[archive[28].id] = progress(false, "practice", NOW - DAY_MS);

  const reordered = structuredClone(state);
  reordered.progress = Object.fromEntries(Object.entries(reordered.progress).reverse());
  reordered.mistakes = Object.fromEntries(Object.entries(reordered.mistakes).reverse());
  reordered.attempts = [...reordered.attempts].reverse();
  const frozenQuestions = deepFreeze(structuredClone(archive));
  const frozenState = deepFreeze(structuredClone(state));

  const first = buildAdaptiveStudyPlan({ archiveQuestions: frozenQuestions, state: frozenState, now: NOW });
  const second = buildAdaptiveStudyPlan({ archiveQuestions: [...archive].reverse(), state: reordered, now: NOW });
  assert.deepEqual(first, second);
  assert.deepEqual(buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW }), first);
});

test("due work includes equality, excludes future items, reports stale IDs and splits modules", () => {
  const maths = question("due-maths", "maths1", "Algebra");
  const physics = question("due-physics", "physics", "Mechanics");
  const future = question("future", "maths1", "Geometry");
  const mastered = question("maintenance", "maths1", "Number");
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  for (const item of [maths, physics, future, mastered]) state.progress[item.id] = progress(false, "practice");
  state.progress[mastered.id].mastered = true;
  state.mistakes = {
    [maths.id]: { questionId: maths.id, dueDate: NOW, intervalDays: 1, correctStreak: 0, lastResult: false },
    [physics.id]: { questionId: physics.id, dueDate: NOW - 2 * DAY_MS, intervalDays: 1, correctStreak: 0, lastResult: false },
    [future.id]: { questionId: future.id, dueDate: NOW + 1, intervalDays: 1, correctStreak: 0, lastResult: false },
    [mastered.id]: { questionId: mastered.id, dueDate: NOW - 10 * DAY_MS, intervalDays: 30, correctStreak: 4, lastResult: true },
    missing: { questionId: "missing", dueDate: NOW - DAY_MS, intervalDays: 1, correctStreak: 0, lastResult: false },
  };

  const plan = buildAdaptiveStudyPlan({ archiveQuestions: [maths, physics, future, mastered], state, now: NOW });
  assert.equal(plan.dueCount, 3);
  assert.equal(plan.unavailableDueCount, 1);
  assert.equal(plan.sessions[0].kind, "retrieval");
  assert.equal(plan.sessions[0].module, "physics", "the oldest unresolved due item should lead");
  const retrieval = plan.sessions.filter((session) => session.kind === "retrieval");
  assert.equal(retrieval.length, 2);
  assert.ok(retrieval.every((session) => new Set(session.questionIds.map((id) => (
    id === maths.id ? "maths1" : "physics"
  ))).size === 1));
  assert.deepEqual(new Set(retrieval.flatMap((session) => session.questionIds)), new Set([maths.id, physics.id]));
  assert.ok(!plan.sessions.some((session) => session.questionIds.includes(future.id)));
  const maintenanceIndex = plan.sessions.findIndex((session) => session.kind === "maintenance");
  assert.ok(maintenanceIndex === -1 || maintenanceIndex >= retrieval.length, "mastered work must never precede unresolved retrieval");
});

test("duplicate mistake records cannot schedule the same question twice", () => {
  const item = question("duplicate-due", "maths1", "Algebra");
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  state.progress[item.id] = progress(false, "practice");
  state.mistakes = {
    canonical: { questionId: item.id, dueDate: NOW - DAY_MS, intervalDays: 1, correctStreak: 0, lastResult: false },
    legacyDuplicate: { questionId: item.id, dueDate: NOW - 2 * DAY_MS, intervalDays: 1, correctStreak: 0, lastResult: false },
  };

  const plan = buildAdaptiveStudyPlan({ archiveQuestions: [item], state, now: NOW });
  const ids = plan.sessions.flatMap((session) => session.questionIds);
  assert.equal(plan.dueCount, 1);
  assert.deepEqual(ids, [item.id]);
});

test("unresolved retrieval is capped to approximately forty percent of the daily budget", () => {
  const archive = questionSeries("due", 30, "maths1", "Algebra", 2020);
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  for (const item of archive) {
    state.progress[item.id] = progress(false, "practice");
    state.mistakes[item.id] = { questionId: item.id, dueDate: NOW - DAY_MS, intervalDays: 1, correctStreak: 0, lastResult: false };
  }
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  const retrievalCount = plan.sessions
    .filter((session) => session.kind === "retrieval")
    .reduce((total, session) => total + session.questionIds.length, 0);
  assert.equal(retrievalCount, 12);
  assert.equal(plan.dueCount, 30);
});

test("retrieval allowance does not refill when the plan rebuilds later the same day", () => {
  const archive = questionSeries("sequential-due", 30, "maths1", "Algebra", 2020);
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  for (const item of archive) {
    state.progress[item.id] = progress(false, "practice");
    state.mistakes[item.id] = { questionId: item.id, dueDate: NOW - DAY_MS, intervalDays: 1, correctStreak: 0, lastResult: false };
  }
  const initial = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  const retrievalSessions = initial.sessions.filter((session) => session.kind === "retrieval");
  assert.equal(retrievalSessions.reduce((total, session) => total + session.estimatedMinutes, 0), 18);

  retrievalSessions.forEach((session, index) => {
    const completed = attempt({
      id: `completed-retrieval-${index}`,
      module: session.module,
      mode: "retry",
      questionIds: session.questionIds,
      endedAt: NOW - (index + 1) * 60_000,
      durationMs: session.estimatedMinutes * 60_000,
      rawScore: session.questionIds.length,
      firstExposure: false,
    });
    completed.planSessionId = session.id;
    completed.planSessionKind = "retrieval";
    state.attempts.push(completed);
    for (const id of session.questionIds) delete state.mistakes[id];
  });

  const rebuilt = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(rebuilt.targetMinutesToday, 27);
  assert.ok(!rebuilt.sessions.some((session) => session.kind === "retrieval"));
  assert.ok(rebuilt.dueCount > 0, "the test must leave due work waiting for the next plan window");
});

test("per-session rounding cannot push split retrieval above its time allowance", () => {
  const archive = [
    question("split-m1", "maths1", "Algebra"),
    question("split-p", "physics", "Mechanics"),
    ...questionSeries("split-m2", 10, "maths2", "Trigonometry", 2020),
  ];
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  archive.forEach((item, index) => {
    state.progress[item.id] = progress(false, "practice");
    state.mistakes[item.id] = {
      questionId: item.id,
      dueDate: NOW - (archive.length - index) * DAY_MS,
      intervalDays: 1,
      correctStreak: 0,
      lastResult: false,
    };
  });

  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  const retrievalMinutes = plan.sessions
    .filter((session) => session.kind === "retrieval")
    .reduce((total, session) => total + session.estimatedMinutes, 0);
  assert.ok(retrievalMinutes <= 18);
  assert.ok(plan.totalEstimatedMinutes <= plan.targetMinutesToday);
});

test("a new user receives deterministic paced ten-question baselines", () => {
  const archive = [
    ...questionSeries("m1", 20, "maths1", "Algebra", 2020),
    ...questionSeries("p", 20, "physics", "Mechanics", 2020),
    ...questionSeries("m2", 20, "maths2", "Trigonometry", 2020),
  ];
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(plan.confidence, "starting");
  assert.deepEqual(plan.sessions.map((session) => session.kind), ["baseline", "baseline", "baseline"]);
  assert.deepEqual(plan.sessions.map((session) => session.module), ["maths1", "physics", "maths2"]);
  for (const session of plan.sessions) {
    assert.equal(session.questionIds.length, 10);
    assert.equal(session.mode, "exam");
    assert.equal(session.strictTimed, true);
    assert.equal(Math.round((session.durationMinutes ?? 0) * 1000), Math.round((10 * 40 / 27) * 1000));
  }
  assert.equal(plan.totalEstimatedMinutes, 45);
});

test("completed adaptive sessions count down the daily cap and produce a durable done state", () => {
  const archive = [
    ...questionSeries("daily-m1", 20, "maths1", "Algebra", 2020),
    ...questionSeries("daily-p", 20, "physics", "Mechanics", 2020),
    ...questionSeries("daily-m2", 20, "maths2", "Trigonometry", 2020),
  ];
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);

  const initial = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(initial.dailyBudgetMinutes, 45);
  assert.equal(initial.targetMinutesToday, 45);

  const firstSession = initial.sessions[0];
  const completedFirst = attempt({
    id: "daily-plan-1",
    module: firstSession.module,
    mode: firstSession.mode,
    strictTimed: firstSession.strictTimed,
    questionIds: firstSession.questionIds,
    endedAt: NOW - 20 * 60_000,
    durationMs: 5 * 60_000,
    rawScore: 7,
  });
  completedFirst.planSessionId = firstSession.id;
  completedFirst.planSessionKind = firstSession.kind;
  completedFirst.planSessionTitle = firstSession.title;
  completedFirst.planSessionEstimatedMinutes = firstSession.estimatedMinutes;
  state.attempts.push(completedFirst);
  markStrictEvidence(state, archive.filter((item) => item.targetModule === "maths1").slice(0, 10), Array(10).fill(true));

  const remaining = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(remaining.completedPlanSessionsToday, 1);
  assert.equal(remaining.completedPlanMinutesToday, 5);
  assert.equal(remaining.targetMinutesToday, 30);
  assert.ok(remaining.totalEstimatedMinutes <= 30);
  assert.match(remaining.summary, /1 session completed today/i);

  const second = attempt({ id: "daily-plan-2", endedAt: NOW - 10 * 60_000, durationMs: 15 * 60_000, rawScore: 5 });
  second.planSessionId = "daily-second";
  const third = attempt({ id: "daily-plan-3", endedAt: NOW - 5 * 60_000, durationMs: 15 * 60_000, rawScore: 5 });
  third.planSessionId = "daily-third";
  state.attempts.push(second, third);

  const complete = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(complete.status, "complete");
  assert.equal(complete.targetMinutesToday, 0);
  assert.equal(complete.completedPlanSessionsToday, 3);
  assert.equal(complete.completedPlanMinutesToday, 35);
  assert.equal(complete.sessions.length, 0);
  assert.match(complete.headline, /today.*complete/i);
});

test("weekly remaining time and completed plan work are not deducted twice", () => {
  const archive = [
    ...questionSeries("near-target-m1", 20, "maths1", "Algebra", 2020),
    ...questionSeries("near-target-p", 20, "physics", "Mechanics", 2020),
  ];
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  state.settings.weeklyHours = 1;
  setPlanMinutes(state, 45);
  state.attempts.push(attempt({ id: "prior-general-study", endedAt: NOW - 2 * 60 * 60_000, durationMs: 30 * 60_000, rawScore: 5 }));

  const initial = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(initial.dailyBudgetMinutes, 30);
  const first = initial.sessions[0];
  const completed = attempt({
    id: "near-target-plan-session",
    module: first.module,
    mode: first.mode,
    strictTimed: first.strictTimed,
    questionIds: first.questionIds,
    endedAt: NOW - 60_000,
    durationMs: 15 * 60_000,
    rawScore: 7,
  });
  completed.planSessionId = first.id;
  completed.planSessionKind = first.kind;
  state.attempts.push(completed);
  markStrictEvidence(state, archive.slice(0, 10), Array(10).fill(true));

  const rebuilt = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(rebuilt.dailyBudgetMinutes, 30);
  assert.equal(rebuilt.targetMinutesToday, 15);
  assert.equal(rebuilt.status, "ready");
});

test("adaptive work from an earlier day still counts against the weekly target", () => {
  const archive = questionSeries("prior-day-plan", 20, "maths1", "Algebra", 2020);
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  state.settings.weeklyHours = 1;
  setPlanMinutes(state, 45);
  const priorPlan = attempt({
    id: "yesterday-plan",
    endedAt: NOW - DAY_MS,
    durationMs: 30 * 60_000,
    rawScore: 5,
  });
  priorPlan.planSessionId = "yesterday-session";
  priorPlan.planSessionEstimatedMinutes = 30;
  state.attempts.push(priorPlan);

  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(plan.completedPlanSessionsToday, 0);
  assert.equal(plan.completedMinutesThisWeek, 30);
  assert.equal(plan.dailyBudgetMinutes, 30);
  assert.equal(plan.targetMinutesToday, 30);
});

test("retakes do not change reliable topic weakness", () => {
  const weak = questionSeries("weak", 12, "maths1", "Algebra", 2020);
  const strong = questionSeries("strong", 12, "maths1", "Geometry", 2020);
  const archive = [...weak, ...strong];
  const base = defaultState();
  base.settings.examDate = examDateAfter(60);
  setPlanMinutes(base, 15);
  markStrictEvidence(base, [...weak.slice(0, 4), ...strong.slice(0, 6)], [false, false, false, false, true, true, true, true, true, true]);
  const before = buildAdaptiveStudyPlan({ archiveQuestions: archive, state: base, now: NOW });
  assert.equal(before.sessions[0].kind, "focus");
  assert.equal(before.sessions[0].topic, "Algebra");

  const afterState = structuredClone(base);
  for (const item of weak.slice(0, 4)) {
    afterState.progress[item.id] = {
      ...afterState.progress[item.id],
      totalAttempts: 8,
      totalCorrect: 7,
      totalIncorrect: 1,
      mostRecentResult: true,
      mastered: true,
      exposureCount: 8,
      lastAttemptedAt: NOW - DAY_MS,
    };
  }
  afterState.attempts.push(attempt({
    id: "old-retry",
    module: "maths1",
    mode: "retry",
    strictTimed: true,
    questionIds: weak.slice(0, 4).map((item) => item.id),
    endedAt: new Date(2025, 0, 1).getTime(),
    durationMs: 10 * 60_000,
    rawScore: 4,
    firstExposure: false,
  }));
  const after = buildAdaptiveStudyPlan({ archiveQuestions: archive, state: afterState, now: NOW });
  assert.equal(after.sessions[0].kind, "focus");
  assert.equal(after.sessions[0].topic, "Algebra");
  assert.deepEqual(after.sessions[0].questionIds, before.sessions[0].questionIds);
  assert.match(after.sessions[0].rationale.join(" "), /first attempts|first exposures/i);
});

test("a perfect small sample is never labelled a topic weakness", () => {
  const algebra = questionSeries("perfect-algebra", 12, "maths1", "Algebra", 2020);
  const geometry = questionSeries("perfect-geometry", 12, "maths1", "Geometry", 2020);
  const archive = [...algebra, ...geometry];
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  state.targets.maths1 = 9;
  setPlanMinutes(state, 15);
  markStrictEvidence(state, [...algebra.slice(0, 4), ...geometry.slice(0, 6)], Array(10).fill(true));

  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.ok(plan.sessions.length > 0);
  assert.ok(plan.sessions.every((session) => session.kind !== "focus"));
  assert.equal(plan.sessions[0].kind, "coverage");
});

test("selection excludes ineligible questions and never duplicates IDs across sessions", () => {
  const valid = questionSeries("valid", 24, "maths1", "Algebra", 2020);
  const excluded = question("excluded", "maths1", "Geometry", 2020, 25, { excluded: true, exclusionReason: "held" });
  const review = question("review", "maths1", "Geometry", 2020, 26, { reviewRequired: true });
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: [...valid, excluded, review], state, now: NOW });
  const ids = plan.sessions.flatMap((session) => session.questionIds);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes(excluded.id));
  assert.ok(!ids.includes(review.id));
  assert.ok(plan.sessions.every((session) => session.questionIds.every((id) => valid.some((item) => item.id === id))));
});

test("phase boundaries are exact and the final two days never schedule a full simulation", () => {
  const archive = questionSeries("phase", 20, "maths1", "Algebra", 2023);
  const expected = [
    [43, "foundation"],
    [42, "consolidation"],
    [22, "consolidation"],
    [21, "simulation"],
    [8, "simulation"],
    [7, "taper"],
    [0, "taper"],
  ] as const;
  for (const [days, phase] of expected) {
    const state = defaultState();
    state.settings.examDate = examDateAfter(days);
    setPlanMinutes(state, 45);
    assert.equal(buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW }).phase, phase, `${days} days`);
  }
  for (const invalidDate of ["", "not-a-date", "2026-02-30", examDateAfter(-1)]) {
    const state = defaultState();
    state.settings.examDate = invalidDate;
    assert.equal(buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW }).phase, "date-needed");
  }

  const taperState = defaultState();
  taperState.settings.examDate = examDateAfter(2);
  setPlanMinutes(taperState, 45);
  markStrictEvidence(taperState, archive.slice(0, 10), Array(10).fill(false));
  const taperPlan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state: taperState, now: NOW });
  assert.ok(!taperPlan.sessions.some((session) => session.kind === "simulation"));

  const taperArchive = [
    ...questionSeries("taper-m1", 20, "maths1", "Algebra", 2020),
    ...questionSeries("taper-p", 20, "physics", "Mechanics", 2020),
    ...questionSeries("taper-m2", 20, "maths2", "Trigonometry", 2020),
  ];
  const newUserTaper = defaultState();
  newUserTaper.settings.examDate = examDateAfter(2);
  setPlanMinutes(newUserTaper, 90);
  const protectedPlan = buildAdaptiveStudyPlan({ archiveQuestions: taperArchive, state: newUserTaper, now: NOW });
  assert.equal(protectedPlan.dailyBudgetMinutes, 20);
  assert.ok(protectedPlan.totalEstimatedMinutes <= 20);
  assert.equal(protectedPlan.sessions.filter((session) => session.kind === "baseline").length, 1);
  assert.ok(protectedPlan.sessions.every((session) => session.kind !== "baseline" || session.questionIds.length <= 6));
});

test("meeting the weekly target completes the plan unless unresolved retrieval is due", () => {
  const item = question("weekly-due");
  const complete = defaultState();
  complete.settings.examDate = examDateAfter(60);
  complete.settings.weeklyHours = 1;
  setPlanMinutes(complete, 45);
  complete.attempts.push(attempt({ id: "weekly-hour", endedAt: NOW - 60_000, durationMs: 60 * 60_000, rawScore: 1 }));
  const completedPlan = buildAdaptiveStudyPlan({ archiveQuestions: [item], state: complete, now: NOW });
  assert.equal(completedPlan.status, "complete");
  assert.equal(completedPlan.completedMinutesThisWeek, 60);
  assert.equal(completedPlan.weeklyTargetMinutes, 60);
  assert.equal(completedPlan.targetMinutesToday, 0);
  assert.equal(completedPlan.sessions.length, 0);

  const dueState = structuredClone(complete);
  dueState.progress[item.id] = progress(false, "practice");
  dueState.mistakes[item.id] = { questionId: item.id, dueDate: NOW, intervalDays: 1, correctStreak: 0, lastResult: false };
  const duePlan = buildAdaptiveStudyPlan({ archiveQuestions: [item], state: dueState, now: NOW });
  assert.equal(duePlan.status, "ready");
  assert.equal(duePlan.sessions[0].kind, "retrieval");
  assert.deepEqual(duePlan.sessions[0].questionIds, [item.id]);
});

test("weekly progress never reports completion before the exact target is reached", () => {
  const archive = questionSeries("weekly-precision", 20, "maths1", "Algebra", 2020);
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  state.settings.weeklyHours = 1;
  setPlanMinutes(state, 45);
  state.attempts.push(attempt({ id: "almost-one-hour", endedAt: NOW - 1_000, durationMs: 59 * 60_000 + 31_000, rawScore: 1 }));

  const almost = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(almost.completedMinutesThisWeek, 59);
  assert.equal(almost.status, "ready");

  state.attempts[0].durationMs = 60 * 60_000;
  const exact = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(exact.completedMinutesThisWeek, 60);
  assert.equal(exact.status, "complete");
});

test("malformed settings are sanitized without mutating saved state", () => {
  const archive = questionSeries("malformed", 20, "maths1", "Algebra", 2020);
  const state = defaultState();
  state.settings.examDate = "invalid";
  state.settings.weeklyHours = Number.NaN;
  state.targets.maths1 = Number.NaN;
  setPlanMinutes(state, 999);
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state: deepFreeze(state), now: NOW });
  assert.equal(plan.phase, "date-needed");
  assert.equal(plan.weeklyTargetMinutes, 8 * 60);
  assert.equal(plan.targetMinutesToday, 120);
  assert.equal(plan.status, "ready");
  assert.ok(plan.sessions.length > 0);
});

test("an active attempt suppresses new sessions and exposes its stable ID", () => {
  const archive = questionSeries("active", 20, "maths1", "Algebra", 2020);
  const state = defaultState();
  state.activeAttempt = attempt({ id: "active-attempt", active: true, questionIds: [archive[0].id] });
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, state, now: NOW });
  assert.equal(plan.status, "active");
  assert.equal(plan.activeAttemptId, "active-attempt");
  assert.equal(plan.sessions.length, 0);
  assert.match(plan.headline, /continue/i);
});

test("baseline selection holds back the newest pristine full paper when alternatives exist", () => {
  const older = questionSeries("older", 20, "maths1", "Algebra", 2022);
  const newest = questionSeries("newest", 20, "maths1", "Geometry", 2023);
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 15);
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: [...newest, ...older], state, now: NOW });
  assert.equal(plan.sessions[0].kind, "baseline");
  assert.ok(plan.sessions[0].questionIds.every((id) => id.startsWith("older-")));
});

test("simulation phase selects an exact pristine paper for the weakest module with source metadata", () => {
  const training = [
    ...questionSeries("train-m1", 10, "maths1", "Algebra", 2020),
    ...questionSeries("train-p", 10, "physics", "Mechanics", 2020),
    ...questionSeries("train-m2", 10, "maths2", "Trigonometry", 2020),
  ];
  const pristine = [
    ...questionSeries("paper-m1", 20, "maths1", "Geometry", 2023),
    ...questionSeries("paper-p", 20, "physics", "Waves", 2023),
    ...questionSeries("paper-m2", 20, "maths2", "Differentiation", 2023),
  ];
  const state = defaultState();
  state.settings.examDate = examDateAfter(10);
  setPlanMinutes(state, 45);
  markStrictEvidence(state, training.slice(0, 10), Array(10).fill(false));
  markStrictEvidence(state, training.slice(10, 20), Array(10).fill(true));
  markStrictEvidence(state, training.slice(20, 30), Array(10).fill(true));
  state.attempts.push(attempt({
    id: "recent-maths-retake",
    module: "maths1",
    mode: "historic",
    strictTimed: true,
    questionIds: training.slice(0, 10).map((item) => item.id),
    endedAt: NOW - DAY_MS,
    durationMs: 15 * 60_000,
    rawScore: 10,
    firstExposure: false,
  }));
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: [...training, ...pristine], state, now: NOW });
  const simulation = plan.sessions.find((session) => session.kind === "simulation");
  assert.ok(simulation);
  assert.equal(simulation.module, "maths1");
  assert.equal(simulation.mode, "historic");
  assert.equal(simulation.strictTimed, true);
  assert.equal(simulation.questionIds.length, 20);
  assert.deepEqual(simulation.source, { exam: "NSAA", year: 2023, label: "NSAA 2023 · Section 1 · Part A" });
  assert.deepEqual(simulation.questionIds, pristine.slice(0, 20).map((item) => item.id));
});

test("strict original-mock first exposures contribute to planner confidence", () => {
  const archive = [
    ...questionSeries("archive-m1", 20, "maths1", "Algebra", 2020),
    ...questionSeries("archive-p", 20, "physics", "Mechanics", 2020),
    ...questionSeries("archive-m2", 20, "maths2", "Trigonometry", 2020),
  ];
  const originals = [
    ...questionSeries("original-m1", 10, "maths1", "Algebra", 2026, { sourceExam: "ESAT Atlas Original" }),
    ...questionSeries("original-p", 10, "physics", "Mechanics", 2026, { sourceExam: "ESAT Atlas Original" }),
    ...questionSeries("original-m2", 10, "maths2", "Trigonometry", 2026, { sourceExam: "ESAT Atlas Original" }),
  ];
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  for (const item of originals) state.progress[item.id] = progress(true, "original");

  const plan = buildAdaptiveStudyPlan({ archiveQuestions: archive, supplementalQuestions: originals, state, now: NOW });
  assert.equal(plan.confidence, "established");
  assert.ok(!plan.sessions.some((session) => session.kind === "baseline"));
  assert.ok(plan.sessions.length > 0);
});

test("real question bank produces a valid, distinct baseline plan", () => {
  const payload = JSON.parse(fs.readFileSync("public/data/question-bank.json", "utf8")) as BankPayload;
  const state = defaultState();
  state.settings.examDate = examDateAfter(60);
  setPlanMinutes(state, 45);
  const plan = buildAdaptiveStudyPlan({ archiveQuestions: payload.questions, state, now: NOW });
  const ids = plan.sessions.flatMap((session) => session.questionIds);
  const questionMap = new Map(payload.questions.map((item) => [item.id, item]));
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.sessions.map((session) => session.kind), ["baseline", "baseline", "baseline"]);
  assert.equal(ids.length, 30);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => {
    const item = questionMap.get(id);
    return Boolean(item && !item.excluded && !item.reviewRequired);
  }));
});
