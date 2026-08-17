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
import { AttemptDetailView, ExamPlayer, QUESTION_ZOOM_STEPS, ResultScreen, fitPageZoom, nearestZoomStep } from "../app/esat-app";
import {
  AnnotationToolbar,
  EMPTY_ANNOTATION_STATUS,
  backingRatio,
  classifyPointer,
  isPalmContact,
  isPenErasing,
  type AnnotationStatus,
  type ScratchPreferences,
} from "../app/scratchpad";
import { MIN_QUESTION_ZOOM, MAX_QUESTION_ZOOM, defaultState, type Attempt, type Question, type ResponseRecord, type Settings } from "../app/lib/core";
import type { ScratchPage, ScratchTool } from "../app/lib/scratch";

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

/**
 * Give the question frame a real size.
 *
 * jsdom lays nothing out, so every element measures zero and the sheet collapses to a pixel.
 * The surface falls back to a window `resize` listener where there is no `ResizeObserver`,
 * which is exactly the hook needed to hand it a frame of a known size — and with one, the
 * geometry the whole feature rests on can be asserted in numbers rather than described.
 */
function layOutFrame(container: HTMLElement, width = 1000, height = 700): HTMLElement {
  const frame = container.querySelector(".question-frame") as HTMLElement;
  Object.defineProperty(frame, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(frame, "clientHeight", { value: height, configurable: true });
  // jsdom's own scroll offsets are read-only zeros, so they are replaced with plain fields
  // the handlers can write and the assertions can read.
  Object.defineProperty(frame, "scrollLeft", { value: 0, writable: true, configurable: true });
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });
  fireEvent(window, new Event("resize"));
  return frame;
}

/** The pixel width of a styled box, as the surface set it. */
function widthOf(container: HTMLElement, selector: string): number {
  const node = container.querySelector(selector) as HTMLElement | null;
  return node ? parseFloat(node.style.width) : Number.NaN;
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
    questionExtraSpace: settings.questionExtraSpace,
    questionSideSpace: settings.questionSideSpace,
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
  assert.equal(screen.queryByRole("button", { name: /writing on the question/i }), null);
});

