import { SCRATCH_COLOURS, type ScratchColour, type ScratchSize } from "./scratch";

const SCRATCH_COLOUR_KEYS = Object.keys(SCRATCH_COLOURS) as ScratchColour[];

export type ModuleId = "maths1" | "physics" | "maths2";
export type AttemptMode = "exam" | "practice" | "historic" | "retry" | "original";

export interface Question {
  id: string;
  questionBankVersion: string;
  year: number;
  sourceExam: string;
  sourcePaper: string;
  sourceSection: string;
  sourcePart: string;
  originalQuestionNumber: number;
  sourcePage: number;
  sourcePages: number[];
  targetModule: ModuleId;
  esatTopic: string;
  esatSubtopic: string;
  specificationVersion: string;
  questionImage?: string;
  questionText?: string;
  /** Supplemental authored figure. Unlike questionImage, this never replaces the stem. */
  questionDiagram?: string;
  /** Meaningful text alternative describing the diagram and all data required to answer. */
  questionDiagramAlt?: string;
  optionText?: Record<string, string>;
  explanation?: string;
  /** A rendered worked solution supplied by the source publisher. */
  workedSolutionImage?: string;
  /** Human-readable provenance for workedSolutionImage. */
  workedSolutionSource?: string;
  difficulty?: "standard" | "stretch";
  authored?: boolean;
  answerOptions: string[];
  correctAnswer: string;
  excluded: boolean;
  exclusionReason: string | null;
  reviewRequired: boolean;
  importConfidence: "high" | "medium" | "low";
  sourceHash: string;
  imageHash: string;
  searchText: string;
  alternateSources?: Array<{
    sourceExam: string;
    sourcePaper: string;
    sourcePart: string;
    originalQuestionNumber: number;
    sourcePage: number;
  }>;
}

export interface BankPayload {
  version: string;
  specificationVersion: string;
  generatedAt: string;
  questions: Question[];
  summary: {
    processedPotentiallyRelevant: number;
    includedByModule: Record<string, number>;
    excludedByReason: Record<string, number>;
    contactSheets: string[];
  };
}

export interface MockPayload {
  version: string;
  generatedAt: string;
  label: string;
  disclaimer: string;
  qualityPolicy?: string;
  questions: Question[];
  summary: {
    questionCount: number;
    distinctArchetypes: number;
    distinctPromptTemplates: number;
    numberSwapDuplicates: number;
    allTopLevelSpecificationTopicsCovered: boolean;
    /** Authored items that ship a supplementary figure. */
    questionsWithDiagrams?: number;
    perModule: Record<ModuleId, {
      questionCount: number;
      distinctArchetypes: number;
      distinctPromptTemplates: number;
      topicCounts: Record<string, number>;
    }>;
    verification: string;
  };
}

export interface AnswerChange {
  from: string | null;
  to: string;
  at: number;
}

export interface ResponseRecord {
  questionId: string;
  selectedAnswer: string | null;
  firstSelectedAnswer: string | null;
  finalAnswer: string | null;
  correct: boolean | null;
  unanswered: boolean;
  timeSpentMs: number;
  visits: number;
  flagged: boolean;
  confidence: "Guess" | "Low" | "Medium" | "High" | null;
  answerChanges: AnswerChange[];
  errorClassifications: string[];
  firstExposure: boolean;
  timestamps: number[];
}

export interface Attempt {
  attemptId: string;
  mode: AttemptMode;
  module: ModuleId;
  questionIds: string[];
  questionBankVersion: string;
  specificationVersion: string;
  scoreConversionVersion: string;
  benchmarkVersion: string;
  startedAt: number;
  endsAt: number | null;
  pausedAt: number | null;
  totalPausedDuration: number;
  endedAt: number | null;
  durationMs: number | null;
  strictTimed: boolean;
  generated: boolean;
  originalHistoricSet: boolean;
  sourceYears: number[];
  sourceExams: string[];
  sourceSetLabel: string;
  sequenceSource?: "archive" | "original";
  currentIndex: number;
  lastVisitStartedAt: number;
  responses: Record<string, ResponseRecord>;
  completionStatus: "active" | "submitted" | "timed-out";
  rawScore: number | null;
  freshQuestionCount: number;
  sequenceRemaining?: ModuleId[];
  /** Stable context for attempts launched from the derived adaptive study plan. */
  planSessionId?: string;
  planSessionKind?: "retrieval" | "maintenance" | "baseline" | "focus" | "coverage" | "simulation";
  planSessionTitle?: string;
  planSessionEstimatedMinutes?: number;
}

