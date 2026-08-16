/**
 * Writing on the question, as a candidate meets it: the toggle, the tools, the magnification
 * and what happens to the question underneath.
 *
 * jsdom has no canvas, so no ink is drawn here — the stroke model itself is covered by
 * `tests/scratch.test.ts`. What is covered is everything around it, including the promises
 * that matter most: writing can always be switched off, the question can always be made
 * smaller as well as larger, and the answer options are never taken off the screen.
 */

import "./dom-setup";

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExamPlayer, QUESTION_ZOOM_STEPS, fitPageZoom, nearestZoomStep } from "../app/esat-app";
import { AnnotationToolbar, EMPTY_ANNOTATION_STATUS, type AnnotationStatus, type ScratchPreferences } from "../app/scratchpad";
import { MIN_QUESTION_ZOOM, MAX_QUESTION_ZOOM, defaultState, type Attempt, type Question, type ResponseRecord, type Settings } from "../app/lib/core";
import type { ScratchTool } from "../app/lib/scratch";

afterEach(cleanup);

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    questionBankVersion: "test",
    year: 2019,
    sourceExam: "NSAA",
    sourcePaper: "paper.pdf",
    sourceSection: "Section 1",
    sourcePart: "A",
    originalQuestionNumber: 4,
    sourcePage: 1,
    sourcePages: [1],
    targetModule: "maths1",
    esatTopic: "Algebra",
    esatSubtopic: "Quadratics",
    specificationVersion: "test",
    questionImage: "questions/2019/q04.webp",
    answerOptions: ["A", "B", "C", "D", "E"],
    correctAnswer: "C",
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

function response(questionId: string): ResponseRecord {
  return {
    questionId, selectedAnswer: null, firstSelectedAnswer: null, finalAnswer: null, correct: null,
    unanswered: true, timeSpentMs: 0, visits: 1, flagged: false, confidence: null,
    answerChanges: [], errorClassifications: [], firstExposure: true, timestamps: [],
  };
}

function attempt(): Attempt {
  return {
    attemptId: "a1", mode: "practice", module: "maths1", questionIds: ["q1"],
    questionBankVersion: "t", specificationVersion: "t", scoreConversionVersion: "t", benchmarkVersion: "t",
    startedAt: 1_760_000_000_000, endsAt: null, pausedAt: null, totalPausedDuration: 0, endedAt: null,
    durationMs: null, strictTimed: false, generated: true, originalHistoricSet: false,
    sourceYears: [2019], sourceExams: ["NSAA"], sourceSetLabel: "NSAA 2019", currentIndex: 0,
    lastVisitStartedAt: 1_760_000_000_000, responses: { q1: response("q1") },
    completionStatus: "active", rawScore: null, freshQuestionCount: 1, sequenceRemaining: [], sequenceSource: "archive",
  };
}

function playerProps(overrides: Record<string, unknown> = {}) {
  const settings = defaultState().settings;
  return {
    attempt: attempt(),
    questionMap: { q1: question("q1") },
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
    writingEnabled: true,
    writingReady: true,
    questionZoom: settings.questionZoom,
    questionHideOptions: settings.questionHideOptions,
    questionOptionTrim: settings.questionOptionTrim,
    scratchPageFor: () => null,
    onScratchChange: () => undefined,
    scratchPreferences: { colour: "ink" as const, size: 2 as const, stylusOnly: false },
    onScratchPreferencesChange: () => undefined,
    ...overrides,
  };
}

/* --------------------------------------------------------------------- the toggle -- */

test("writing is absent, and unmentioned, when it is switched off", () => {
  render(<ExamPlayer {...playerProps({ writingEnabled: false })} />);
  assert.equal(screen.queryByRole("group", { name: "Writing tool" }), null);
  assert.equal(screen.queryByRole("img", { name: /Writing layer/ }), null);
  // With no handler the toggle itself is not offered either, so a host that does not
  // support writing shows no dead control.
  assert.equal(screen.queryByRole("button", { name: /Write/ }), null);
});

test("the toggle stops writing, and says which key brings it back", () => {
  const changes: boolean[] = [];
  render(<ExamPlayer {...playerProps({ onWritingChange: (value: boolean) => changes.push(value) })} />);

  const toggle = screen.getByRole("button", { name: /Writing on/ });
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  fireEvent.click(toggle);
  assert.deepEqual(changes, [false]);
  assert.match(toggle.getAttribute("title") ?? "", /\(W\)/);

  // The toolbar offers the same way out, for a hand that is already on the paper.
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  assert.deepEqual(changes, [false, false]);
});

