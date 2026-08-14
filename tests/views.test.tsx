/**
 * Every screen, rendered.
 *
 * A view that throws only for a real user — an empty history, a paper whose questions
 * left the bank, a plan with no eligible session — is exactly the failure that typecheck,
 * lint and the build all pass. This file renders each one against both an untouched
 * account and a populated one, and fails on any thrown error or React warning.
 */

import "./dom-setup";

import assert from "node:assert/strict";
import test, { afterEach, before, after } from "node:test";
import { cleanup, render } from "@testing-library/react";
import {
  AdaptiveStudyPlanView,
  AnalyticsView,
  AttemptDetailView,
  Dashboard,
  MistakesView,
  OriginalMocksView,
  PaperHistoryView,
  PracticeView,
  QuickTricksView,
  ResultScreen,
  SettingsView,
} from "../app/esat-app";
import { buildAdaptiveStudyPlan } from "../app/lib/study-plan";
import {
  applyCompletedAttempt,
  createAttempt,
  defaultState,
  finalizeAttempt,
  listPaperSets,
  MODULE_ORDER,
  type BankPayload,
  type MockPayload,
  type ModuleId,
  type Question,
  type StoredState,
} from "../app/lib/core";

afterEach(cleanup);

/**
 * React reports invalid markup and bad props through console.error rather than by
 * throwing, so a view can "render" while being broken. Treat any of it as a failure.
 */
const consoleErrors: string[] = [];
const realError = console.error;
const realWarn = console.warn;
before(() => {
  console.error = (...args: unknown[]) => { consoleErrors.push(args.map(String).join(" ")); };
  console.warn = (...args: unknown[]) => { consoleErrors.push(args.map(String).join(" ")); };
});
after(() => { console.error = realError; console.warn = realWarn; });

function assertClean(label: string) {
  if (consoleErrors.length) {
    const seen = consoleErrors.join("\n");
    consoleErrors.length = 0;
    assert.fail(`${label} produced React errors:\n${seen}`);
  }
}

/* ------------------------------------------------------------------- fixtures -- */

const NOW = new Date(2026, 7, 14, 15, 0, 0).getTime();