export interface QuestionProgress {
  neverSeen: boolean;
  firstSeenAt: number | null;
  firstAttemptCorrect: boolean | null;
  firstAttemptTime: number | null;
  firstAttemptMode: AttemptMode | null;
  totalAttempts: number;
  totalCorrect: number;
  totalIncorrect: number;
  mostRecentResult: boolean | null;
  mastered: boolean;
  exposureCount: number;
  lastAttemptedAt: number | null;
}

export interface MistakeItem {
  questionId: string;
  dueDate: number;
  intervalDays: number;
  correctStreak: number;
  lastResult: boolean;
}

export interface Settings {
  theme: "light" | "dark";
  keyboardShortcuts: boolean;
  examDate: string;
  /** Weekly study target in hours, compared against recorded session time. */
  weeklyHours: number;
  /** Maximum planned question time for one adaptive study session. */
  adaptivePlanMinutes: number;
  pacingAid: boolean;
  /** Show the estimated 1.0-9.0 conversion alongside every raw mark. */
  showScoreEstimate: boolean;
  /**
   * Whether the working whiteboard is offered during a session at all. Off hides the
   * toggle entirely; a candidate who works on paper never sees the feature.
   */
  scratchpadEnabled: boolean;
  /** Where the board opens: beside the question, or over it for annotating a figure. */
  scratchpadLayout: "split" | "overlay";
  /**
   * How much of the room beside the answer panel the board takes. "full" hands it the
   * whole width and folds the question away, for a question that needs a page of algebra.
   * The answer options stay on screen at every width.
   */
  scratchpadWidth: "half" | "wide" | "full";
  /** Ignore finger and mouse input on the board, so only a stylus writes. */
  scratchpadStylusOnly: boolean;
  scratchpadColour: ScratchColour;
  scratchpadSize: ScratchSize;
  /**
   * Magnification of the question while the whiteboard is open. Sharing the width with a
   * board leaves the printed crop small, and a scanned 2016 paper at half size is not
   * readable — so it is scaled up and the frame scrolls.
   */
  questionZoom: number;
  /**
   * Hide the printed option list at the foot of the question crop. The same options are in
   * the answer panel, in typeset form, so on a shared screen the crop is showing them twice
   * and spending the room on the part that matters least.
   */
  questionHideOptions: boolean;
  /** How much of the crop's height the option list occupies, as a fraction. */
  questionOptionTrim: number;
}

export type SyncSection = "settings" | "targets" | "notes";

/**
 * Last local edit time for independently mergeable user-owned sections. These values are
 * persisted both locally and in the user root document so an offline client can resolve a
 * later cloud merge without blindly preferring whichever copy happened to load last.
 */
export type SyncMetadata = Record<SyncSection, number>;

export interface StoredState {
  attempts: Attempt[];
  activeAttempt: Attempt | null;
  progress: Record<string, QuestionProgress>;
  mistakes: Record<string, MistakeItem>;
  targets: Record<ModuleId, number>;
  settings: Settings;
  notes: Record<string, string>;
  syncMetadata: SyncMetadata;
}

export const MODULE_LABELS: Record<ModuleId, string> = {
  maths1: "Mathematics 1",
  physics: "Physics",
  maths2: "Mathematics 2",
};

/** The order the three ESAT modules are sat in. */
export const MODULE_ORDER: ModuleId[] = ["maths1", "physics", "maths2"];

export const STORAGE_KEY = "esat-atlas-state-v4";
export const QUESTION_BANK_VERSION = "esat-archive-2016-2023-v3";
export const SPECIFICATION_VERSION = "ESAT-2026-v7.1.1";
export const BENCHMARK_VERSION = "uat-uk-2026_cambridge-foi-2025-1097-v1";
export const ESAT_MODULE_QUESTION_COUNT = 27;
export const ESAT_MODULE_DURATION_MS = 40 * 60_000;

/** A local-storage namespace that cannot collide between signed-in Firebase users. */
export function storageKeyForUser(uid: string): string {
  if (!uid) throw new Error("A non-empty Firebase UID is required for user-scoped storage.");
  return `${STORAGE_KEY}:user:${encodeURIComponent(uid)}`;
}

function validSyncTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

export function normalizeSyncMetadata(value: Partial<SyncMetadata> | null | undefined): SyncMetadata {
  return {
    settings: validSyncTimestamp(value?.settings),
    targets: validSyncTimestamp(value?.targets),
    notes: validSyncTimestamp(value?.notes),
  };
}