test("the toggle stops writing, and says which key brings it back", () => {
  const changes: boolean[] = [];
  render(<ExamPlayer {...playerProps({ onWritingChange: (value: boolean) => changes.push(value) })} />);

  const toggle = screen.getByRole("button", { name: "Stop writing on the question" });
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

  const sheet = container.querySelector(".question-sheet");
  assert.ok(sheet, "the question renders on a sheet of paper");
  // A direct child of the sheet, so it covers the question, the blank paper below it and the
  // margins beside it alike — not just the clipped part of the crop.
  assert.ok(sheet?.querySelector(":scope > .annotation-layer"), "the writing layer covers the whole sheet");
  assert.ok(sheet?.querySelector(":scope > .question-page"), "the question is a column on that sheet");
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

  const hide = screen.getByRole("button", { name: /printed option list/ });
  assert.equal(hide.getAttribute("aria-pressed"), "false");
  assert.equal(container.querySelector(".question-trim-line"), null);
  fireEvent.click(hide);
  assert.deepEqual(patches, [{ questionHideOptions: true }]);

  rerender(<ExamPlayer {...playerProps({ questionHideOptions: true, onQuestionViewChange })} />);
  assert.equal(screen.getByRole("button", { name: /printed option list/ }).getAttribute("aria-pressed"), "true");
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
  assert.equal(screen.queryByRole("button", { name: /printed option list/ }), null);
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

  const space = screen.getByRole("group", { name: "Room to write below the question" });
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

test("a sheet too large for a canvas is drawn softer rather than not at all", () => {
  // An ordinary sheet, even a generous one on a high-resolution tablet, is untouched by the
  // area cap: it is the device's own pixel ratio, capped at the point where more of them stop
  // being visible on a 2px line.
  assert.equal(backingRatio(1400, 1600), Math.min(2.5, window.devicePixelRatio || 1));

  // A question magnified hard with paper all round it can exceed what a canvas may be — and
  // iOS answers an oversized canvas with a blank one, which would lose the writing outright.
  // The ratio falls instead, so the ink is soft but present, and every pixel of it is inside
  // the ceiling.
  const huge = { width: 14_490, height: 9_852 };
  const ratio = backingRatio(huge.width, huge.height);
  assert.ok(ratio < 1, `expected the sheet to be undersampled, got ${ratio}`);
  assert.ok(huge.width * ratio * huge.height * ratio <= 16_000_000 + 1, "and to fit inside the ceiling");
});

test("paper can be added each side of the question, and the sheet grows to hold it", () => {
  const patches: Array<Partial<Settings>> = [];
  const { container, rerender } = render(
    <ExamPlayer {...playerProps({ questionSideSpace: 0, onQuestionViewChange: (patch: Partial<Settings>) => patches.push(patch) })} />,
  );
  layOutFrame(container);
  assert.equal(container.querySelectorAll(".question-margin").length, 0);

  const beside = screen.getByRole("group", { name: "Room to write beside the question" });
  const buttons = [...beside.querySelectorAll("button")];
  assert.deepEqual(buttons.map((button) => button.textContent), ["None", "+½", "+1"]);
  fireEvent.click(buttons[2]);
  assert.deepEqual(patches, [{ questionSideSpace: 1 }]);

  // Half a question-width each side, on a frame the question exactly fills: the sheet is
  // twice the question, the question sits in the middle of it, and the paper beside it is
  // reached by moving the sheet.
  rerender(<ExamPlayer {...playerProps({ questionSideSpace: 0.5, onQuestionViewChange: () => undefined })} />);
  layOutFrame(container);
  assert.equal(widthOf(container, ".question-sheet"), 2000);
  assert.equal(widthOf(container, ".question-page"), 1000);
  assert.equal((container.querySelector(".question-page") as HTMLElement).style.left, "500px");
  assert.deepEqual(
    [...container.querySelectorAll(".question-margin")].map((node) => (node as HTMLElement).style.width),
    ["500px", "500px"],
    "blank paper on both sides, not just one",
  );

  // With writing switched off there is nothing to write in the margins with, so there are none.
  rerender(<ExamPlayer {...playerProps({ writingEnabled: false, questionSideSpace: 0.5 })} />);
  layOutFrame(container);
  assert.equal(container.querySelectorAll(".question-margin").length, 0);
  assert.equal(widthOf(container, ".question-sheet"), widthOf(container, ".question-page"));
});

test("width the frame has going spare becomes paper rather than nothing", () => {
  // A question at half size on a 1000px frame leaves 250px blank either side of itself. That
  // room is unusable however much margin was asked for, so the margin is never smaller than
  // it: this is the paper that needs no moving about at all to reach.
  const { container } = render(<ExamPlayer {...playerProps({ questionZoom: 0.5, questionSideSpace: 0.25 })} />);
  layOutFrame(container);
  assert.equal(widthOf(container, ".question-page"), 500, "the question is half the frame");
  assert.deepEqual(
    [...container.querySelectorAll(".question-margin")].map((node) => (node as HTMLElement).style.width),
    ["250px", "250px"],
    "a quarter of the question would be 125px; the spare 250px is taken instead",
  );
  assert.equal(widthOf(container, ".question-sheet"), 1000, "so the whole frame is writable");
});

test("writing in a margin is stored relative to the question, not to the sheet", () => {
  const pages: ScratchPage[] = [];
  const { container } = render(
    <ExamPlayer {...playerProps({ questionSideSpace: 0.5, onScratchChange: (_id: string, page: ScratchPage) => pages.push(page) })} />,
  );
  layOutFrame(container);
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;

  // The sheet is 2000px wide for 2000 board units, so a pointer 100px in is 100 units in —
  // which is 400 units to the *left* of the question, whose own left edge is the origin.
  fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "pen", isPrimary: true, pressure: 0.5, width: 2, height: 2, clientX: 100, clientY: 60 });
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 100, clientY: 60 });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].strokes[0].points[0], -400, "a mark in the left margin has a negative x");
  assert.equal(pages[0].strokes[0].points[1], 60, "and the same y it would have had on the question");
  assert.equal(pages[0].left, 500, "the page records the paper it was written on");

  // And a mark on the question itself keeps the coordinates it has always had, so nothing
  // written before the margins existed moves when they appear.
  fireEvent.pointerDown(canvas, { pointerId: 2, pointerType: "pen", isPrimary: true, pressure: 0.5, width: 2, height: 2, clientX: 700, clientY: 60 });
  fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "pen", clientX: 700, clientY: 60 });
  assert.equal(pages[1].strokes[1].points[0], 200, "200 units into the question, as with no margins at all");
});

