import assert from "node:assert/strict";
import test from "node:test";
import { errorTagSummary, studyActivity } from "../app/lib/insights";
import { localDayOffset, localDayStart, type Attempt, type ModuleId, type Question, type ResponseRecord } from "../app/lib/core";

function question(id: string, module: ModuleId = "maths1", topic = "Algebra"): Question {
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
    targetModule: module,
    esatTopic: topic,
    esatSubtopic: "Functions",
    specificationVersion: "test",
    questionImage: "/q.webp",
    answerOptions: ["A", "B", "C", "D"],
    correctAnswer: "A",
    excluded: false,
    exclusionReason: null,
    reviewRequired: false,
    importConfidence: "high",
    sourceHash: "hash",
    imageHash: "hash",
    searchText: "",
  };
}

function response(questionId: string, overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    questionId,
    selectedAnswer: "B",
    firstSelectedAnswer: "B",
    finalAnswer: "B",
    correct: false,
    unanswered: false,
    timeSpentMs: 60_000,
    visits: 1,
    flagged: false,
    confidence: null,
    answerChanges: [],
    errorClassifications: [],
    firstExposure: true,
    timestamps: [],
    ...overrides,
  };
}

function attempt(id: string, endedAt: number, responses: ResponseRecord[], overrides: Partial<Attempt> = {}): Attempt {
  return {
    attemptId: id,
    mode: "practice",
    module: "maths1",
    questionIds: responses.map((item) => item.questionId),
    questionBankVersion: "test",
    specificationVersion: "test",
    scoreConversionVersion: "test",
    benchmarkVersion: "test",
    startedAt: endedAt - 600_000,
    endsAt: null,
    pausedAt: null,
    totalPausedDuration: 0,
    endedAt,
    durationMs: 600_000,
    strictTimed: false,
    generated: true,
    originalHistoricSet: false,
    sourceYears: [2023],
    sourceExams: ["NSAA"],
    sourceSetLabel: "Practice set",
    currentIndex: 0,
    lastVisitStartedAt: endedAt,
    responses: Object.fromEntries(responses.map((item) => [item.questionId, item])),
    completionStatus: "submitted",
    rawScore: responses.filter((item) => item.correct).length,
    freshQuestionCount: responses.length,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ error tags -- */

test("error tags aggregate by cause with module and topic context", () => {
  const questions = {
    q1: question("q1", "maths1", "Algebra"),
    q2: question("q2", "physics", "Mechanics"),
    q3: question("q3", "maths1", "Geometry"),
  };
  const attempts = [
    attempt("a1", 1_000_000, [
      response("q1", { errorClassifications: ["Algebra", "Careless error"] }),
      response("q2", { errorClassifications: ["Algebra"] }),
      response("q3", { correct: true, selectedAnswer: "A", finalAnswer: "A" }),
    ]),
  ];

  const summary = errorTagSummary(attempts, questions);
  assert.equal(summary.taggedResponses, 2);
  assert.equal(summary.totalApplications, 3);
  assert.equal(summary.leading?.tag, "Algebra");
  assert.equal(summary.leading?.count, 2);
  assert.equal(summary.leading?.share, 1);
  assert.deepEqual(summary.leading?.modules, { maths1: 1, physics: 1, maths2: 0 });
  assert.deepEqual(summary.leading?.topTopics.map((item) => item.topic).sort(), ["Algebra", "Mechanics"]);
});

test("unanswered questions are mistakes and untagged mistakes are counted separately", () => {
  const questions = { q1: question("q1"), q2: question("q2") };
  const attempts = [
    attempt("a1", 1_000_000, [
      response("q1", { selectedAnswer: null, finalAnswer: null, unanswered: true, errorClassifications: ["Time pressure"] }),
      response("q2", { errorClassifications: [] }),
    ]),
  ];

  const summary = errorTagSummary(attempts, questions);
  assert.equal(summary.taggedResponses, 1);
  assert.equal(summary.untaggedResponses, 1);
  assert.equal(summary.rows[0].tag, "Time pressure");
});

test("a duplicated tag on one mistake is only counted once", () => {
  const questions = { q1: question("q1") };
  const attempts = [attempt("a1", 1_000_000, [response("q1", { errorClassifications: ["Units", "Units"] })])];

  const summary = errorTagSummary(attempts, questions);
  assert.equal(summary.rows.length, 1);
  assert.equal(summary.rows[0].count, 1);
  assert.equal(summary.totalApplications, 1);
});

test("correct answers and unfinished attempts never contribute a diagnosis", () => {
  const questions = { q1: question("q1"), q2: question("q2") };
  const summary = errorTagSummary(
    [
      attempt("a1", 1_000_000, [response("q1", { correct: true, selectedAnswer: "A", finalAnswer: "A", errorClassifications: ["Algebra"] })]),
      attempt("a2", 2_000_000, [response("q2", { errorClassifications: ["Algebra"] })], { rawScore: null }),
    ],
    questions,
  );
  assert.equal(summary.taggedResponses, 0);
  assert.equal(summary.untaggedResponses, 0);
  assert.equal(summary.leading, null);
});

test("a trend is withheld until enough mistakes are diagnosed", () => {
  const questions = Object.fromEntries(Array.from({ length: 4 }, (_, index) => [`q${index}`, question(`q${index}`)]));
  const summary = errorTagSummary(
    [attempt("a1", 1_000_000, Array.from({ length: 4 }, (_, index) => response(`q${index}`, { errorClassifications: ["Algebra"] })))],
    questions,
  );
  assert.equal(summary.taggedResponses, 4);
  assert.equal(summary.rows[0].trend, "insufficient data");
});

test("a cause that grows as a share of recent mistakes is reported as rising", () => {
  const questions = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`q${index}`, question(`q${index}`)]));
  // Earlier half: all Arithmetic. Recent half: all Time pressure.
  const earlier = attempt("a1", 1_000_000, Array.from({ length: 6 }, (_, index) => response(`q${index}`, { errorClassifications: ["Arithmetic"] })));
  const recent = attempt("a2", 5_000_000, Array.from({ length: 6 }, (_, index) => response(`q${index + 6}`, { errorClassifications: ["Time pressure"] })));

  const summary = errorTagSummary([earlier, recent], questions);
  const byTag = Object.fromEntries(summary.rows.map((row) => [row.tag, row]));
  assert.equal(byTag["Time pressure"].trend, "new");
  assert.equal(byTag.Arithmetic.trend, "falling");
});