/** Mark one mergeable section as edited while remaining monotonic across clock rollback. */
export function touchSyncSection(
  state: StoredState,
  section: SyncSection,
  updatedAt = Date.now(),
): StoredState {
  const timestamp = validSyncTimestamp(updatedAt);
  const current = normalizeSyncMetadata(state.syncMetadata);
  return {
    ...state,
    syncMetadata: {
      ...current,
      [section]: Math.max(current[section], timestamp),
    },
  };
}

export function esatPacedDurationMs(questionCount: number): number {
  return Math.round(Math.max(0, questionCount) * ESAT_MODULE_DURATION_MS / ESAT_MODULE_QUESTION_COUNT);
}

export function defaultState(): StoredState {
  return {
    attempts: [],
    activeAttempt: null,
    progress: {},
    mistakes: {},
    targets: { maths1: 7, physics: 7, maths2: 7 },
    settings: {
      theme: "light",
      keyboardShortcuts: true,
      examDate: "",
      weeklyHours: 8,
      adaptivePlanMinutes: 45,
      pacingAid: false,
      showScoreEstimate: true,
      scratchpadEnabled: true,
      scratchpadLayout: "split",
      // An even share by default: the board needs room to write, and the question needs to
      // stay readable. The width control moves it either way in one tap.
      scratchpadWidth: "half",
      // Off by default: a candidate on a laptop has no stylus, and the board detects a pen
      // by itself the first time one is used.
      scratchpadStylusOnly: false,
      scratchpadColour: "ink",
      scratchpadSize: 2,
      questionZoom: 1.4,
      questionHideOptions: false,
      questionOptionTrim: 0.3,
    },
    notes: {},
    syncMetadata: normalizeSyncMetadata(null),
  };
}

/** A plain object, or an empty one. Guards against arrays, null and primitives alike. */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Numbers and numeric strings only. `Number()` alone would quietly turn null, "", [] and
 * false into 0, which then clamps to the minimum — so a missing target would come back as
 * 1.0 rather than the default the candidate actually has.
 */
function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * The minimum shape the interface can render. An attempt missing its identifier, its
 * question list or its response map cannot be scored, listed or reopened, so it is
 * dropped rather than allowed to throw somewhere deep in a view.
 */
function isAttemptShaped(value: unknown): boolean {
  const attempt = asRecord(value);
  return typeof attempt.attemptId === "string"
    && attempt.attemptId.length > 0
    && Array.isArray(attempt.questionIds)
    && attempt.questionIds.every((id) => typeof id === "string")
    && Boolean(attempt.responses)
    && typeof attempt.responses === "object"
    && !Array.isArray(attempt.responses);
}

/**
 * The single gate every persisted record passes through, from `localStorage` and from
 * Firestore alike. Both are outside this application's control — an older schema, a
 * partial write or a hand-edited document — so nothing beyond this point may assume a
 * field has the type its interface declares.
 */