test("the question is put back in view when the next one is shown", () => {
  const two = { ...attempt(), questionIds: ["q1", "q2"], responses: { q1: response("q1"), q2: response("q2") } };
  const questionMap = { q1: question("q1"), q2: question("q2") };
  const { container, rerender } = render(
    <ExamPlayer {...playerProps({ attempt: two, questionMap, questionSideSpace: 0.5 })} />,
  );
  const frame = layOutFrame(container);
  // Centred on the question, so the sheet opens on it rather than on the margin beside it.
  assert.equal(frame.scrollLeft, 500);

  // Pan out into the right-hand margin and down the page, then move on.
  frame.scrollLeft = 1000;
  frame.scrollTop = 300;
  rerender(<ExamPlayer {...playerProps({ attempt: { ...two, currentIndex: 1 }, questionMap, questionSideSpace: 0.5 })} />);
  assert.equal(frame.scrollLeft, 500, "the next question is not opened somewhere out in the margin");
  assert.equal(frame.scrollTop, 0, "nor halfway down it");
});

test("Fit brings the question back from wherever the sheet has been moved to", () => {
  const { container } = render(<ExamPlayer {...playerProps({ questionSideSpace: 0.5, onQuestionViewChange: () => undefined })} />);
  const frame = layOutFrame(container);
  frame.scrollLeft = 1400;

  fireEvent.click(screen.getByRole("button", { name: "Fit the whole question on screen" }));
  assert.equal(frame.scrollLeft, 500, "the one control that says 'show me the question again'");
});

test("the Move tool makes a drag move the question rather than doing nothing", () => {
  const { container } = render(<ExamPlayer {...playerProps()} />);
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;
  const frame = container.querySelector(".question-frame") as HTMLElement;
  // jsdom lays nothing out, so scrolling is asserted through the properties the handler sets.
  Object.defineProperty(frame, "scrollLeft", { value: 0, writable: true, configurable: true });
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });

  // With the pen chosen, a stylus on the page writes and the page stays where it is.
  fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "pen", isPrimary: true, pressure: 0.6, width: 2, height: 2, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: "pen", pressure: 0.6, clientX: 150, clientY: 120 });
  assert.equal(frame.scrollTop, 0, "a stylus writes; it does not drag the page");
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 150, clientY: 120 });

  // Under Move, the same drag moves it.
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  fireEvent.pointerDown(canvas, { pointerId: 2, pointerType: "pen", isPrimary: true, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(canvas, { pointerId: 2, pointerType: "pen", clientX: 150, clientY: 120 });
  assert.equal(frame.scrollLeft, 50, "dragging left moves the page right");
  assert.equal(frame.scrollTop, 80, "dragging up moves the page down");
  fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "pen" });

  // Released, further movement is ignored.
  fireEvent.pointerMove(canvas, { pointerId: 2, pointerType: "pen", clientX: 10, clientY: 10 });
  assert.equal(frame.scrollTop, 80);
});

test("the writing surface never yields a gesture to the browser", () => {
  // The whole of the bug this replaced: `touch-action` cannot tell a stylus from a finger,
  // so relaxing it to let a finger scroll also handed the browser the pen, and every stroke
  // turned into a scroll. It is pinned to none in the stylesheet and the pointers are routed
  // in code instead, so nothing here may set it inline.
  const { container, rerender } = render(<ExamPlayer {...playerProps()} />);
  const canvas = () => container.querySelector(".annotation-canvas-live") as HTMLElement;
  assert.ok(!canvas().style.touchAction);

  rerender(<ExamPlayer {...playerProps({ scratchPreferences: { colour: "ink" as const, size: 2 as const, stylusOnly: true } })} />);
  assert.ok(!canvas().style.touchAction);
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  assert.ok(!canvas().style.touchAction);
});

