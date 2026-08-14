/**
 * Component tests.
 *
 * These cover behaviour the type checker and the build cannot: what a candidate actually
 * sees and what happens when they interact with it. The pure libraries are tested
 * elsewhere; this file exists for the rendering and event-handling layer on top of them.
 */

import "./dom-setup";

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  ErrorCausesPanel,
  ExamPlayer,
  MistakesView,
  NumberSetting,
  QuestionTimingPanel,
  ScoreEvidenceNotice,
  StudyConsistencyPanel,
} from "../app/esat-app";
import { studyActivity } from "../app/lib/insights";
import { scoreReportForAttempt } from "../app/lib/scoring";
import {
  defaultState,
  localDayOffset,
  localDayStart,
  type Attempt,
  type ModuleId,
  type Question,
  type ResponseRecord,
  type StoredState,
} from "../app/lib/core";

afterEach(cleanup);

/* ------------------------------------------------------------------- fixtures -- */

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    questionBankVersion: "test",
    year: 2019,
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
    questionText: "Solve $x^2 - 5x + 6 = 0$.",
    optionText: { A: "$x=2$ or $x=3$", B: "$x=1$ or $x=6$", C: "$x=-2$ or $x=-3$", D: "No real roots" },
    answerOptions: ["A", "B", "C", "D"],
    correctAnswer: "A",
    excluded: false,
    exclusionReason: null,
    reviewRequired: false,
    importConfidence: "high",
    sourceHash: "hash",
    imageHash: "hash",
    searchText: "",
    ...overrides,
  };
}