/* ------------------------------------------------------------ study consistency -- */

/**
 * A fixed local "now". Wall-clock time would make these cases pass or fail depending on
 * the hour they run: a fixture placed at midday is in the future before noon, and the
 * activity model correctly refuses to count future-dated work.
 */
const NOW = new Date(2026, 7, 14, 15, 0, 0).getTime();
const MORNING = 9 * 60 * 60 * 1000;

/** 09:00 on the local day `offset` days from NOW, so no fixture straddles midnight. */
function dayAt(now: number, offset: number): number {
  return localDayOffset(localDayStart(now), offset) + MORNING;
}

test("a streak counts consecutive local days and survives an unworked today", () => {
  const now = NOW;
  const yesterday = attempt("a1", dayAt(now, -1), [response("q1")]);
  const twoDaysAgo = attempt("a2", dayAt(now, -2), [response("q2")]);
  const threeDaysAgo = attempt("a3", dayAt(now, -3), [response("q3")]);

  const activity = studyActivity([yesterday, twoDaysAgo, threeDaysAgo], now);
  assert.equal(activity.studiedToday, false);
  assert.equal(activity.currentStreak, 3);
  assert.equal(activity.longestStreak, 3);
  assert.equal(activity.activeDays, 3);
});

test("a whole missed day ends the streak", () => {
  const now = NOW;
  const activity = studyActivity(
    [
      attempt("a1", dayAt(now, -2), [response("q1")]),
      attempt("a2", dayAt(now, -3), [response("q2")]),
    ],
    now,
  );
  assert.equal(activity.currentStreak, 0);
  assert.equal(activity.longestStreak, 2);
});