function question(id: string, module: ModuleId, index: number, overrides: Partial<Question> = {}): Question {
  return {
    id,
    questionBankVersion: "test",
    year: 2019,
    sourceExam: "NSAA",
    sourcePaper: "paper.pdf",
    sourceSection: "Section 1",
    sourcePart: "A",
    originalQuestionNumber: index,
    sourcePage: index,
    sourcePages: [index],
    targetModule: module,
    esatTopic: ["Algebra", "Geometry", "Mechanics", "Number"][index % 4],
    esatSubtopic: "Functions",
    specificationVersion: "test",
    questionText: "Solve $\\frac{x^2 - 5x + 6}{x - 2} = 0$ for $x \\ne 2$.",
    optionText: { A: "$x=3$", B: "$x=2$", C: "$x=-3$", D: "No solution" },
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

const archive: Question[] = MODULE_ORDER.flatMap((module) =>
  Array.from({ length: 20 }, (_, i) => question(`${module}-q${i}`, module, i + 1)),
);

const originals: Question[] = MODULE_ORDER.flatMap((module) =>
  Array.from({ length: 27 }, (_, i) => question(`orig-${module}-q${i}`, module, i + 1, {
    authored: true, sourceExam: "ESAT Atlas Original", sourcePaper: "Challenge Mock A", year: 2026,
    questionImage: undefined, explanation: "Factorise and cancel the common term.",
  })),
);

const bank: BankPayload = {
  version: "esat-archive-test-v1",
  specificationVersion: "test",
  generatedAt: "2026-01-01",
  questions: archive,
  summary: { processedPotentiallyRelevant: archive.length, includedByModule: {}, excludedByReason: {}, contactSheets: [] },
};

const mockBank: MockPayload = {
  version: "originals-test-v1",
  generatedAt: "2026-01-01",
  label: "Challenge Mock A",
  disclaimer: "Original material.",
  questions: originals,
  summary: {
    questionCount: originals.length, distinctArchetypes: 81, distinctPromptTemplates: 81,
    numberSwapDuplicates: 0, allTopLevelSpecificationTopicsCovered: true,
    perModule: Object.fromEntries(MODULE_ORDER.map((m) => [m, { questionCount: 27, distinctArchetypes: 27, distinctPromptTemplates: 27, topicCounts: {} }])) as MockPayload["summary"]["perModule"],
    verification: "checked",
  },
};

const questionMap: Record<string, Question> = Object.fromEntries([...archive, ...originals].map((q) => [q.id, q]));

/** An account with real history: a completed paper, some mistakes, notes and targets. */
function populatedState(): StoredState {
  let state: StoredState = {
    ...defaultState(),
    settings: { ...defaultState().settings, examDate: "2026-10-15" },
    notes: { "maths1-q0": "Watch the sign convention." },
  };
  const paper = archive.filter((q) => q.targetModule === "maths1");
  const attempt = createAttempt({
    questions: paper, module: "maths1", mode: "historic", durationMinutes: 30,
    strictTimed: true, generated: false, originalHistoricSet: true, progress: state.progress,
  });
  // Two thirds correct, one flagged, one tagged, one left blank.
  paper.forEach((q, index) => {
    if (index % 3 !== 0) attempt.responses[q.id].selectedAnswer = "A";
    else if (index % 6 === 0) attempt.responses[q.id].selectedAnswer = "B";
    attempt.responses[q.id].timeSpentMs = 40_000 + index * 3_000;
    if (index === 1) attempt.responses[q.id].flagged = true;
    if (index % 3 === 0) attempt.responses[q.id].errorClassifications = ["Algebra", "Time pressure"];
  });
  const finished = finalizeAttempt(attempt, questionMap, false, attempt.startedAt + 1_500_000);
  state = applyCompletedAttempt(state, finished);
  return state;
}

const populated = populatedState();
const completedAttempt = populated.attempts[0];
const empty = defaultState();
const paperSets = listPaperSets(archive);
const noop = () => undefined;

function planFor(state: StoredState) {
  return buildAdaptiveStudyPlan({ archiveQuestions: archive, supplementalQuestions: originals, state, now: NOW });
}

function dashboardProps(state: StoredState) {
  const approvedCounts = Object.fromEntries(
    MODULE_ORDER.map((m) => [m, archive.filter((q) => q.targetModule === m).length]),
  ) as Record<ModuleId, number>;
  return {
    state, bank, approvedCounts, daysRemaining: 62, dueCount: Object.keys(state.mistakes).length,
    studyMs: 3_600_000, questionMap, plan: planFor(state),
    onPractice: noop, onViewPlan: noop, onStartPlanSession: noop, onOpenAttempt: noop,
  };
}

function practiceProps(state: StoredState) {
  return {
    state, now: NOW,
    approvedCounts: Object.fromEntries(MODULE_ORDER.map((m) => [m, 20])) as Record<ModuleId, number>,
    paperSets, module: "maths1" as ModuleId, setModule: noop, count: 10, setCount: noop,
    filter: "unseen" as const, setFilter: noop, timing: "pace" as const, setTiming: noop,
    topic: "", setTopic: noop, topics: [{ topic: "Algebra", count: 5 }],
    paperModule: "maths1" as ModuleId, setPaperModule: noop, paperExam: "NSAA", setPaperExam: noop,
    paperYear: null, setPaperYear: noop, onStartPaper: noop, onStart: noop, onExam: noop, onFullMock: noop,
  };
}

function mistakesProps(state: StoredState) {
  return {
    state, now: NOW, questionMap, onRetry: noop, onRedo: noop, onNote: noop,
    scope: "all" as const, setScope: noop, module: "maths1" as ModuleId, setModule: noop,
    timed: false, setTimed: noop,
  };
}

function settingsProps(state: StoredState) {
  return {
    state, busy: false, onSettingsChange: noop, onTargetChange: noop,
    onExportJson: noop, onExportCsv: noop, onReset: noop, onEraseCloudData: noop, onDeleteAccount: noop,
  };
}

/* ---------------------------------------------------------------- every screen -- */

for (const [label, state] of [["a new account", empty], ["an account with history", populated]] as const) {
  test(`every primary view renders for ${label}`, () => {
    const screens: Array<[string, () => React.ReactElement]> = [
      ["Dashboard", () => <Dashboard {...dashboardProps(state)} />],
      ["Study plan", () => <AdaptiveStudyPlanView plan={planFor(state)} settings={state.settings} onStart={noop} onPractice={noop} onSettings={noop} onPlanMinutesChange={noop} />],
      ["Practice", () => <PracticeView {...practiceProps(state)} />],
      ["Quick tricks", () => <QuickTricksView attempts={state.attempts} questionMap={questionMap} onPractiseTopic={noop} />],
      ["Original mocks", () => <OriginalMocksView payload={mockBank} attempts={state.attempts} showScoreEstimate onStart={noop} onFull={noop} onOpenAttempt={noop} />],
      ["Analytics", () => <AnalyticsView attempts={state.attempts} questionMap={questionMap} showScoreEstimate now={NOW} />],
      ["Mistakes", () => <MistakesView {...mistakesProps(state)} />],
      ["Paper history", () => <PaperHistoryView state={state} paperSets={paperSets} filter="all" setFilter={noop} showScoreEstimate onStart={noop} onOpenAttempt={noop} />],
      ["Settings", () => <SettingsView {...settingsProps(state)} />],
    ];

    for (const [name, element] of screens) {
      const { container, unmount } = render(element());
      assert.ok(container.textContent && container.textContent.length > 0, `${name} rendered nothing for ${label}`);
      assertClean(`${name} (${label})`);
      unmount();
    }
  });
}

test("the result and breakdown screens render a completed attempt", () => {
  for (const [name, element] of [
    ["ResultScreen", () => <ResultScreen attempt={completedAttempt} questionMap={questionMap} showScoreEstimate returnLabel="Back" previous={null} onClose={noop} onContinue={noop} onRetryMissed={noop} onTag={noop} />],
    ["AttemptDetailView", () => <AttemptDetailView attempt={completedAttempt} questionMap={questionMap} attempts={populated.attempts} showScoreEstimate onBack={noop} onDelete={noop} onResit={noop} />],
  ] as const) {
    const { container, unmount } = render(element());
    assert.ok(container.textContent?.includes("/"), `${name} should show a raw mark`);
    assertClean(name);
    unmount();
  }
});

test("review screens survive a question that has left the bank", () => {
  // The bank is rebuilt between sittings; a stored attempt can outlive its questions.
  for (const [name, element] of [
    ["ResultScreen", () => <ResultScreen attempt={completedAttempt} questionMap={{}} showScoreEstimate returnLabel="Back" previous={null} onClose={noop} onContinue={noop} onRetryMissed={noop} onTag={noop} />],
    ["AttemptDetailView", () => <AttemptDetailView attempt={completedAttempt} questionMap={{}} attempts={populated.attempts} showScoreEstimate onBack={noop} onDelete={noop} onResit={noop} />],
    ["Mistakes", () => <MistakesView {...mistakesProps(populated)} questionMap={{}} />],
    ["Analytics", () => <AnalyticsView attempts={populated.attempts} questionMap={{}} showScoreEstimate now={NOW} />],
  ] as const) {
    const { unmount } = render(element());
    assertClean(`${name} with an empty bank`);
    unmount();
  }
});

test("views render with the score estimate turned off", () => {
  for (const [name, element] of [
    ["ResultScreen", () => <ResultScreen attempt={completedAttempt} questionMap={questionMap} showScoreEstimate={false} returnLabel="Back" previous={null} onClose={noop} onContinue={noop} onRetryMissed={noop} onTag={noop} />],
    ["AttemptDetailView", () => <AttemptDetailView attempt={completedAttempt} questionMap={questionMap} attempts={populated.attempts} showScoreEstimate={false} onBack={noop} onDelete={noop} onResit={noop} />],
    ["Paper history", () => <PaperHistoryView state={populated} paperSets={paperSets} filter="all" setFilter={noop} showScoreEstimate={false} onStart={noop} onOpenAttempt={noop} />],
  ] as const) {
    const { unmount } = render(element());
    assertClean(`${name} without estimates`);
    unmount();
  }
});

test("a timed-out attempt with no answers at all still reviews cleanly", () => {
  const items = archive.filter((q) => q.targetModule === "physics");
  const blank = createAttempt({
    questions: items, module: "physics", mode: "exam", durationMinutes: 40,
    strictTimed: true, generated: true, progress: {},
  });
  const finished = finalizeAttempt(blank, questionMap, true, blank.startedAt + 2_400_000);
  assert.equal(finished.rawScore, 0);

  const { container, unmount } = render(
    <ResultScreen attempt={finished} questionMap={questionMap} showScoreEstimate returnLabel="Back" previous={null} onClose={noop} onContinue={noop} onRetryMissed={noop} onTag={noop} />,
  );
  assert.ok(container.textContent?.includes("Time expired"));
  assertClean("timed-out ResultScreen");
  unmount();
});