test("the writing layer sits on the question, not beside it, and the options stay reachable", () => {
  const { container } = render(<ExamPlayer {...playerProps()} />);

  const page = container.querySelector(".question-page");
  assert.ok(page, "the question renders as a page");
  // A direct child of the page, so it covers the question and any blank paper below it —
  // not just the clipped part of the crop.
  assert.ok(page?.querySelector(":scope > .annotation-layer"), "the writing layer covers the whole page");
  assert.ok(container.querySelector(".question-clip > .question-content"), "the crop is clipped inside the page");
  // Nothing takes a column from the answers: the player has one question and one panel.
  assert.equal(container.querySelectorAll(".exam-content > section").length, 1);
  assert.ok(screen.getByRole("radiogroup", { name: "Answer options" }));
  assert.equal(screen.getAllByRole("radio").length, 5);
});

test("the player waits for stored writing rather than showing a blank layer over it", () => {
  render(<ExamPlayer {...playerProps({ writingReady: false })} />);
  assert.ok(screen.getByText(/Restoring what you wrote/));
  assert.equal(screen.queryByRole("group", { name: "Writing tool" }), null);
});

/* ----------------------------------------------------------------------- the zoom -- */

test("the question can be made smaller as well as larger, and the ramp is bounded", () => {
  const patches: Array<Partial<Settings>> = [];
  const onQuestionViewChange = (patch: Partial<Settings>) => patches.push(patch);
  const { rerender } = render(<ExamPlayer {...playerProps({ onQuestionViewChange })} />);

  // 100% is the width that fits, so zooming out from it must be possible.
  assert.ok(screen.getByText("100%"));
  fireEvent.click(screen.getByRole("button", { name: "Show the question smaller" }));
  assert.ok((patches[0].questionZoom ?? 1) < 1, `expected a smaller zoom, got ${patches[0].questionZoom}`);

  rerender(<ExamPlayer {...playerProps({ onQuestionViewChange, questionZoom: MIN_QUESTION_ZOOM })} />);
  assert.ok(screen.getByText("40%"));
  assert.equal((screen.getByRole("button", { name: "Show the question smaller" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "Show the question larger" }) as HTMLButtonElement).disabled, false);

  rerender(<ExamPlayer {...playerProps({ onQuestionViewChange, questionZoom: MAX_QUESTION_ZOOM })} />);
  assert.ok(screen.getByText("300%"));
  assert.equal((screen.getByRole("button", { name: "Show the question larger" }) as HTMLButtonElement).disabled, true);
});

test("the zoom ramp spans out and in, and every step is reachable from a stored value", () => {
  assert.ok(QUESTION_ZOOM_STEPS[0] <= MIN_QUESTION_ZOOM);
  assert.equal(QUESTION_ZOOM_STEPS[QUESTION_ZOOM_STEPS.length - 1], MAX_QUESTION_ZOOM);
  assert.ok(QUESTION_ZOOM_STEPS.includes(1), "fit-to-width must be one of the steps");
  assert.ok(QUESTION_ZOOM_STEPS.some((step) => step < 1), "there must be steps that zoom out");

  // A value from an older build, or a hand-edited one, snaps onto the ramp.
  assert.equal(nearestZoomStep(1.4), 1.5);
  assert.equal(nearestZoomStep(0.01), QUESTION_ZOOM_STEPS[0]);
  assert.equal(nearestZoomStep(99), MAX_QUESTION_ZOOM);
  for (const step of QUESTION_ZOOM_STEPS) assert.equal(nearestZoomStep(step), step);
});

test("fitting the page shows the whole question, in both directions", () => {
  // A tall question in a short frame has to shrink to fit its height.
  assert.equal(fitPageZoom(1000, 500, 1), 0.5);
  // A short, wide one is already limited by the width, so fit never magnifies past 1 —
  // otherwise "fit" would push the sides of the question off the screen.
  assert.equal(fitPageZoom(800, 800, 0.5), 1);
  assert.equal(fitPageZoom(1000, 10_000, 1), 1);
  // Never below what the control can undo, and never nonsense from a zero-sized frame.
  assert.equal(fitPageZoom(1000, 10, 1), MIN_QUESTION_ZOOM);
  assert.equal(fitPageZoom(0, 0, 0), 1);
});

test("the fit control is offered beside the zoom steps", () => {
  const patches: Array<Partial<Settings>> = [];
  render(<ExamPlayer {...playerProps({ onQuestionViewChange: (patch: Partial<Settings>) => patches.push(patch) })} />);
  fireEvent.click(screen.getByRole("button", { name: "Fit the whole question on screen" }));
  assert.equal(patches.length, 1);
  assert.ok(typeof patches[0].questionZoom === "number");
});

/* ------------------------------------------------------------------ the option list -- */