export function mergeState(value: Partial<StoredState> | null | undefined): StoredState {
  const base = defaultState();
  if (!value || typeof value !== "object") return base;
  const normalizeAttempt = (attempt: Attempt): Attempt => ({
    ...attempt,
    sourceYears: Array.isArray(attempt.sourceYears) ? attempt.sourceYears : [],
    sourceExams: Array.isArray(attempt.sourceExams) ? attempt.sourceExams : [],
    sourceSetLabel: attempt.sourceSetLabel ?? (attempt.sourceYears?.length ? `Archive ${attempt.sourceYears.join(", ")}` : "Practice set"),
    sequenceSource: attempt.sequenceSource === "original" ? "original" : "archive",
    responses: asRecord(attempt.responses) as Attempt["responses"],
  });

  const storedSettings = asRecord(value.settings);
  const settings: Settings = {
    theme: storedSettings.theme === "dark" ? "dark" : "light",
    keyboardShortcuts: booleanOr(storedSettings.keyboardShortcuts, base.settings.keyboardShortcuts),
    examDate: typeof storedSettings.examDate === "string" ? storedSettings.examDate : base.settings.examDate,
    weeklyHours: Math.round(boundedNumber(storedSettings.weeklyHours, 1, 40, base.settings.weeklyHours)),
    // Snapped to the 15-minute options the planner and the settings select both offer.
    adaptivePlanMinutes: Math.round(
      boundedNumber(storedSettings.adaptivePlanMinutes, 15, 120, base.settings.adaptivePlanMinutes) / 15,
    ) * 15,
    pacingAid: booleanOr(storedSettings.pacingAid, base.settings.pacingAid),
    showScoreEstimate: booleanOr(storedSettings.showScoreEstimate, base.settings.showScoreEstimate),
    scratchpadEnabled: booleanOr(storedSettings.scratchpadEnabled, base.settings.scratchpadEnabled),
    scratchpadLayout: storedSettings.scratchpadLayout === "overlay" ? "overlay" : "split",
    scratchpadWidth: (["half", "wide", "full"] as string[]).includes(String(storedSettings.scratchpadWidth))
      ? storedSettings.scratchpadWidth as Settings["scratchpadWidth"]
      : base.settings.scratchpadWidth,
    scratchpadStylusOnly: booleanOr(storedSettings.scratchpadStylusOnly, base.settings.scratchpadStylusOnly),
    scratchpadColour: SCRATCH_COLOUR_KEYS.includes(storedSettings.scratchpadColour as ScratchColour)
      ? storedSettings.scratchpadColour as ScratchColour
      : base.settings.scratchpadColour,
    scratchpadSize: ([1, 2, 3] as number[]).includes(Number(storedSettings.scratchpadSize))
      ? Number(storedSettings.scratchpadSize) as ScratchSize
      : base.settings.scratchpadSize,
    // Snapped to the quarter steps the zoom control offers, so a hand-edited or older value
    // cannot leave the question at a magnification the buttons can never return from.
    questionZoom: Math.round(boundedNumber(storedSettings.questionZoom, 1, 3, base.settings.questionZoom) * 4) / 4,
    questionHideOptions: booleanOr(storedSettings.questionHideOptions, base.settings.questionHideOptions),
    questionOptionTrim: Math.round(
      boundedNumber(storedSettings.questionOptionTrim, 0.1, 0.6, base.settings.questionOptionTrim) * 20,
    ) / 20,
  };

  const storedTargets = asRecord(value.targets);
  const targets = Object.fromEntries(MODULE_ORDER.map((module) => [
    module,
    Math.round(boundedNumber(storedTargets[module], 1, 9, base.targets[module]) * 10) / 10,
  ])) as Record<ModuleId, number>;

  const notes = Object.fromEntries(
    Object.entries(asRecord(value.notes))
      .filter(([, note]) => typeof note === "string")
      .map(([questionId, note]) => [questionId, note as string]),
  );

  // Newest first, established here rather than trusted from storage. Several views take
  // "the latest" or "the most recent five" by position, and a record that arrived from a
  // partial sync or an older schema carries no ordering guarantee of its own.
  const attempts = (Array.isArray(value.attempts) ? value.attempts : [])
    .filter(isAttemptShaped)
    .map(normalizeAttempt)
    .sort((left, right) => (right.endedAt ?? right.startedAt) - (left.endedAt ?? left.startedAt));

  const progress = asRecord(value.progress) as StoredState["progress"];
  // Under the earlier schedule a question stayed queued after it was mastered, cycling
  // through longer intervals. One correct answer now clears it, so those records are
  // retired on load rather than lingering as work the candidate has already done.
  const mistakes = Object.fromEntries(
    Object.entries(asRecord(value.mistakes) as StoredState["mistakes"])
      .filter(([questionId]) => !progress[questionId]?.mastered),
  );

  return {
    ...base,
    ...value,
    attempts,
    activeAttempt: isAttemptShaped(value.activeAttempt) ? normalizeAttempt(value.activeAttempt as Attempt) : null,
    progress,
    mistakes,
    notes,
    targets,
    settings,
    syncMetadata: normalizeSyncMetadata(value.syncMetadata),
  };
}

export function eligibleQuestions(
  questions: Question[],
  module: ModuleId,
): Question[] {
  return questions
    .filter((question) => question.targetModule === module && !question.excluded && !question.reviewRequired);
}

export interface PaperSet {
  key: string;
  sourceExam: string;
  year: number;
  module: ModuleId;
  sourcePart: string;
  sectionLabel: string;
  label: string;
  questionCount: number;
  durationMs: number;
}

export function paperSetKey(sourceExam: string, year: number, module: ModuleId): string {
  return `${sourceExam}|${year}|${module}`;
}

