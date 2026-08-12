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
  optionText?: Record<string, string>;
  explanation?: string;
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
}

export interface StoredState {
  attempts: Attempt[];
  activeAttempt: Attempt | null;
  progress: Record<string, QuestionProgress>;
  mistakes: Record<string, MistakeItem>;
  targets: Record<ModuleId, number>;
  settings: Settings;
  notes: Record<string, string>;
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
      examDate: "2026-10-12",
      weeklyHours: 8,
      adaptivePlanMinutes: 45,
      pacingAid: false,
      showScoreEstimate: true,
    },
    notes: {},
  };
}

export function mergeState(value: Partial<StoredState> | null | undefined): StoredState {
  const base = defaultState();
  if (!value) return base;
  const normalizeAttempt = (attempt: Attempt): Attempt => ({
    ...attempt,
    sourceExams: attempt.sourceExams ?? [],
    sourceSetLabel: attempt.sourceSetLabel ?? (attempt.sourceYears?.length ? `Archive ${attempt.sourceYears.join(", ")}` : "Practice set"),
    sequenceSource: attempt.sequenceSource ?? "archive",
  });
  const savedPlanMinutes = Number(value.settings?.adaptivePlanMinutes);
  const adaptivePlanMinutes = Number.isFinite(savedPlanMinutes)
    ? Math.min(120, Math.max(15, Math.round(savedPlanMinutes / 15) * 15))
    : base.settings.adaptivePlanMinutes;
  return {
    ...base,
    ...value,
    attempts: (value.attempts ?? []).map(normalizeAttempt),
    activeAttempt: value.activeAttempt ? normalizeAttempt(value.activeAttempt) : null,
    progress: value.progress ?? base.progress,
    mistakes: value.mistakes ?? base.mistakes,
    notes: value.notes ?? base.notes,
    targets: { ...base.targets, ...(value.targets ?? {}) },
    settings: { ...base.settings, ...(value.settings ?? {}), adaptivePlanMinutes },
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
): Attempt {
  const settled = settleCurrentVisit(attempt, now);
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
      unanswered: response.selectedAnswer === null,
    };
  }
  return {
    ...settled,
    responses,
    endedAt: now,
    durationMs: now - settled.startedAt - settled.totalPausedDuration,
    completionStatus: timedOut ? "timed-out" : "submitted",
    rawScore,
    pausedAt: null,
  };
}

const RETRY_INTERVALS = [1, 3, 7, 14, 30];

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
    item.lastAttemptedAt = attempt.endedAt;
    item.mostRecentResult = Boolean(response.correct);
    if (response.correct) item.totalCorrect += 1;
    else item.totalIncorrect += 1;

    const previousMistake = mistakes[questionId];
    if (!response.correct) {
      mistakes[questionId] = {
        questionId,
        dueDate: completedAt + RETRY_INTERVALS[0] * 86_400_000,
        intervalDays: RETRY_INTERVALS[0],
        correctStreak: 0,
        lastResult: false,
      };
      item.mastered = false;
    } else if (previousMistake) {
      const streak = previousMistake.correctStreak + 1;
      const interval = RETRY_INTERVALS[Math.min(streak, RETRY_INTERVALS.length - 1)];
      mistakes[questionId] = {
        questionId,
        dueDate: completedAt + interval * 86_400_000,
        intervalDays: interval,
        correctStreak: streak,
        lastResult: true,
      };
      item.mastered = streak >= 3;
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
    .filter((attempt) => attempt.strictTimed && attempt.freshQuestionCount > 0)
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

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

export function daysUntil(dateString: string): number | null {
  const timestamp = new Date(`${dateString}T12:00:00`).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 86_400_000));
}