test("the printed option list can be hidden, and the answer panel still lists the options", () => {
  const patches: Array<Partial<Settings>> = [];
  const onQuestionViewChange = (patch: Partial<Settings>) => patches.push(patch);
  const { container, rerender } = render(<ExamPlayer {...playerProps({ onQuestionViewChange })} />);

  const hide = screen.getByRole("button", { name: /Options/ });
  assert.equal(hide.getAttribute("aria-pressed"), "false");
  assert.equal(container.querySelector(".question-trim-line"), null);
  fireEvent.click(hide);
  assert.deepEqual(patches, [{ questionHideOptions: true }]);

  rerender(<ExamPlayer {...playerProps({ questionHideOptions: true, onQuestionViewChange })} />);
  assert.equal(screen.getByRole("button", { name: /Options/ }).getAttribute("aria-pressed"), "true");
  assert.equal(screen.getAllByRole("radio").length, 5, "the options must remain answerable");

  // The cut is a line the candidate can see and move, not a fixed guess: no two papers put
  // their option list in the same place.
  const line = screen.getByRole("slider", { name: "Where the printed options begin" });
  assert.equal(line.getAttribute("aria-valuenow"), "28");
  fireEvent.keyDown(line, { key: "ArrowUp" });
  assert.deepEqual(patches[1], { questionOptionTrim: 0.29 });
  fireEvent.keyDown(line, { key: "ArrowDown", shiftKey: true });
  assert.deepEqual(patches[2], { questionOptionTrim: 0.23 });
});

test("an authored question has no printed option list to hide", () => {
  const authored = question("q1", { questionImage: undefined, questionText: "Solve $x^2=4$.", authored: true });
  render(<ExamPlayer {...playerProps({ questionMap: { q1: authored }, onQuestionViewChange: () => undefined })} />);
  assert.equal(screen.queryByRole("button", { name: /Options/ }), null);
  // It is still magnifiable, because a typeset item is composed at a fixed width and scaled.
  assert.ok(screen.getByRole("group", { name: "Question size" }));
});

/* --------------------------------------------------------------- space and moving -- */

test("blank paper can be added below the question, and only while writing", () => {
  const patches: Array<Partial<Settings>> = [];
  const { container, rerender } = render(
    <ExamPlayer {...playerProps({ questionExtraSpace: 0, onQuestionViewChange: (patch: Partial<Settings>) => patches.push(patch) })} />,
  );
  assert.equal(container.querySelector(".question-extra"), null);

  const space = screen.getByRole("group", { name: "Room to write" });
  const buttons = [...space.querySelectorAll("button")];
  assert.deepEqual(buttons.map((button) => button.textContent), ["None", "+½", "+1", "+2"]);
  fireEvent.click(buttons[2]);
  assert.deepEqual(patches, [{ questionExtraSpace: 1 }]);

  rerender(<ExamPlayer {...playerProps({ questionExtraSpace: 1, onQuestionViewChange: () => undefined })} />);
  assert.ok(container.querySelector(".question-extra"), "the blank paper is rendered");

  // With writing switched off there is nothing to write on, so no blank paper is added.
  rerender(<ExamPlayer {...playerProps({ writingEnabled: false, questionExtraSpace: 1 })} />);
  assert.equal(container.querySelector(".question-extra"), null);
});

test("the Move tool makes a drag move the question rather than doing nothing", () => {
  const { container, rerender } = render(<ExamPlayer {...playerProps()} />);
  const frame = container.querySelector(".question-frame") as HTMLElement;
  // jsdom does not lay anything out, so scrolling is asserted through the element's own
  // scroll properties, which the handler sets directly.
  Object.defineProperty(frame, "scrollLeft", { value: 0, writable: true, configurable: true });
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });

  // With the pen chosen a drag on the frame must not move the page.
  fireEvent.pointerDown(frame, { pointerId: 1, clientX: 200, clientY: 200, button: 0 });
  fireEvent.pointerMove(frame, { pointerId: 1, clientX: 150, clientY: 120 });
  assert.equal(frame.scrollTop, 0, "the pen writes; it does not drag the page");
  fireEvent.pointerUp(frame, { pointerId: 1 });

  rerender(<ExamPlayer {...playerProps()} />);
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  fireEvent.pointerDown(frame, { pointerId: 2, clientX: 200, clientY: 200, button: 0 });
  fireEvent.pointerMove(frame, { pointerId: 2, clientX: 150, clientY: 120 });
  assert.equal(frame.scrollLeft, 50, "dragging left moves the page right");
  assert.equal(frame.scrollTop, 80, "dragging up moves the page down");
  fireEvent.pointerUp(frame, { pointerId: 2 });

  // Released, further movement is ignored.
  fireEvent.pointerMove(frame, { pointerId: 2, clientX: 10, clientY: 10 });
  assert.equal(frame.scrollTop, 80);
});