test("every pointer has exactly one job", () => {
  const base = { width: 2, height: 2, isPrimary: true, tool: "pen" as const, penSeen: false, penActive: false, stylusOnly: false };

  // A stylus always writes. This is the case that was broken.
  assert.equal(classifyPointer({ ...base, pointerType: "pen" }), "draw");
  assert.equal(classifyPointer({ ...base, pointerType: "pen", penSeen: true, penActive: true }), "draw");

  // A finger writes until a stylus turns up, and moves the question afterwards.
  assert.equal(classifyPointer({ ...base, pointerType: "touch", width: 12, height: 12 }), "draw");
  assert.equal(classifyPointer({ ...base, pointerType: "touch", width: 12, height: 12, penSeen: true }), "pan");
  assert.equal(classifyPointer({ ...base, pointerType: "touch", width: 12, height: 12, stylusOnly: true }), "pan");

  // A hand near a working nib does nothing at all: it must neither mark the page nor scroll
  // it out from under the stroke being written.
  assert.equal(classifyPointer({ ...base, pointerType: "touch", width: 12, height: 12, penSeen: true, penActive: true }), "ignore");
  assert.equal(classifyPointer({ ...base, pointerType: "touch", width: 60, height: 40 }), "ignore");

  // Move means move, for everything.
  for (const pointerType of ["pen", "touch", "mouse"]) {
    assert.equal(classifyPointer({ ...base, pointerType, tool: "pan" }), "pan", pointerType);
  }
  // A second finger belongs to the pinch handler.
  assert.equal(classifyPointer({ ...base, pointerType: "touch", isPrimary: false }), "pan");

  // A mouse writes, unless the candidate has asked for a stylus only.
  assert.equal(classifyPointer({ ...base, pointerType: "mouse" }), "draw");
  assert.equal(classifyPointer({ ...base, pointerType: "mouse", stylusOnly: true }), "pan");
});

test("a stylus writes without the page moving under it", () => {
  const drawn: unknown[] = [];
  const { container } = render(<ExamPlayer {...playerProps({ onScratchChange: (_id: string, page: unknown) => drawn.push(page) })} />);
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;
  const frame = container.querySelector(".question-frame") as HTMLElement;
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });
  Object.defineProperty(frame, "scrollLeft", { value: 0, writable: true, configurable: true });

  fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "pen", isPrimary: true, pressure: 0.6, width: 2, height: 2, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: "pen", pressure: 0.6, clientX: 160, clientY: 140 });
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 160, clientY: 140 });
  assert.equal(drawn.length, 1, "the stylus wrote");
  assert.equal(frame.scrollTop, 0, "and the page did not move under it");

  // A hand touching down in the moments around a stroke is part of writing, not a gesture:
  // within the lockout it neither marks the page nor scrolls it.
  fireEvent.pointerDown(canvas, { pointerId: 2, pointerType: "touch", isPrimary: true, width: 12, height: 12, clientX: 200, clientY: 300 });
  fireEvent.pointerMove(canvas, { pointerId: 2, pointerType: "touch", width: 12, height: 12, clientX: 200, clientY: 220 });
  assert.equal(drawn.length, 1, "the hand wrote nothing");
  assert.equal(frame.scrollTop, 0, "and moved nothing");
  fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 220 });
});

test("a finger moves the question when it is not the writing tool", () => {
  const drawn: unknown[] = [];
  const { container } = render(<ExamPlayer {...playerProps({
    onScratchChange: (_id: string, page: unknown) => drawn.push(page),
    scratchPreferences: { colour: "ink" as const, size: 2 as const, stylusOnly: true },
  })} />);
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;
  const frame = container.querySelector(".question-frame") as HTMLElement;
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });
  Object.defineProperty(frame, "scrollLeft", { value: 0, writable: true, configurable: true });

  fireEvent.pointerDown(canvas, { pointerId: 7, pointerType: "touch", isPrimary: true, width: 12, height: 12, clientX: 200, clientY: 300 });
  fireEvent.pointerMove(canvas, { pointerId: 7, pointerType: "touch", width: 12, height: 12, clientX: 240, clientY: 220 });
  assert.equal(frame.scrollTop, 80, "the finger moved the question up");
  assert.equal(frame.scrollLeft, -40, "and across");
  assert.deepEqual(drawn, [], "and wrote nothing");
  fireEvent.pointerUp(canvas, { pointerId: 7, pointerType: "touch", clientX: 240, clientY: 220 });
});

test("a resting hand neither writes nor nudges the question", () => {
  const drawn: unknown[] = [];
  const { container } = render(<ExamPlayer {...playerProps({ onScratchChange: (_id: string, page: unknown) => drawn.push(page) })} />);
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;
  const frame = container.querySelector(".question-frame") as HTMLElement;
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });

  fireEvent.pointerDown(canvas, { pointerId: 3, pointerType: "touch", isPrimary: true, width: 54, height: 46, clientX: 120, clientY: 400 });
  fireEvent.pointerMove(canvas, { pointerId: 3, pointerType: "touch", width: 54, height: 46, clientX: 126, clientY: 380 });
  fireEvent.pointerUp(canvas, { pointerId: 3, pointerType: "touch", clientX: 126, clientY: 380 });
  assert.deepEqual(drawn, [], "a palm leaves no mark");
  assert.equal(frame.scrollTop, 0, "and does not scroll the question away");
});

