/**
 * The whiteboard as a candidate meets it: the toggle, where the board sits, how much room
 * it takes, and what happens to the question beside it.
 *
 * jsdom has no canvas, so no ink is drawn here — the drawing model itself is covered by
 * `tests/scratch.test.ts`. What is covered is everything around it, including the two
 * promises that matter most: the board can always be switched off, and the answer options
 * are reachable however large it is made.
 */

import "./dom-setup";

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExamPlayer, QuestionCrop } from "../app/esat-app";
import { Scratchpad } from "../app/scratchpad";
import type { ScratchPage } from "../app/lib/scratch";
import { defaultState, type Attempt, type Question, type ResponseRecord, type Settings } from "../app/lib/core";

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
    boardLayout: "split" as const,
    boardWidth: settings.scratchpadWidth,
    boardReady: true,
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

/* ------------------------------------------------------------------- the toggle -- */

test("the whiteboard is absent, and unmentioned, when it is switched off", () => {
  render(<ExamPlayer {...playerProps({ boardLayout: "off" })} />);
  assert.equal(screen.queryByLabelText("Working whiteboard"), null);
  assert.equal(screen.queryByRole("group", { name: "Writing tool" }), null);
  // With no handler the toggle itself is not offered either, so a host that does not
  // support the board shows no dead control.
  assert.equal(screen.queryByRole("button", { name: /Whiteboard/ }), null);
});

test("the toggle turns the board off, and the keyboard hint says how to bring it back", () => {
  const layouts: string[] = [];
  render(<ExamPlayer {...playerProps({ onBoardLayoutChange: (layout: string) => layouts.push(layout) })} />);

  const toggle = screen.getByRole("button", { name: /Whiteboard on/ });
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  fireEvent.click(toggle);
  assert.deepEqual(layouts, ["off"]);
  assert.match(toggle.getAttribute("title") ?? "", /\(W\)/);
});

test("the board offers its own way out, and both positions", () => {
  const layouts: string[] = [];
  render(<ExamPlayer {...playerProps({ onBoardLayoutChange: (layout: string) => layouts.push(layout) })} />);

  fireEvent.click(screen.getByRole("button", { name: "Hide the whiteboard" }));
  fireEvent.click(screen.getByRole("button", { name: "On question" }));
  fireEvent.click(screen.getByRole("button", { name: "Beside" }));
  assert.deepEqual(layouts, ["off", "overlay", "split"]);
});

/* -------------------------------------------------------------------- the width -- */

test("the width control never takes the answer options off the screen", () => {
  const widths: string[] = [];
  const { container } = render(<ExamPlayer {...playerProps({ onBoardWidthChange: (width: string) => widths.push(width) })} />);

  const group = screen.getByRole("group", { name: "Whiteboard width" });
  const buttons = [...group.querySelectorAll("button")];
  assert.deepEqual(buttons.map((button) => button.textContent), ["½", "⅔", "Full"]);

  for (const button of buttons) {
    fireEvent.click(button);
    // Whatever width is chosen, the radio group of options is still rendered: the layout
    // takes its room from the question, never from the answers.
    assert.ok(screen.getByRole("radiogroup", { name: "Answer options" }));
    assert.equal(screen.getAllByRole("radio").length, 5);
  }
  assert.deepEqual(widths, ["half", "wide", "full"]);
  assert.equal(container.querySelector(".exam-content")?.getAttribute("data-board"), "half");
});

test("the chosen width is published to the layout, and only in the beside position", () => {
  const { container, rerender } = render(<ExamPlayer {...playerProps({ boardWidth: "full" })} />);
  const content = () => container.querySelector(".exam-content");
  assert.equal(content()?.getAttribute("data-board"), "full");
  assert.ok(content()?.className.includes("workspace-split"));

  rerender(<ExamPlayer {...playerProps({ boardLayout: "overlay", boardWidth: "full" })} />);
  assert.ok(content()?.className.includes("workspace-overlay"));
  // Overlay covers the question outright, so a width share would mean nothing there.
  assert.equal(content()?.getAttribute("data-board"), null);
});

/* ------------------------------------------------------------------ the question -- */

test("the question can be enlarged and shrunk while the board shares the width", () => {
  const patches: Array<Partial<Settings>> = [];
  const onQuestionViewChange = (patch: Partial<Settings>) => patches.push(patch);
  const { rerender } = render(<ExamPlayer {...playerProps({ onQuestionViewChange })} />);

  // The default is already magnified: a printed paper at half width is otherwise unreadable.
  assert.ok(screen.getByText("140%"));
  fireEvent.click(screen.getByRole("button", { name: "Show the question larger" }));
  assert.deepEqual(patches, [{ questionZoom: 1.7 }]);

  rerender(<ExamPlayer {...playerProps({ onQuestionViewChange, questionZoom: 3 })} />);
  assert.ok(screen.getByText("300%"));
  assert.equal((screen.getByRole("button", { name: "Show the question larger" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "Show the question smaller" }) as HTMLButtonElement).disabled, false);

  rerender(<ExamPlayer {...playerProps({ onQuestionViewChange, questionZoom: 1 })} />);
  assert.equal((screen.getByRole("button", { name: "Show the question smaller" }) as HTMLButtonElement).disabled, true);
});