test("only one thing moves the question under a finger", () => {
  // Under Move the host pans every kind of pointer, so the browser must not scroll as well.
  const { container, rerender } = render(<ExamPlayer {...playerProps()} />);
  const canvas = () => container.querySelector(".annotation-canvas-live") as HTMLElement;
  assert.equal(canvas().style.touchAction, "none", "a finger writes by default");

  // With touch switched off entirely the browser scrolls the frame and nothing draws.
  rerender(<ExamPlayer {...playerProps({ scratchPreferences: { colour: "ink" as const, size: 2 as const, stylusOnly: true } })} />);
  assert.equal(canvas().style.touchAction, "auto");

  // Under Move the host pans every pointer itself, so the browser must not scroll as well.
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  assert.equal(canvas().style.touchAction, "none", "under Move the host pans, not the browser");
});

test("a middle-button drag moves the question whatever tool is chosen", () => {
  const { container } = render(<ExamPlayer {...playerProps()} />);
  const frame = container.querySelector(".question-frame") as HTMLElement;
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });
  Object.defineProperty(frame, "scrollLeft", { value: 0, writable: true, configurable: true });

  fireEvent.pointerDown(frame, { pointerId: 5, clientX: 100, clientY: 300, button: 1 });
  fireEvent.pointerMove(frame, { pointerId: 5, clientX: 100, clientY: 240 });
  assert.equal(frame.scrollTop, 60);
});

/* ---------------------------------------------------------------------- the tools -- */

function toolbarProps(overrides: Record<string, unknown> = {}) {
  return {
    tool: "pen" as ScratchTool,
    onToolChange: () => undefined,
    preferences: { colour: "ink" as const, size: 2 as const, stylusOnly: false },
    onPreferencesChange: () => undefined,
    status: EMPTY_ANNOTATION_STATUS,
    onUndo: () => undefined,
    onRedo: () => undefined,
    onClear: () => undefined,
    ...overrides,
  };
}

test("the tools include a way to move the question without writing on it", () => {
  const tools: ScratchTool[] = [];
  render(<AnnotationToolbar {...toolbarProps({ onToolChange: (tool: ScratchTool) => tools.push(tool) })} />);

  for (const name of ["Pen", "Highlighter", "Eraser", "Move"]) {
    assert.ok(screen.getByRole("button", { name }), name);
  }
  assert.equal(screen.getByRole("button", { name: "Pen" }).getAttribute("aria-pressed"), "true");
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  assert.deepEqual(tools, ["pan"]);
});

test("history controls start unavailable and follow the reported status", () => {
  const { rerender } = render(<AnnotationToolbar {...toolbarProps()} />);
  for (const name of ["Undo", "Redo", "Erase everything on this question"]) {
    assert.equal((screen.getByRole("button", { name }) as HTMLButtonElement).disabled, true, name);
  }

  const status: AnnotationStatus = { strokes: 3, canUndo: true, canRedo: false, fill: 0.1 };
  rerender(<AnnotationToolbar {...toolbarProps({ status })} />);
  assert.equal((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled, false);
  assert.equal((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "Erase everything on this question" }) as HTMLButtonElement).disabled, false);
});

test("choosing an ink while erasing or moving means writing again", () => {
  const patches: Array<Partial<ScratchPreferences>> = [];
  const tools: ScratchTool[] = [];
  const { rerender } = render(<AnnotationToolbar {...toolbarProps({
    tool: "eraser",
    onPreferencesChange: (patch: Partial<ScratchPreferences>) => patches.push(patch),
    onToolChange: (tool: ScratchTool) => tools.push(tool),
  })} />);

  fireEvent.click(screen.getByRole("button", { name: "Blue ink" }));
  assert.deepEqual(patches, [{ colour: "blue" }]);
  assert.deepEqual(tools, ["pen"]);

  // Choosing an ink while already writing changes nothing but the ink.
  rerender(<AnnotationToolbar {...toolbarProps({
    onPreferencesChange: (patch: Partial<ScratchPreferences>) => patches.push(patch),
    onToolChange: (tool: ScratchTool) => tools.push(tool),
  })} />);
  fireEvent.click(screen.getByRole("button", { name: "Red ink" }));
  assert.deepEqual(patches[1], { colour: "red" });
  assert.deepEqual(tools, ["pen"]);

  fireEvent.click(screen.getByRole("button", { name: "Broad nib" }));
  assert.deepEqual(patches[2], { size: 3 });
});