export function paperSectionLabel(sourceExam: string, sourcePart: string): string {
  if (sourceExam === "ENGAA") return "Part B · crossed items removed";
  if (sourceExam === "TMUA") return "Paper 1";
  if (sourcePart === "E") return "Section 1 · Part E";
  if (sourcePart === "A") return "Section 1 · Part A";
  if (sourcePart === "B") return "Section 1 · Part B";
  return "Section 1";
}

/** Every (exam, year, module) paper the validated archive can serve, newest first. */
export function listPaperSets(questions: Question[]): PaperSet[] {
  const sets = new Map<string, PaperSet>();
  for (const question of questions) {
    if (question.excluded || question.reviewRequired) continue;
    const origins = [
      { sourceExam: question.sourceExam, sourcePart: question.sourcePart },
      ...(question.alternateSources ?? []).map((source) => ({ sourceExam: source.sourceExam, sourcePart: source.sourcePart })),
    ];
    for (const origin of origins) {
      const key = paperSetKey(origin.sourceExam, question.year, question.targetModule);
      const existing = sets.get(key);
      if (existing) {
        existing.questionCount += 1;
        existing.durationMs = esatPacedDurationMs(existing.questionCount);
        continue;
      }
      const sectionLabel = paperSectionLabel(origin.sourceExam, origin.sourcePart);
      sets.set(key, {
        key,
        sourceExam: origin.sourceExam,
        year: question.year,
        module: question.targetModule,
        sourcePart: origin.sourcePart,
        sectionLabel,
        label: `${origin.sourceExam} ${question.year} · ${sectionLabel}`,
        questionCount: 1,
        durationMs: esatPacedDurationMs(1),
      });
    }
  }
  return [...sets.values()].sort(
    (left, right) =>
      right.year - left.year
      || left.sourceExam.localeCompare(right.sourceExam)
      || MODULE_ORDER.indexOf(left.module) - MODULE_ORDER.indexOf(right.module),
  );
}

/** The exact paper, in the question order printed on the original paper. */
export function paperQuestions(
  questions: Question[],
  sourceExam: string,
  year: number,
  module: ModuleId,
): Question[] {
  const numberFor = (question: Question): number => {
    if (question.sourceExam === sourceExam) return question.originalQuestionNumber;
    const alternate = question.alternateSources?.find((source) => source.sourceExam === sourceExam);
    return alternate?.originalQuestionNumber ?? question.originalQuestionNumber;
  };
  return eligibleQuestions(questions, module)
    .filter((question) => question.year === year && (
      question.sourceExam === sourceExam
      || Boolean(question.alternateSources?.some((source) => source.sourceExam === sourceExam))
    ))
    .sort((left, right) => numberFor(left) - numberFor(right));
}

/** The paper an attempt belongs to, or null for generated and original sets. */
export function attemptPaperKey(attempt: Attempt): string | null {
  if (attempt.mode !== "historic") return null;
  const sourceExam = attempt.sourceExams?.[0];
  const year = attempt.sourceYears?.[0];
  if (!sourceExam || !year) return null;
  return paperSetKey(sourceExam, year, attempt.module);
}

function shuffle<T>(items: T[]): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