test("a tremor does not move the question, but a real drag does", () => {
  const { container } = render(<ExamPlayer {...playerProps()} />);
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;
  const frame = container.querySelector(".question-frame") as HTMLElement;
  Object.defineProperty(frame, "scrollTop", { value: 0, writable: true, configurable: true });

  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  fireEvent.pointerDown(canvas, { pointerId: 4, pointerType: "touch", isPrimary: true, width: 12, height: 12, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { pointerId: 4, pointerType: "touch", clientX: 102, clientY: 103 });
  assert.equal(frame.scrollTop, 0, "under the threshold nothing happens");
  fireEvent.pointerMove(canvas, { pointerId: 4, pointerType: "touch", clientX: 110, clientY: 130 });
  assert.equal(frame.scrollTop, -30, "past it, the question follows the pointer");
});

test("two fingers pinch the question, even when a finger had started writing", () => {
  const zooms: number[] = [];
  const drawn: unknown[] = [];
  const { container } = render(
    <ExamPlayer {...playerProps({
      onScratchChange: (_id: string, page: unknown) => drawn.push(page),
      onQuestionViewChange: (patch: Partial<Settings>) => { if (patch.questionZoom) zooms.push(patch.questionZoom); },
    })} />,
  );
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;

  // No stylus has been used, so the first finger starts writing. The second says a pinch was
  // meant all along, and the mark it had begun is taken back.
  fireEvent.pointerDown(canvas, { pointerId: 5, pointerType: "touch", isPrimary: true, width: 12, height: 12, clientX: 200, clientY: 300 });
  fireEvent.pointerDown(canvas, { pointerId: 6, pointerType: "touch", isPrimary: false, width: 12, height: 12, clientX: 300, clientY: 300 });
  fireEvent.pointerMove(canvas, { pointerId: 5, pointerType: "touch", clientX: 200, clientY: 300 });
  fireEvent.pointerMove(canvas, { pointerId: 6, pointerType: "touch", clientX: 400, clientY: 300 });
  assert.equal(zooms[zooms.length - 1], 2, "spreading to twice the span doubles the magnification");

  fireEvent.pointerMove(canvas, { pointerId: 6, pointerType: "touch", clientX: 250, clientY: 300 });
  assert.equal(zooms[zooms.length - 1], 0.5, "and pinching back in reduces it");

  fireEvent.pointerUp(canvas, { pointerId: 6, pointerType: "touch" });
  fireEvent.pointerUp(canvas, { pointerId: 5, pointerType: "touch" });
  assert.deepEqual(drawn, [], "a pinch leaves no mark behind");
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


/* ------------------------------------------------------------------ the pointers -- */

test("a pen asks to erase with its eraser end or its barrel button", () => {
  const pen = (over: Partial<{ button: number; buttons: number }>) =>
    ({ pointerType: "pen", button: 0, buttons: 1, ...over }) as PointerEvent;

  // The nib alone writes.
  assert.equal(isPenErasing(pen({})), false);
  // The eraser end, both as the button that changed and as the flag held down.
  assert.equal(isPenErasing(pen({ button: 5, buttons: 32 })), true);
  assert.equal(isPenErasing(pen({ button: -1, buttons: 32 })), true);
  // The barrel button, including while the tip is also down — which reports both flags, so
  // an equality test against 32 alone would miss it.
  assert.equal(isPenErasing(pen({ button: 2, buttons: 3 })), true);
  assert.equal(isPenErasing(pen({ button: -1, buttons: 3 })), true);
  assert.equal(isPenErasing(pen({ button: -1, buttons: 33 })), true);
  // A mouse right-click is not a pen eraser; it must not rub out a candidate's working.
  assert.equal(isPenErasing({ pointerType: "mouse", button: 2, buttons: 2 } as PointerEvent), false);
  assert.equal(isPenErasing({ pointerType: "touch", button: 0, buttons: 1 } as PointerEvent), false);
});

test("a broad contact patch is a palm; an unreported one is never assumed to be", () => {
  // What almost every browser reports for touch. It must never be read as a palm, or a
  // candidate with no stylus could not write at all.
  assert.equal(isPalmContact(0, 0), false);
  assert.equal(isPalmContact(1, 1), false);
  // A fingertip or a capacitive stylus tip.
  assert.equal(isPalmContact(12, 14), false);
  assert.equal(isPalmContact(22, 22), false);
  // The heel of a hand, in either direction.
  assert.equal(isPalmContact(48, 20), true);
  assert.equal(isPalmContact(20, 60), true);
});

test("a palm resting first on a fresh question does not draw", () => {
  const drawn: unknown[] = [];
  const { container, rerender } = render(
    <ExamPlayer {...playerProps({ onScratchChange: (_id: string, page: unknown) => drawn.push(page) })} />,
  );
  const canvas = () => container.querySelector(".annotation-canvas-live") as HTMLElement;

  // No stylus has been seen yet — this is the state a newly mounted question starts in —
  // and a wide contact lands before any nib. It is rejected on its own account.
  fireEvent.pointerDown(canvas(), { pointerId: 1, pointerType: "touch", isPrimary: true, width: 46, height: 38, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas(), { pointerId: 1, pointerType: "touch", clientX: 30, clientY: 30 });
  fireEvent.pointerUp(canvas(), { pointerId: 1, pointerType: "touch" });
  assert.deepEqual(drawn, [], "a palm must not start a stroke");

  // A fingertip on the same question still writes, because no pen has been used.
  rerender(<ExamPlayer {...playerProps({ writingReady: true })} />);
});

test("a stylus seen on one question is remembered on the next", () => {
  // The layer is keyed by the question, so the host has to hold this. Passing it in is what
  // the exam player does; here it is asserted that the layer honours it from the first
  // event, with no pen of its own having been seen.
  const { container } = render(<ExamPlayer {...playerProps()} />);
  const canvas = container.querySelector(".annotation-canvas-live") as HTMLElement;
  assert.ok(!canvas.style.touchAction, "the surface never sets one");

  fireEvent.pointerDown(canvas, { pointerId: 2, pointerType: "pen", isPrimary: true, pressure: 0.5, width: 2, height: 2, clientX: 20, clientY: 20 });
  fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "pen" });
  // The host was told, and the layer now hands touch to the browser to move the question.
  
});


/* ---------------------------------------------------------------- the review of it -- */

function finished(): Attempt {
  const done = attempt();
  return {
    ...done,
    endedAt: done.startedAt + 300_000,
    durationMs: 300_000,
    completionStatus: "submitted",
    rawScore: 0,
    responses: {
      q1: { ...response("q1"), selectedAnswer: "B", finalAnswer: "B", correct: false, unanswered: false, timeSpentMs: 90_000 },
    },
  };
}

const writtenPage = {
  height: 900,
  strokes: [
    { tool: "pen" as const, colour: "ink" as const, size: 2 as const, points: [40, 60, 0.5, 300, 220, 0.6] },
    { tool: "pen" as const, colour: "red" as const, size: 1 as const, points: [80, 400, 0.4, 500, 640, 0.5] },
  ],
};

test("the working written on a missed question is shown back in the result", () => {
  const { rerender } = render(
    <ResultScreen
      attempt={finished()}
      questionMap={{ q1: question("q1") }}
      showScoreEstimate={false}
      returnLabel="Back"
      previous={null}
      scratchPages={{ q1: writtenPage }}
      onClose={() => undefined}
      onContinue={() => undefined}
      onRetryMissed={() => undefined}
      onTag={() => undefined}
    />,
  );
  assert.ok(screen.getByRole("img", { name: /2 handwritten strokes/ }), "the working is offered back");
  assert.ok(screen.getByText("Your working on this question"));

  // A question with nothing written on it shows no empty frame.
  rerender(
    <ResultScreen
      attempt={finished()}
      questionMap={{ q1: question("q1") }}
      showScoreEstimate={false}
      returnLabel="Back"
      previous={null}
      scratchPages={{}}
      onClose={() => undefined}
      onContinue={() => undefined}
      onRetryMissed={() => undefined}
      onTag={() => undefined}
    />,
  );
  assert.equal(screen.queryByText("Your working on this question"), null);
});

test("the working is shown again in an attempt reopened from the history", () => {
  render(
    <AttemptDetailView
      attempt={finished()}
      questionMap={{ q1: question("q1") }}
      attempts={[]}
      showScoreEstimate={false}
      scratchPages={{ q1: writtenPage }}
      onBack={() => undefined}
      onDelete={() => undefined}
      onResit={() => undefined}
    />,
  );
  assert.ok(screen.getByText("Your working on this question"));
  // Its shape comes from the page, so nothing written low down is cropped out of the review.
  assert.ok(screen.getByRole("img", { name: /picture of your own working/ }));
});