test("the printed option list can be hidden, and the answer panel still lists the options", () => {
  const patches: Array<Partial<Settings>> = [];
  const { rerender } = render(<ExamPlayer {...playerProps({ onQuestionViewChange: (patch: Partial<Settings>) => patches.push(patch) })} />);

  const hide = screen.getByRole("button", { name: /Options/ });
  assert.equal(hide.getAttribute("aria-pressed"), "false");
  fireEvent.click(hide);
  assert.deepEqual(patches, [{ questionHideOptions: true }]);

  rerender(<ExamPlayer {...playerProps({ questionHideOptions: true, onQuestionViewChange: () => undefined })} />);
  assert.equal(screen.getByRole("button", { name: /Options/ }).getAttribute("aria-pressed"), "true");
  assert.equal(screen.getAllByRole("radio").length, 5, "the options must remain answerable");
});

test("the question view controls stay out of the way when the board is closed", () => {
  render(<ExamPlayer {...playerProps({ boardLayout: "off", onQuestionViewChange: () => undefined })} />);
  assert.equal(screen.queryByRole("group", { name: "Question size" }), null);
  assert.equal(screen.queryByRole("button", { name: /Options/ }), null);
});

test("a trimmed crop is only cut once its height is known, and says so", () => {
  const { container, rerender } = render(
    <QuestionCrop source="questions/2019/q04.webp" alt="NSAA 2019 question 4" zoom={1.4} trim={0.3} />,
  );
  const crop = container.querySelector(".question-crop") as HTMLElement;
  const image = container.querySelector("img") as HTMLImageElement;
  assert.equal(image.style.width, "140%");
  // jsdom reports a zero-height image, and cutting 30% off nothing would collapse the
  // frame — so nothing is cut until a real measurement arrives.
  assert.equal(crop.style.height, "");
  assert.equal(container.querySelector(".question-crop-note"), null);

  rerender(<QuestionCrop source="questions/2019/q04.webp" alt="NSAA 2019 question 4" zoom={1} trim={0} />);
  assert.equal((container.querySelector("img") as HTMLImageElement).style.width, "100%");
});

/* ------------------------------------------------------------------ the surface -- */

test("the board offers its tools, and the history controls start unavailable on a blank page", () => {
  render(
    <Scratchpad
      layout="split"
      initialPage={null}
      onChange={() => undefined}
      preferences={{ colour: "ink", size: 2, stylusOnly: false }}
      onPreferencesChange={() => undefined}
    />,
  );

  for (const name of ["Pen", "Highlighter", "Eraser"]) {
    assert.ok(screen.getByRole("button", { name }), name);
  }
  assert.equal(screen.getByRole("button", { name: "Pen" }).getAttribute("aria-pressed"), "true");
  for (const name of ["Undo", "Redo", "Clear board"]) {
    assert.equal((screen.getByRole("button", { name }) as HTMLButtonElement).disabled, true, name);
  }
  // The surface itself is described, because a canvas has nothing else to read.
  assert.ok(screen.getByRole("img", { name: /Empty whiteboard/ }));
});

test("switching tool and ink reports the change and never loses the eraser", () => {
  const patches: Array<Record<string, unknown>> = [];
  render(
    <Scratchpad
      layout="split"
      initialPage={null}
      onChange={() => undefined}
      preferences={{ colour: "ink", size: 2, stylusOnly: false }}
      onPreferencesChange={(patch) => patches.push(patch)}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
  assert.equal(screen.getByRole("button", { name: "Eraser" }).getAttribute("aria-pressed"), "true");

  // Choosing an ink while erasing means the candidate wants to write again.
  fireEvent.click(screen.getByRole("button", { name: "Blue ink" }));
  assert.deepEqual(patches, [{ colour: "blue" }]);
  assert.equal(screen.getByRole("button", { name: "Pen" }).getAttribute("aria-pressed"), "true");

  fireEvent.click(screen.getByRole("button", { name: "Broad nib" }));
  assert.deepEqual(patches[1], { size: 3 });
});

test("a restored page reports the working it holds, so the review knows there is some", () => {
  const page: ScratchPage = {
    height: 700,
    strokes: [
      { tool: "pen", colour: "ink", size: 2, points: [10, 10, 0.5, 40, 60, 0.6] },
      { tool: "pen", colour: "red", size: 1, points: [80, 20, 0.4, 120, 90, 0.5] },
    ],
  };
  render(
    <Scratchpad
      layout="split"
      initialPage={page}
      onChange={() => undefined}
      preferences={{ colour: "ink", size: 2, stylusOnly: false }}
      onPreferencesChange={() => undefined}
    />,
  );
  assert.ok(screen.getByRole("img", { name: /2 strokes of your working/ }));
  assert.equal((screen.getByRole("button", { name: "Clear board" }) as HTMLButtonElement).disabled, false);
});

test("the player waits for stored working rather than showing a blank page over it", () => {
  render(<ExamPlayer {...playerProps({ boardReady: false })} />);
  assert.ok(screen.getByText(/Restoring the working you wrote/));
  assert.equal(screen.queryByRole("group", { name: "Writing tool" }), null);
});