function response(questionId: string, overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    questionId,
    selectedAnswer: null,
    firstSelectedAnswer: null,
    finalAnswer: null,
    correct: null,
    unanswered: true,
    timeSpentMs: 0,
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

function attempt(responses: ResponseRecord[], overrides: Partial<Attempt> = {}): Attempt {
  return {
    attemptId: "attempt-1",
    mode: "practice",
    module: "maths1",
    questionIds: responses.map((item) => item.questionId),
    questionBankVersion: "test",
    specificationVersion: "test",
    scoreConversionVersion: "test",
    benchmarkVersion: "test",
    startedAt: 1_760_000_000_000,
    endsAt: null,
    pausedAt: null,
    totalPausedDuration: 0,
    endedAt: 1_760_000_600_000,
    durationMs: 600_000,
    strictTimed: false,
    generated: true,
    originalHistoricSet: false,
    sourceYears: [2019],
    sourceExams: ["NSAA"],
    sourceSetLabel: "Practice set",
    sequenceSource: "archive",
    currentIndex: 0,
    lastVisitStartedAt: 1_760_000_000_000,
    responses: Object.fromEntries(responses.map((item) => [item.questionId, item])),
    completionStatus: "submitted",
    rawScore: responses.filter((item) => item.correct).length,
    freshQuestionCount: responses.length,
    ...overrides,
  };
}

function questionMapFor(ids: string[], overrides: Partial<Question> = {}): Record<string, Question> {
  return Object.fromEntries(ids.map((id) => [id, question(id, overrides)]));
}

/* --------------------------------------------------------------- NumberSetting -- */

test("a numeric setting can be cleared and retyped without snapping to the minimum", () => {
  const committed: number[] = [];
  render(<NumberSetting id="target" value={7} min={1} max={9} step={0.1} decimals={1} onCommit={(v) => committed.push(v)} />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;

  assert.equal(input.value, "7.0");
  // Clearing the field used to parse as 0 and immediately clamp to 1, making the value
  // impossible to replace by typing.
  fireEvent.change(input, { target: { value: "" } });
  assert.equal(input.value, "");
  assert.deepEqual(committed, []);

  fireEvent.change(input, { target: { value: "8.4" } });
  fireEvent.blur(input);
  assert.deepEqual(committed, [8.4]);
});

test("a numeric setting clamps and rounds only once the edit is finished", () => {
  const committed: number[] = [];
  render(<NumberSetting id="hours" value={8} min={1} max={40} step={1} onCommit={(v) => committed.push(v)} />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;

  fireEvent.change(input, { target: { value: "500" } });
  fireEvent.blur(input);
  fireEvent.change(input, { target: { value: "-3" } });
  fireEvent.blur(input);
  fireEvent.change(input, { target: { value: "not a number" } });
  fireEvent.blur(input);

  assert.deepEqual(committed, [40, 1]);
});

/* ---------------------------------------------------------- QuestionTimingPanel -- */

test("the review reports the seconds spent on every question, tagged by outcome", () => {
  const responses = [
    response("q1", { selectedAnswer: "A", finalAnswer: "A", correct: true, unanswered: false, timeSpentMs: 64_000 }),
    response("q2", { selectedAnswer: "B", finalAnswer: "B", correct: false, unanswered: false, timeSpentMs: 143_400 }),
    response("q3", { correct: false, unanswered: true, timeSpentMs: 21_000 }),
  ];
  render(<QuestionTimingPanel attempt={attempt(responses)} questionMap={questionMapFor(["q1", "q2", "q3"])} />);

  const rows = screen.getAllByRole("listitem");
  assert.equal(rows.length, 3);
  assert.ok(within(rows[0]).getByText("64 s"));
  // 143.4s rounds to the nearest whole second, not truncated.
  assert.ok(within(rows[1]).getByText("143 s"));
  assert.ok(within(rows[2]).getByText("21 s"));
  assert.ok(within(rows[0]).getByText("Correct"));
  assert.ok(within(rows[1]).getByText("Wrong"));
  assert.ok(within(rows[2]).getByText("Blank"));
  // The reference pace is stated so the bars mean something.
  assert.ok(screen.getByText(/Reference 89 s/));
  assert.ok(screen.getByText(/Quickest was Q3 at 21 s; longest was Q2 at 143 s/));
});

test("per-question timing bars stay within the track and mark the ESAT reference", () => {
  const responses = [
    response("q1", { selectedAnswer: "A", correct: true, unanswered: false, timeSpentMs: 10_000 }),
    response("q2", { selectedAnswer: "B", correct: false, unanswered: false, timeSpentMs: 300_000 }),
  ];
  const { container } = render(
    <QuestionTimingPanel attempt={attempt(responses)} questionMap={questionMapFor(["q1", "q2"])} />,
  );

  const list = container.querySelector(".timing-list") as HTMLElement;
  const marker = list.style.getPropertyValue("--pace-marker");
  assert.ok(marker.endsWith("%"));
  assert.ok(Number.parseFloat(marker) > 0 && Number.parseFloat(marker) < 100, `marker off-track: ${marker}`);

  const widths = [...container.querySelectorAll<HTMLElement>(".timing-bar")].map((bar) => Number.parseFloat(bar.style.width));
  assert.equal(widths.length, 2);
  for (const width of widths) assert.ok(width > 0 && width <= 100, `bar width out of range: ${width}`);
  // The slowest question defines the scale, so it fills the track.
  assert.equal(Math.round(Math.max(...widths)), 100);
});

test("timing panel renders nothing rather than dividing by zero on an empty attempt", () => {
  const { container } = render(<QuestionTimingPanel attempt={attempt([])} questionMap={{}} />);
  assert.equal(container.innerHTML, "");
});

test("a single-question retry reports its time without a quickest/longest comparison", () => {
  // Retrying one question from the mistakes queue is the common case here.
  const single = [response("q1", { selectedAnswer: "A", finalAnswer: "A", correct: true, unanswered: false, timeSpentMs: 45_000 })];
  render(<QuestionTimingPanel attempt={attempt(single, { mode: "retry", durationMs: 45_000 })} questionMap={questionMapFor(["q1"])} />);

  assert.equal(screen.getAllByRole("listitem").length, 1);
  assert.ok(screen.getByText(/You spent/));
  assert.ok(screen.getByText("45 s", { selector: ".timing-value" }));
  assert.equal(screen.queryByText(/Quickest was/), null);
  assert.equal(screen.queryByText(/longest was/), null);
});

/* -------------------------------------------------------------- ErrorCausesPanel -- */

test("mistake causes are ranked, counted and attributed to their topics", () => {
  const responses = [
    response("q1", { correct: false, unanswered: false, selectedAnswer: "B", errorClassifications: ["Time pressure", "Algebra"] }),
    response("q2", { correct: false, unanswered: false, selectedAnswer: "C", errorClassifications: ["Time pressure"] }),
    response("q3", { correct: true, unanswered: false, selectedAnswer: "A" }),
  ];
  const map = {
    q1: question("q1", { esatTopic: "Algebra" }),
    q2: question("q2", { esatTopic: "Geometry", targetModule: "physics" as ModuleId }),
    q3: question("q3"),
  };
  render(<ErrorCausesPanel attempts={[attempt(responses)]} questionMap={map} />);

  const rows = [...document.querySelectorAll<HTMLElement>(".cause-row")];
  assert.equal(rows.length, 2);
  const causeName = (row: HTMLElement) => row.querySelector(".cause-name strong")?.textContent;
  const causeCount = (row: HTMLElement) => row.querySelector(".cause-count strong")?.textContent;
  const causeTopics = (row: HTMLElement) => row.querySelector(".cause-name small")?.textContent;

  // Most frequent cause first.
  assert.equal(causeName(rows[0]), "Time pressure");
  assert.equal(causeCount(rows[0]), "2");
  assert.equal(causeName(rows[1]), "Algebra");
  assert.equal(causeCount(rows[1]), "1");
  // The cause spans both modules it was recorded in, and names their topics.
  assert.equal(rows[0].querySelectorAll(".cause-modules .module-dot").length, 2);
  assert.ok(causeTopics(rows[0])?.includes("Algebra"));
  assert.ok(causeTopics(rows[0])?.includes("Geometry"));
  assert.ok(screen.getByText(/most often/));
});

test("mistake causes prompt for diagnosis instead of showing an empty chart", () => {
  const responses = [response("q1", { correct: false, unanswered: false, selectedAnswer: "B" })];
  render(<ErrorCausesPanel attempts={[attempt(responses)]} questionMap={questionMapFor(["q1"])} />);

  assert.equal(document.querySelectorAll(".cause-row").length, 0);
  assert.ok(screen.getByText("No causes recorded yet"));
  assert.ok(screen.getByText(/1 missed question with no diagnosis/));
});

test("mistake causes report how much evidence is still undiagnosed", () => {
  const responses = [
    response("q1", { correct: false, unanswered: false, selectedAnswer: "B", errorClassifications: ["Units"] }),
    response("q2", { correct: false, unanswered: false, selectedAnswer: "C" }),
  ];
  render(<ErrorCausesPanel attempts={[attempt(responses)]} questionMap={questionMapFor(["q1", "q2"])} />);
  assert.ok(screen.getByText(/1 missed question has no cause recorded \(50% diagnosed\)/));
});

/* --------------------------------------------------------- StudyConsistencyPanel -- */

test("the study calendar reports a live streak and renders whole weeks", () => {
  const now = new Date(2026, 7, 14, 15, 0, 0).getTime();
  const at = (offset: number) => localDayOffset(localDayStart(now), offset) + 9 * 60 * 60 * 1000;
  const activity = studyActivity(
    [0, -1, -2].map((offset, index) => attempt([response(`q${index}`)], {
      attemptId: `a${index}`,
      endedAt: at(offset),
      durationMs: 1_800_000,
    })),
    now,
  );
  const { container } = render(<StudyConsistencyPanel activity={activity} />);

  // Each tile is a label and a value; read the value beside its own label so the
  // assertion cannot be satisfied by a matching number somewhere else on the panel.
  const tileValue = (label: string) =>
    (screen.getByText(label).closest("div") as HTMLElement).querySelector("strong")?.textContent;
  assert.equal(tileValue("Current streak"), "3days");
  assert.equal(tileValue("Longest streak"), "3days");
  assert.equal(tileValue("Days studied"), "3");
  assert.ok(screen.getByText("Today is already recorded.", { exact: false }));
  // 26 whole Monday-first columns of seven cells each.
  const weeks = container.querySelectorAll(".heatmap-week");
  assert.ok(weeks.length >= 26);
  for (const week of weeks) assert.equal(week.querySelectorAll(".heatmap-cell").length, 7);
  assert.equal(container.querySelector(".heatmap-grid")?.getAttribute("role"), "img");
});

test("the study calendar tells an inactive candidate how to start a streak", () => {
  const activity = studyActivity([], new Date(2026, 7, 14, 15, 0, 0).getTime());
  render(<StudyConsistencyPanel activity={activity} />);
  assert.ok(screen.getByText(/Record any completed session today to start a streak/));
});

/* ------------------------------------------------------------------ ExamPlayer -- */

function playerProps(overrides: Record<string, unknown> = {}) {
  const responses = [response("q1"), response("q2")];
  return {
    attempt: attempt(responses, { completionStatus: "active" as const, endedAt: null, rawScore: null, endsAt: null }),
    questionMap: questionMapFor(["q1", "q2"]),
    now: 1_760_000_100_000,
    reviewOpen: false,
    setReviewOpen: () => undefined,
    onSelect: () => undefined,
    onClear: () => undefined,
    onNavigate: () => undefined,
    onFlag: () => undefined,
    onConfidence: () => undefined,
    onFinish: () => undefined,
    onExit: () => undefined,
    onPause: () => undefined,
    pacingAid: false,
    multiTabWarning: false,
    dismissMultiTab: () => undefined,
    ...overrides,
  };
}

test("the exam player shows the question, its options and the answered count", () => {
  render(<ExamPlayer {...playerProps()} />);

  assert.ok(screen.getByText("Question 1 of 2"));
  assert.ok(screen.getByRole("radiogroup", { name: "Answer options" }));
  assert.equal(screen.getAllByRole("radio").length, 4);
  assert.ok(screen.getByText("Review (0/2)"));
  // Maths markup is typeset, never shown as source.
  assert.equal(document.body.textContent?.includes("\\frac"), false);
});

test("choosing an option reports the letter and marks the control as checked", () => {
  const selected: string[] = [];
  const props = playerProps({ onSelect: (letter: string) => selected.push(letter) });
  const { rerender } = render(<ExamPlayer {...props} />);

  fireEvent.click(screen.getAllByRole("radio")[1]);
  assert.deepEqual(selected, ["B"]);

  // The player is controlled, so the parent's updated attempt drives the checked state.
  const answered = attempt(
    [response("q1", { selectedAnswer: "B", unanswered: false }), response("q2")],
    { completionStatus: "active", endedAt: null, rawScore: null, endsAt: null },
  );
  rerender(<ExamPlayer {...playerProps({ attempt: answered })} />);
  assert.equal(screen.getAllByRole("radio")[1].getAttribute("aria-checked"), "true");
  assert.ok(screen.getByText("Review (1/2)"));
  assert.ok(screen.getByText("Clear selection"));
});

test("flagging is a pressed toggle and previous is disabled on the first question", () => {
  let flags = 0;
  render(<ExamPlayer {...playerProps({ onFlag: () => { flags += 1; } })} />);

  const flag = screen.getByRole("button", { name: /Flag for review/ });
  assert.equal(flag.getAttribute("aria-pressed"), "false");
  fireEvent.click(flag);
  assert.equal(flags, 1);

  assert.equal((screen.getByRole("button", { name: /Previous/ }) as HTMLButtonElement).disabled, true);
});

test("an untimed session reads as untimed rather than showing a zeroed clock", () => {
  render(<ExamPlayer {...playerProps()} />);
  assert.ok(screen.getByText("Untimed"));
  assert.ok(screen.getByRole("button", { name: /Pause/ }));
});

test("a strict session offers no pause and shows the remaining time", () => {
  const strict = attempt(
    [response("q1"), response("q2")],
    { completionStatus: "active", endedAt: null, rawScore: null, strictTimed: true, endsAt: 1_760_000_400_000 },
  );
  render(<ExamPlayer {...playerProps({ attempt: strict, now: 1_760_000_100_000 })} />);

  assert.ok(screen.getByText("05:00"));
  assert.equal(screen.queryByRole("button", { name: /Pause/ }), null);
  assert.ok(screen.getByText(/Strict timing continues/));
});

test("a paused session is taken out of the tab order, not just covered", () => {
  const paused = attempt(
    [response("q1"), response("q2")],
    { completionStatus: "active", endedAt: null, rawScore: null, endsAt: null, pausedAt: 1_760_000_050_000 },
  );
  const { container } = render(<ExamPlayer {...playerProps({ attempt: paused })} />);

  assert.ok(screen.getByText("Practice paused"));
  // The overlay hides the session visually; without inert, a keyboard or screen-reader
  // user could still tab into the question underneath and answer it.
  for (const selector of [".exam-header", ".exam-content", ".exam-footer"]) {
    const region = container.querySelector(selector);
    assert.ok(region, `${selector} should be rendered`);
    assert.ok(region.hasAttribute("inert"), `${selector} should be inert while paused`);
  }
  // Resuming must stay reachable.
  assert.equal(screen.getByRole("button", { name: /Resume session/ }).closest("[inert]"), null);
});

test("an active session is fully interactive", () => {
  const { container } = render(<ExamPlayer {...playerProps()} />);
  for (const selector of [".exam-header", ".exam-content", ".exam-footer"]) {
    assert.equal(container.querySelector(selector)?.hasAttribute("inert"), false, `${selector} must not be inert`);
  }
});

test("the player refuses to render a question the bank no longer contains", () => {
  let exited = 0;
  render(<ExamPlayer {...playerProps({ questionMap: {}, onExit: () => { exited += 1; } })} />);

  assert.ok(screen.getByText("This question could not be loaded"));
  fireEvent.click(screen.getByRole("button", { name: "Exit session" }));
  assert.equal(exited, 1);
});

test("the review screen lists every question with its answered state", () => {
  const answered = attempt(
    [response("q1", { selectedAnswer: "C", unanswered: false }), response("q2", { flagged: true })],
    { completionStatus: "active", endedAt: null, rawScore: null, endsAt: null },
  );
  const navigated: number[] = [];
  render(<ExamPlayer {...playerProps({ attempt: answered, reviewOpen: true, onNavigate: (i: number) => navigated.push(i) })} />);

  assert.ok(screen.getByText("Check before submitting"));
  assert.ok(screen.getByText("Answer C"));
  assert.ok(screen.getByText("Unanswered"));
  assert.ok(screen.getByText(/1 answered · 1 unanswered · 1 flagged/));

  fireEvent.click(screen.getByText("Unanswered").closest("button") as HTMLElement);
  assert.deepEqual(navigated, [1]);
});

/* ----------------------------------------------------------------- MistakesView -- */

function mistakeState(overrides: Partial<StoredState> = {}): StoredState {
  return { ...defaultState(), ...overrides };
}

function mistakesProps(state: StoredState, now: number) {
  return {
    state,
    now,
    questionMap: questionMapFor(["q1", "q2", "q3"]),
    onRetry: () => undefined,
    onRedo: () => undefined,
    onNote: () => undefined,
    scope: "all" as const,
    setScope: () => undefined,
    module: "maths1" as ModuleId,
    setModule: () => undefined,
    timed: false,
    setTimed: () => undefined,
  };
}

test("the queue separates what is ready to redo from what returns tomorrow", () => {
  const now = 1_760_000_000_000;
  const state = mistakeState({
    mistakes: {
      q1: { questionId: "q1", dueDate: now + 86_400_000, intervalDays: 1, correctStreak: 0, lastResult: false },
      q2: { questionId: "q2", dueDate: now - 86_400_000, intervalDays: 1, correctStreak: 0, lastResult: false },
    },
  });
  render(<MistakesView {...mistakesProps(state, now)} />);

  const group = (title: string) => screen.getByRole("heading", { name: new RegExp(`^${title}`) }).closest("section") as HTMLElement;
  assert.equal(group("Due now").querySelectorAll(".mistake-card").length, 1);
  assert.equal(group("Returns tomorrow").querySelectorAll(".mistake-card").length, 1);
  assert.equal(group("Due now").querySelector(".mistake-card .pill")?.textContent, "Ready to redo");
  // The rule appears on the card and in the page intro; check the card's own copy.
  assert.match(group("Due now").querySelector(".mistake-copy p")?.textContent ?? "", /clears for good/);
  // A question waiting overnight says when it returns; a ready one does not.
  assert.match(group("Returns tomorrow").querySelector(".mistake-copy p")?.textContent ?? "", /It returns on/);
  assert.doesNotMatch(group("Due now").querySelector(".mistake-copy p")?.textContent ?? "", /It returns on/);
  // Nothing is ever described as mastered-but-still-queued any more.
  assert.equal(screen.queryByRole("heading", { name: /^Mastered/ }), null);
});

test("a cleared question leaves the queue and is counted as cleared", () => {
  const now = 1_760_000_000_000;
  // q1 was answered correctly, so applyCompletedAttempt removed it from mistakes and
  // marked its progress mastered. Only the still-unresolved q2 remains queued.
  const state = mistakeState({
    mistakes: {
      q2: { questionId: "q2", dueDate: now - 86_400_000, intervalDays: 1, correctStreak: 0, lastResult: false },
    },
    progress: {
      q1: {
        neverSeen: false, firstSeenAt: now, firstAttemptCorrect: false, firstAttemptTime: 1000,
        firstAttemptMode: "practice", totalAttempts: 2, totalCorrect: 1, totalIncorrect: 1,
        mostRecentResult: true, mastered: true, exposureCount: 2, lastAttemptedAt: now,
      },
    },
  });
  render(<MistakesView {...mistakesProps(state, now)} />);

  const strip = document.querySelector(".metric-strip") as HTMLElement;
  const tile = (label: string) => [...strip.querySelectorAll("span")]
    .find((span) => span.textContent?.startsWith(label))?.querySelector("strong")?.textContent;
  assert.equal(tile("Still to resolve"), "1 question");
  assert.equal(tile("Ready to redo"), "1");
  assert.equal(tile("Cleared"), "1");

  // The cleared question must not appear anywhere in the list.
  assert.equal(document.querySelectorAll(".mistake-card").length, 1);
});

test("the queue states the one-correct-answer rule", () => {
  const now = 1_760_000_000_000;
  render(<MistakesView {...mistakesProps(mistakeState(), now)} />);
  const text = document.body.textContent ?? "";
  // The earlier copy promised three delayed successes and that items "leave the queue".
  assert.equal(text.includes("leaves the queue"), false);
  assert.equal(text.includes("delayed correct responses"), false);
  assert.ok(screen.getByText(/comes back once, the next day/));
  assert.ok(screen.getByText(/clears for good/));
});

/* ----------------------------------------------------------- ScoreEvidenceNotice -- */

test("a withheld estimate explains itself instead of leaving a blank", () => {
  const practice = attempt([response("q1", { correct: true, unanswered: false, selectedAnswer: "A" })]);
  const report = scoreReportForAttempt(practice);
  render(<ScoreEvidenceNotice report={report} />);

  assert.equal(report.eligible, false);
  assert.ok(screen.getByRole("note"));
  assert.ok(screen.getByText(report.label));
  assert.ok(screen.getByText(/not representative enough for a cohort estimate/));
});

test("a retrieval session is named as recall practice, not as readiness evidence", () => {
  const retry = attempt([response("q1", { correct: true, unanswered: false, selectedAnswer: "A" })], { mode: "retry" });
  const report = scoreReportForAttempt(retry);
  render(<ScoreEvidenceNotice report={report} />);

  assert.equal(report.reason, "retrieval");
  assert.ok(screen.getByText(/cannot estimate exam standing/));
});