test("working today extends the streak and is reported separately", () => {
  const now = NOW;
  const activity = studyActivity(
    [
      attempt("a1", dayAt(now, 0), [response("q1")]),
      attempt("a2", dayAt(now, -1), [response("q2")]),
    ],
    now,
  );
  assert.equal(activity.studiedToday, true);
  assert.equal(activity.currentStreak, 2);
});

test("the longest streak looks past the rendered heatmap window", () => {
  const now = NOW;
  // Four consecutive days a year ago, far outside the 26-week render window.
  const old = [400, 399, 398, 397].map((offset, index) => attempt(`old${index}`, dayAt(now, -offset), [response(`q${index}`)]));
  const activity = studyActivity([...old, attempt("recent", dayAt(now, 0), [response("qr")])], now);
  assert.equal(activity.longestStreak, 4);
  assert.equal(activity.currentStreak, 1);
  assert.equal(activity.activeDays, 5);
  assert.equal(activity.activeDaysInWindow, 1);
});

test("unfinished, zero-length and future-dated attempts never create a study day", () => {
  const now = NOW;
  const activity = studyActivity(
    [
      attempt("unfinished", dayAt(now, 0), [response("q1")], { rawScore: null }),
      attempt("zero", dayAt(now, -1), [response("q2")], { durationMs: 0 }),
      attempt("noEnd", dayAt(now, -2), [response("q3")], { endedAt: null }),
      attempt("future", dayAt(now, 3), [response("q4")]),
    ],
    now,
  );
  assert.equal(activity.activeDays, 0);
  assert.equal(activity.currentStreak, 0);
  assert.equal(activity.busiestDay, null);
  assert.equal(activity.totalStudyMs, 0);
});

test("the heatmap is a whole number of Monday-first weeks ending today", () => {
  const now = NOW;
  const activity = studyActivity([attempt("a1", dayAt(now, 0), [response("q1")])], now, 26);

  assert.equal(activity.weeks.every((week) => week.days.length === 7), true);
  // Every rendered day is a Monday-first column: row 0 must be a Monday.
  for (const week of activity.weeks) {
    const first = week.days.find((day) => day !== null);
    if (week.days[0]) assert.equal(new Date(week.days[0].dayStart).getDay(), 1);
    assert.ok(first !== undefined);
  }
  // Days after today are placeholders, and today is the last real cell.
  const realDays = activity.weeks.flatMap((week) => week.days).filter((day): day is NonNullable<typeof day> => day !== null);
  const todayKey = activity.weeks.flatMap((week) => week.days).filter(Boolean).at(-1);
  assert.equal(todayKey?.dayStart, localDayStart(now));
  assert.ok(realDays.length >= 26 * 7 - 6);
});

test("study intensity uses fixed minute thresholds, not a self-rescaling quantile", () => {
  const now = NOW;
  const withMinutes = (minutes: number) =>
    studyActivity([attempt("a1", dayAt(now, 0), [response("q1")], { durationMs: minutes * 60_000 })], now)
      .weeks.flatMap((week) => week.days)
      .filter(Boolean)
      .at(-1)?.level;

  assert.equal(withMinutes(5), 1);
  assert.equal(withMinutes(20), 2);
  assert.equal(withMinutes(45), 3);
  assert.equal(withMinutes(90), 4);
});

test("several sessions on one day accumulate into a single cell", () => {
  const now = NOW;
  const activity = studyActivity(
    [
      attempt("a1", dayAt(now, 0), [response("q1"), response("q2")], { durationMs: 600_000 }),
      attempt("a2", dayAt(now, 0) + 3_600_000, [response("q3")], { durationMs: 900_000 }),
    ],
    now,
  );
  const today = activity.weeks.flatMap((week) => week.days).filter(Boolean).at(-1);
  assert.equal(today?.sessions, 2);
  assert.equal(today?.questions, 3);
  assert.equal(today?.studyMs, 1_500_000);
  assert.equal(activity.busiestDay?.studyMs, 1_500_000);
});