/** Specification topics available in a module, with how many approved questions each has. */
export function listTopics(questions: Question[], module: ModuleId): Array<{ topic: string; count: number }> {
  const counts = new Map<string, number>();
  for (const question of eligibleQuestions(questions, module)) {
    counts.set(question.esatTopic, (counts.get(question.esatTopic) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => left.topic.localeCompare(right.topic));
}

export function chooseQuestions(
  questions: Question[],
  module: ModuleId,
  count: number,
  progress: Record<string, QuestionProgress>,
  filter: "all" | "unseen" | "incorrect" | "due" = "all",
  mistakes: Record<string, MistakeItem> = {},
  year?: number,
  topic?: string,
): Question[] {
  const now = Date.now();
  const pool = eligibleQuestions(questions, module).filter((question) => {
    if (year && question.year !== year) return false;
    if (topic && question.esatTopic !== topic) return false;
    const item = progress[question.id];
    if (filter === "unseen") return !item || item.neverSeen;
    if (filter === "incorrect") return Boolean(item && item.totalIncorrect > 0 && !item.mastered);
    if (filter === "due") return Boolean(mistakes[question.id] && mistakes[question.id].dueDate <= now);
    return true;
  });
  const unseen = shuffle(pool.filter((question) => !progress[question.id] || progress[question.id].neverSeen));
  const seen = shuffle(pool.filter((question) => progress[question.id] && !progress[question.id].neverSeen));
  return [...unseen, ...seen].slice(0, count);
}

export function createAttempt(args: {
  questions: Question[];
  module: ModuleId;
  mode: AttemptMode;
  durationMinutes: number | null;
  strictTimed: boolean;
  generated: boolean;
  originalHistoricSet?: boolean;
  progress: Record<string, QuestionProgress>;
  sequenceRemaining?: ModuleId[];
  sequenceSource?: "archive" | "original";
}): Attempt {
  const startedAt = Date.now();
  const responses = Object.fromEntries(
    args.questions.map((question) => [
      question.id,
      {
        questionId: question.id,
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
        firstExposure: !args.progress[question.id] || args.progress[question.id].neverSeen,
        timestamps: [],
      } satisfies ResponseRecord,
    ]),
  );
  return {
    attemptId: crypto.randomUUID(),
    mode: args.mode,
    module: args.module,
    questionIds: args.questions.map((question) => question.id),
    questionBankVersion: args.questions[0]?.questionBankVersion ?? QUESTION_BANK_VERSION,
    specificationVersion: SPECIFICATION_VERSION,
    scoreConversionVersion: "unavailable-no-local-conversion-files",
    benchmarkVersion: BENCHMARK_VERSION,
    startedAt,
    endsAt: args.durationMinutes ? startedAt + args.durationMinutes * 60_000 : null,
    pausedAt: null,
    totalPausedDuration: 0,
    endedAt: null,
    durationMs: null,
    strictTimed: args.strictTimed,
    generated: args.generated,
    originalHistoricSet: Boolean(args.originalHistoricSet),
    sourceYears: [...new Set(args.questions.map((question) => question.year))],
    sourceExams: [...new Set(args.questions.map((question) => question.sourceExam))],
    sourceSetLabel: [...new Set(args.questions.map((question) => `${question.sourceExam} ${question.year}`))].join(" · "),
    currentIndex: 0,
    lastVisitStartedAt: startedAt,
    responses,
    completionStatus: "active",
    rawScore: null,
    freshQuestionCount: Object.values(responses).filter((response) => response.firstExposure).length,
    sequenceRemaining: args.sequenceRemaining ?? [],
    sequenceSource: args.sequenceSource ?? "archive",
  };
}

export function remainingMs(attempt: Attempt, now = Date.now()): number | null {
  if (attempt.endsAt === null) return null;
  const effectiveNow = attempt.pausedAt ?? now;
  return Math.max(0, attempt.endsAt - effectiveNow);
}

/** The authoritative expiry predicate, including the frozen clock of a paused attempt. */
export function isAttemptExpired(attempt: Attempt, now = Date.now()): boolean {
  const remaining = remainingMs(attempt, now);
  return remaining !== null && remaining === 0;
}

/**
 * A late browser wake-up must not award time beyond the stored deadline. Manual submission
 * still records the real submission time, while clock rollback can never precede the start.
 */
export function effectiveAttemptEndTime(
  attempt: Attempt,
  timedOut = false,
  now = Date.now(),
): number {
  const candidate = timedOut && attempt.endsAt !== null
    ? Math.min(now, attempt.endsAt)
    : now;
  return Math.max(attempt.startedAt, candidate);
}

export function settleCurrentVisit(attempt: Attempt, now = Date.now()): Attempt {
  const questionId = attempt.questionIds[attempt.currentIndex];
  if (!questionId || attempt.pausedAt) return attempt;
  return {
    ...attempt,
    lastVisitStartedAt: now,
    responses: {
      ...attempt.responses,
      [questionId]: {
        ...attempt.responses[questionId],
        timeSpentMs: attempt.responses[questionId].timeSpentMs + Math.max(0, now - attempt.lastVisitStartedAt),
      },
    },
  };
}

export function finalizeAttempt(
  attempt: Attempt,
  questionMap: Record<string, Question>,
  timedOut = false,
  now = Date.now(),
  /**
   * When the candidate stopped looking at the current question, if that is earlier than
   * submission — leaving the review list open, for instance. Without it, time spent
   * checking the whole paper is charged to whichever question happened to be open, which
   * is almost always the last one.
   */
  visitEndedAt?: number,
): Attempt {
  const endedAt = effectiveAttemptEndTime(attempt, timedOut, now);
  const settled = settleCurrentVisit(attempt, visitEndedAt ?? endedAt);
  const responses = { ...settled.responses };
  let rawScore = 0;
  for (const questionId of settled.questionIds) {
    const question = questionMap[questionId];
    const response = responses[questionId];
    if (!response) continue;
    // A question can disappear if the bank is rebuilt mid-attempt; the response is kept
    // but cannot be marked, so it is recorded as unanswered rather than crashing.
    const correct = Boolean(question) && response.selectedAnswer !== null && response.selectedAnswer === question.correctAnswer;
    if (correct) rawScore += 1;
    responses[questionId] = {
      ...response,
      finalAnswer: response.selectedAnswer,
      correct,
      unanswered: response.selectedAnswer === null || !question,
    };
  }
  const activePauseDuration = attempt.pausedAt === null
    ? 0
    : Math.max(0, endedAt - attempt.pausedAt);
  return {
    ...settled,
    responses,
    endedAt,
    durationMs: Math.max(
      0,
      endedAt - settled.startedAt - Math.max(0, settled.totalPausedDuration) - activePauseDuration,
    ),
    completionStatus: timedOut ? "timed-out" : "submitted",
    rawScore,
    pausedAt: null,
  };
}

/**
 * A missed question comes back after a night's sleep rather than immediately, so the
 * redo tests recall rather than working memory.
 */
export const RETRY_DELAY_DAYS = 1;

export function applyCompletedAttempt(state: StoredState, attempt: Attempt): StoredState {
  const progress = { ...state.progress };
  const mistakes = { ...state.mistakes };
  // Schedule retrieval from when the attempt actually ended so that a late sync does
  // not silently push every interval forward.
  const completedAt = attempt.endedAt ?? Date.now();
  for (const questionId of attempt.questionIds) {
    const response = attempt.responses[questionId];
    if (!response) continue;
    const prior = progress[questionId];
    const wasNeverSeen = !prior || prior.neverSeen;
    const item: QuestionProgress = prior
      ? { ...prior }
      : {
          neverSeen: true,
          firstSeenAt: null,
          firstAttemptCorrect: null,
          firstAttemptTime: null,
          firstAttemptMode: null,
          totalAttempts: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          mostRecentResult: null,
          mastered: false,
          exposureCount: 0,
          lastAttemptedAt: null,
        };
    item.neverSeen = false;
    item.firstSeenAt ??= attempt.startedAt;
    if (wasNeverSeen) {
      item.firstAttemptCorrect = Boolean(response.correct);
      item.firstAttemptTime = response.timeSpentMs;
      item.firstAttemptMode = attempt.mode;
    }
    item.totalAttempts += 1;
    item.exposureCount += 1;
    item.lastAttemptedAt = completedAt;
    item.mostRecentResult = Boolean(response.correct);
    if (response.correct) item.totalCorrect += 1;
    else item.totalIncorrect += 1;

    // One successful redo clears a mistake. Getting it wrong again re-queues it, so an
    // unresolved gap is never dropped — "once" means one correct answer, not one attempt.
    if (!response.correct) {
      mistakes[questionId] = {
        questionId,
        dueDate: completedAt + RETRY_DELAY_DAYS * 86_400_000,
        intervalDays: RETRY_DELAY_DAYS,
        correctStreak: 0,
        lastResult: false,
      };
      item.mastered = false;
    } else if (mistakes[questionId]) {
      delete mistakes[questionId];
      item.mastered = true;
    }
    progress[questionId] = item;
  }
  return {
    ...state,
    attempts: [attempt, ...state.attempts.filter((item) => item.attemptId !== attempt.attemptId)],
    activeAttempt: null,
    progress,
    mistakes,
  };
}

/**
 * The smallest fresh strict sample a cohort estimate may run on. Archive papers hold 18 to
 * 27 questions, so this admits every real paper while rejecting ad-hoc short sets, where a
 * single lucky answer would move the estimated score by a whole band.
 */
export const MIN_REPRESENTATIVE_QUESTIONS = 18;

export type ScoreEstimateEligibilityReason =
  | "eligible"
  | "incomplete"
  | "retrieval"
  | "practice"
  | "original"
  | "not-strict"
  | "too-short"
  | "repeated";

/**
 * The single source of truth for "is this attempt readiness evidence?". The cohort estimate
 * and the module readiness statistics must agree: if they drifted apart, the dashboard would
 * average an attempt that its own breakdown refuses to score.
 *
 * Order matters only for which reason is reported; any non-eligible reason disqualifies.
 */
export function scoreEstimateEligibility(attempt: Attempt): ScoreEstimateEligibilityReason {
  if (attempt.rawScore === null) return "incomplete";
  if (attempt.mode === "retry") return "retrieval";
  if (attempt.mode === "practice") return "practice";
  if (attempt.mode === "original") return "original";
  if (!attempt.strictTimed) return "not-strict";
  if (attempt.questionIds.length < MIN_REPRESENTATIVE_QUESTIONS) return "too-short";
  if (attempt.freshQuestionCount !== attempt.questionIds.length) return "repeated";
  return "eligible";
}

export function isReadinessEvidence(attempt: Attempt): boolean {
  return scoreEstimateEligibility(attempt) === "eligible";
}

export interface ModuleStats {
  attemptCount: number;
  freshAttemptCount: number;
  freshAccuracy: number | null;
  retakeAccuracy: number | null;
  /** Mean raw mark over the recent strict attempts. */
  recentRawAverage: number | null;
  /** Mean number of questions in those attempts; papers are not all 27 questions. */
  recentQuestionAverage: number | null;
  /** Mean proportion correct, which is the only figure comparable across papers. */
  recentAccuracy: number | null;
  /** Lowest proportion correct across the recent strict attempts. */
  recentFloorAccuracy: number | null;
  trend: "improving" | "declining" | "stable" | "insufficient data";
}

export function moduleStats(attempts: Attempt[], module: ModuleId): ModuleStats {
  const completed = attempts.filter((attempt) => attempt.module === module && attempt.rawScore !== null);
  const freshResponses = completed.flatMap((attempt) =>
    Object.values(attempt.responses).filter((response) => response.firstExposure),
  );
  const retakeResponses = completed.flatMap((attempt) =>
    Object.values(attempt.responses).filter((response) => !response.firstExposure),
  );
  const strict = completed
    .filter(isReadinessEvidence)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  const recent = strict.slice(0, 5);
  const recentScores = recent.map((attempt) => attempt.rawScore ?? 0);
  const recentCounts = recent.map((attempt) => Math.max(1, attempt.questionIds.length));
  // Papers differ in length (18 to 27 questions), so trend and comparison must run on
  // the proportion correct rather than the raw mark.
  const recentAccuracies = recentScores.map((score, index) => score / recentCounts[index]);
  const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
  let trend: ModuleStats["trend"] = "insufficient data";
  if (recentAccuracies.length >= 3) {
    const newestMean = mean(recentAccuracies.slice(0, Math.ceil(recentAccuracies.length / 2)));
    const oldestMean = mean(recentAccuracies.slice(Math.floor(recentAccuracies.length / 2)));
    trend = newestMean > oldestMean + 0.02 ? "improving" : newestMean < oldestMean - 0.02 ? "declining" : "stable";
  }
  return {
    attemptCount: completed.length,
    freshAttemptCount: strict.length,
    freshAccuracy: freshResponses.length
      ? freshResponses.filter((response) => response.correct).length / freshResponses.length
      : null,
    retakeAccuracy: retakeResponses.length
      ? retakeResponses.filter((response) => response.correct).length / retakeResponses.length
      : null,
    recentRawAverage: recentScores.length ? mean(recentScores) : null,
    recentQuestionAverage: recentCounts.length ? mean(recentCounts) : null,
    recentAccuracy: recentAccuracies.length ? mean(recentAccuracies) : null,
    recentFloorAccuracy: recentAccuracies.length ? Math.min(...recentAccuracies) : null,
    trend,
  };
}

/**
 * Local-calendar helpers. Every "day" the product talks about — a study streak, a plan
 * window, a heatmap cell — is the candidate's local day, never UTC. These live here so
 * the planner and the activity statistics cannot drift apart on what "today" means.
 */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `YYYY-MM-DD` for the local calendar day containing `now`. */
export function localDayKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight at the start of the local calendar day containing `now`. */
export function localDayStart(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * A monotonic index for a local calendar day. Subtracting two serials gives an exact
 * whole-day difference, which subtracting two timestamps does not across a DST change.
 */
export function localDaySerial(now: number): number {
  const date = new Date(now);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** Midnight on the local day `days` after the day containing `now`. */
export function localDayOffset(now: number, days: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Whole seconds, as the post-test review reports per-question time: "84 s". */
export function formatSeconds(ms: number): string {
  return `${Math.max(0, Math.round(ms / 1000))} s`;
}

/** Human-readable elapsed time for summaries, e.g. "1 h 24 m" or "8 m 05 s". */
export function formatLongDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours} h ${String(minutes).padStart(2, "0")} m`;
  return `${minutes} m ${String(seconds).padStart(2, "0")} s`;
}
