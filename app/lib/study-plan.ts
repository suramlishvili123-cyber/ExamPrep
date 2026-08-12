import {
  MODULE_LABELS,
  MODULE_ORDER,
  eligibleQuestions,
  esatPacedDurationMs,
  listPaperSets,
  paperQuestions,
  type AttemptMode,
  type ModuleId,
  type PaperSet,
  type Question,
  type QuestionProgress,
  type StoredState,
} from "./core";
import { SCORE_CURVE } from "./scoring";

export type StudyPlanPhase = "foundation" | "consolidation" | "simulation" | "taper" | "date-needed";
export type StudyPlanSessionKind = "retrieval" | "maintenance" | "baseline" | "focus" | "coverage" | "simulation";
export type StudyPlanStatus = "active" | "ready" | "complete" | "unavailable";

export interface StudyPlanSession {
  id: string;
  kind: StudyPlanSessionKind;
  module: ModuleId;
  mode: AttemptMode;
  questionIds: string[];
  title: string;
  summary: string;
  rationale: string[];
  estimatedMinutes: number;
  durationMinutes: number | null;
  strictTimed: boolean;
  topic: string | null;
  evidenceConfidence: "limited" | "developing" | "established";
  source?: {
    exam: string;
    year: number;
    label: string;
  };
}

export interface AdaptiveStudyPlan {
  dayKey: string;
  phase: StudyPlanPhase;
  status: StudyPlanStatus;
  daysRemaining: number | null;
  dailyBudgetMinutes: number;
  targetMinutesToday: number;
  completedPlanMinutesToday: number;
  completedPlanSessionsToday: number;
  weeklyTargetMinutes: number;
  completedMinutesThisWeek: number;
  confidence: "starting" | "developing" | "established";
  sessions: StudyPlanSession[];
  dueCount: number;
  unavailableDueCount: number;
  totalQuestions: number;
  totalEstimatedMinutes: number;
  headline: string;
  summary: string;
  rationale: string[];
  activeAttemptId: string | null;
}

export interface BuildAdaptiveStudyPlanInput {
  archiveQuestions: Question[];
  supplementalQuestions?: Question[];
  state: StoredState;
  now: number;
}

interface TopicEvidence {
  module: ModuleId;
  topic: string;
  approvedCount: number;
  seenCount: number;
  resultCount: number;
  correctCount: number;
  accuracy: number | null;
  coverageNeed: number;
  accuracyNeed: number;
  priority: number;
  reliableWeakness: boolean;
}

interface ModuleEvidence {
  module: ModuleId;
  strictFreshCount: number;
  strictFreshCorrect: number;
  strictFreshAccuracy: number | null;
  lastStrictAt: number | null;
  topics: TopicEvidence[];
}

interface PaperCandidate {
  set: PaperSet;
  questions: Question[];
  pristine: boolean;
}

interface DueQuestion {
  question: Question;
  dueDate: number;
  correctStreak: number;
  lastResult: boolean;
  mastered: boolean;
  lastAttemptedAt: number | null;
}

interface FocusCandidate {
  module: ModuleId;
  kind: "focus" | "coverage";
  topic: TopicEvidence;
  priority: number;
}

const DAY_MS = 86_400_000;
const BASELINE_RESPONSE_COUNT = 10;
const DEFAULT_PLAN_MINUTES = 45;
const MIN_PLAN_MINUTES = 15;
const MAX_PLAN_MINUTES = 120;
const MIN_WEEKLY_HOURS = 1;
const MAX_WEEKLY_HOURS = 40;
const MAX_SESSION_QUESTIONS = 10;
const MIN_RELIABLE_TOPIC_RESPONSES = 4;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizedInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return Math.round(clamp(finiteNumber(value, fallback), minimum, maximum));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localDayKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localDaySerial(now: number): number {
  const date = new Date(now);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function parseExamDaySerial(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return Math.floor(timestamp / DAY_MS);
}

function phaseFor(examDate: unknown, now: number): { phase: StudyPlanPhase; daysRemaining: number | null } {
  const examDay = parseExamDaySerial(examDate);
  if (examDay === null) return { phase: "date-needed", daysRemaining: null };
  const daysRemaining = examDay - localDaySerial(now);
  if (daysRemaining < 0) return { phase: "date-needed", daysRemaining: null };
  if (daysRemaining > 42) return { phase: "foundation", daysRemaining };
  if (daysRemaining >= 22) return { phase: "consolidation", daysRemaining };
  if (daysRemaining >= 8) return { phase: "simulation", daysRemaining };
  return { phase: "taper", daysRemaining };
}

function localWeekStart(now: number): number {
  const date = new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayIndex);
  return start.getTime();
}

function localDayStart(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function completedPlanWorkToday(state: StoredState, now: number): {
  durationMs: number;
  budgetMinutes: number;
  retrievalBudgetMinutes: number;
  sessionCount: number;
} {
  const dayStart = localDayStart(now);
  return state.attempts.reduce((total, attempt) => {
    const endedAt = finiteNumber(attempt.endedAt, -1);
    const durationMs = finiteNumber(attempt.durationMs, 0);
    if (!attempt.planSessionId || attempt.rawScore === null || endedAt < dayStart || endedAt > now || durationMs <= 0) return total;
    const budgetMinutes = clamp(
      finiteNumber(attempt.planSessionEstimatedMinutes, durationMs / 60_000),
      0,
      MAX_PLAN_MINUTES,
    );
    return {
      durationMs: total.durationMs + durationMs,
      budgetMinutes: total.budgetMinutes + budgetMinutes,
      retrievalBudgetMinutes: total.retrievalBudgetMinutes + (attempt.planSessionKind === "retrieval" ? budgetMinutes : 0),
      sessionCount: total.sessionCount + 1,
    };
  }, { durationMs: 0, budgetMinutes: 0, retrievalBudgetMinutes: 0, sessionCount: 0 });
}

function completedStudyMsThisWeek(state: StoredState, now: number): number {
  const weekStart = localWeekStart(now);
  return state.attempts.reduce((total, attempt) => {
    const endedAt = finiteNumber(attempt.endedAt, -1);
    const durationMs = finiteNumber(attempt.durationMs, 0);
    if (attempt.rawScore === null || endedAt < weekStart || endedAt > now || durationMs <= 0) return total;
    return total + durationMs;
  }, 0);
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function compareModule(left: ModuleId, right: ModuleId): number {
  return MODULE_ORDER.indexOf(left) - MODULE_ORDER.indexOf(right);
}

function uniqueEligible(questions: Question[]): Question[] {
  const byId = new Map<string, Question>();
  for (const module of MODULE_ORDER) {
    for (const question of eligibleQuestions(questions, module)) {
      if (!byId.has(question.id)) byId.set(question.id, question);
    }
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function isSeen(progress: QuestionProgress | undefined): boolean {
  return Boolean(progress && !progress.neverSeen);
}

function targetAccuracyForScaledScore(value: unknown): number {
  const target = clamp(finiteNumber(value, 7), SCORE_CURVE[0].scaledScore, SCORE_CURVE[SCORE_CURVE.length - 1].scaledScore);
  for (let index = 1; index < SCORE_CURVE.length; index += 1) {
    const lower = SCORE_CURVE[index - 1];
    const upper = SCORE_CURVE[index];
    if (target <= upper.scaledScore) {
      const span = upper.scaledScore - lower.scaledScore;
      const weight = span === 0 ? 0 : (target - lower.scaledScore) / span;
      return (lower.percentCorrect + weight * (upper.percentCorrect - lower.percentCorrect)) / 100;
    }
  }
  return 1;
}

function buildModuleEvidence(archive: Question[], state: StoredState): Record<ModuleId, ModuleEvidence> {
  return Object.fromEntries(MODULE_ORDER.map((module) => {
    const moduleQuestions = archive.filter((question) => question.targetModule === module);
    const strictProgress = moduleQuestions
      .map((question) => state.progress[question.id])
      .filter((progress): progress is QuestionProgress => Boolean(
        progress
        && !progress.neverSeen
        && (progress.firstAttemptMode === "exam" || progress.firstAttemptMode === "historic" || progress.firstAttemptMode === "original")
        && progress.firstAttemptCorrect !== null,
      ));
    const completedStrict = state.attempts
      .filter((attempt) => (
        attempt.module === module
        && attempt.strictTimed
        && attempt.rawScore !== null
        && attempt.freshQuestionCount > 0
        && (attempt.mode === "exam" || attempt.mode === "historic" || attempt.mode === "original")
      ))
      .map((attempt) => attempt.endedAt ?? attempt.startedAt)
      .filter((timestamp) => Number.isFinite(timestamp));
    const topicNames = [...new Set(moduleQuestions.map((question) => question.esatTopic))].sort((left, right) => left.localeCompare(right));
    const targetAccuracy = targetAccuracyForScaledScore(state.targets[module]);
    const topics = topicNames.map((topic): TopicEvidence => {
      const topicQuestions = moduleQuestions.filter((question) => question.esatTopic === topic);
      const seen = topicQuestions.filter((question) => isSeen(state.progress[question.id]));
      const results = seen
        .map((question) => state.progress[question.id]?.firstAttemptCorrect)
        .filter((result): result is boolean => result !== null && result !== undefined);
      const correctCount = results.filter(Boolean).length;
      const accuracy = results.length ? correctCount / results.length : null;
      const coverageGoal = Math.min(8, topicQuestions.length);
      const coverageNeed = coverageGoal ? 1 - Math.min(seen.length / coverageGoal, 1) : 0;
      const smoothedAccuracy = (correctCount + 2) / (results.length + 4);
      const accuracyNeed = clamp(
        (targetAccuracy - smoothedAccuracy) / Math.max(targetAccuracy, 0.35),
        0,
        1,
      );
      const reliableWeakness = results.length >= MIN_RELIABLE_TOPIC_RESPONSES
        && accuracy !== null
        && accuracy < targetAccuracy
        && smoothedAccuracy < targetAccuracy;
      return {
        module,
        topic,
        approvedCount: topicQuestions.length,
        seenCount: seen.length,
        resultCount: results.length,
        correctCount,
        accuracy,
        coverageNeed,
        accuracyNeed,
        priority: reliableWeakness ? 0.7 * accuracyNeed + 0.3 * coverageNeed : coverageNeed,
        reliableWeakness,
      };
    });
    return [module, {
      module,
      strictFreshCount: strictProgress.length,
      strictFreshCorrect: strictProgress.filter((progress) => progress.firstAttemptCorrect).length,
      strictFreshAccuracy: strictProgress.length
        ? strictProgress.filter((progress) => progress.firstAttemptCorrect).length / strictProgress.length
        : null,
      lastStrictAt: completedStrict.length ? Math.max(...completedStrict) : null,
      topics,
    } satisfies ModuleEvidence];
  })) as Record<ModuleId, ModuleEvidence>;
}

function overallConfidence(evidence: Record<ModuleId, ModuleEvidence>): AdaptiveStudyPlan["confidence"] {
  const establishedModules = MODULE_ORDER.filter((module) => evidence[module].strictFreshCount >= BASELINE_RESPONSE_COUNT).length;
  if (establishedModules === MODULE_ORDER.length) return "established";
  if (establishedModules > 0 || MODULE_ORDER.some((module) => evidence[module].strictFreshCount > 0)) return "developing";
  return "starting";
}

function evidenceConfidence(count: number): StudyPlanSession["evidenceConfidence"] {
  if (count < BASELINE_RESPONSE_COUNT) return "limited";
  if (count < 27) return "developing";
  return "established";
}

function estimatedMinutesForQuestions(count: number): number {
  return count ? Math.max(1, Math.ceil(esatPacedDurationMs(count) / 60_000)) : 0;
}

function questionCapacityForMinutes(minutes: number): number {
  return Math.max(0, Math.floor(Math.max(0, minutes) * 27 / 40));
}

function paperCandidates(archive: Question[], state: StoredState): PaperCandidate[] {
  return listPaperSets(archive)
    .filter((set) => set.questionCount >= 18)
    .map((set) => {
      const questions = paperQuestions(archive, set.sourceExam, set.year, set.module);
      return {
        set,
        questions,
        pristine: questions.length >= 18 && questions.every((question) => !isSeen(state.progress[question.id])),
      };
    })
    .filter((candidate) => candidate.questions.length >= 18);
}

function reservedPaperIdsByModule(papers: PaperCandidate[]): Record<ModuleId, Set<string>> {
  return Object.fromEntries(MODULE_ORDER.map((module) => {
    const newest = papers
      .filter((candidate) => candidate.set.module === module && candidate.pristine)
      .sort((left, right) => (
        right.set.year - left.set.year
        || left.set.sourceExam.localeCompare(right.set.sourceExam)
        || left.set.key.localeCompare(right.set.key)
      ))[0];
    return [module, new Set((newest?.questions ?? []).map((question) => question.id))];
  })) as Record<ModuleId, Set<string>>;
}

function rankedUnseen(
  questions: Question[],
  state: StoredState,
  usedIds: Set<string>,
  reservedIds: Set<string>,
  seed: string,
): Question[] {
  return questions
    .filter((question) => !usedIds.has(question.id) && !isSeen(state.progress[question.id]))
    .sort((left, right) => (
      Number(reservedIds.has(left.id)) - Number(reservedIds.has(right.id))
      || left.year - right.year
      || stableHash(`${seed}|${left.id}`) - stableHash(`${seed}|${right.id}`)
      || left.id.localeCompare(right.id)
    ));
}

function balancedUnseen(
  questions: Question[],
  count: number,
  state: StoredState,
  usedIds: Set<string>,
  reservedIds: Set<string>,
  seed: string,
): Question[] {
  if (count <= 0) return [];
  const ranked = rankedUnseen(questions, state, usedIds, reservedIds, seed);
  const nonReservedCount = ranked.filter((question) => !reservedIds.has(question.id)).length;
  const pool = nonReservedCount >= count
    ? ranked.filter((question) => !reservedIds.has(question.id))
    : ranked;
  const groups = [...new Set(pool.map((question) => question.esatTopic))]
    .map((topic) => ({
      topic,
      seenCount: questions.filter((question) => question.esatTopic === topic && isSeen(state.progress[question.id])).length,
      questions: pool.filter((question) => question.esatTopic === topic),
    }))
    .sort((left, right) => left.seenCount - right.seenCount || left.topic.localeCompare(right.topic));
  const selected: Question[] = [];
  while (selected.length < count) {
    let added = false;
    for (const group of groups) {
      const question = group.questions.shift();
      if (!question) continue;
      selected.push(question);
      added = true;
      if (selected.length === count) break;
    }
    if (!added) break;
  }
  return selected.sort((left, right) => (
    stableHash(`${seed}|order|${left.id}`) - stableHash(`${seed}|order|${right.id}`)
    || left.id.localeCompare(right.id)
  ));
}

function focusedUnseen(
  questions: Question[],
  count: number,
  state: StoredState,
  usedIds: Set<string>,
  reservedIds: Set<string>,
  seed: string,
): Question[] {
  const ranked = rankedUnseen(questions, state, usedIds, reservedIds, seed);
  const nonReserved = ranked.filter((question) => !reservedIds.has(question.id));
  return (nonReserved.length >= count ? nonReserved : ranked).slice(0, count);
}

function compareDue(left: DueQuestion, right: DueQuestion): number {
  return (
    Number(right.lastResult === false) - Number(left.lastResult === false)
    || left.dueDate - right.dueDate
    || left.correctStreak - right.correctStreak
    || (left.lastAttemptedAt ?? -1) - (right.lastAttemptedAt ?? -1)
    || compareModule(left.question.targetModule, right.question.targetModule)
    || left.question.id.localeCompare(right.question.id)
  );
}

function dueQuestions(
  archiveQuestions: Question[],
  supplementalQuestions: Question[],
  state: StoredState,
  now: number,
): { available: DueQuestion[]; unavailableCount: number } {
  const eligible = uniqueEligible([...archiveQuestions, ...supplementalQuestions]);
  const questionMap = new Map(eligible.map((question) => [question.id, question]));
  const available: DueQuestion[] = [];
  let unavailableCount = 0;
  const uniqueMistakes = new Map<string, (typeof state.mistakes)[string]>();
  for (const mistake of Object.values(state.mistakes)) {
    const existing = uniqueMistakes.get(mistake.questionId);
    if (!existing || finiteNumber(mistake.dueDate, Number.POSITIVE_INFINITY) < finiteNumber(existing.dueDate, Number.POSITIVE_INFINITY)) {
      uniqueMistakes.set(mistake.questionId, mistake);
    }
  }
  for (const mistake of uniqueMistakes.values()) {
    const dueDate = finiteNumber(mistake.dueDate, Number.POSITIVE_INFINITY);
    if (dueDate > now) continue;
    const question = questionMap.get(mistake.questionId);
    if (!question) {
      unavailableCount += 1;
      continue;
    }
    const progress = state.progress[mistake.questionId];
    available.push({
      question,
      dueDate,
      correctStreak: Math.max(0, finiteNumber(mistake.correctStreak, 0)),
      lastResult: Boolean(mistake.lastResult),
      mastered: Boolean(progress?.mastered),
      lastAttemptedAt: progress?.lastAttemptedAt ?? null,
    });
  }
  return { available: available.sort(compareDue), unavailableCount };
}

function phaseLabel(phase: StudyPlanPhase): string {
  if (phase === "foundation") return "Foundation phase";
  if (phase === "consolidation") return "Consolidation phase";
  if (phase === "simulation") return "Simulation phase";
  if (phase === "taper") return "Taper phase";
  return "Planning date needed";
}

function planTotals(sessions: StudyPlanSession[]): { questions: number; minutes: number } {
  return sessions.reduce(
    (totals, session) => ({
      questions: totals.questions + session.questionIds.length,
      minutes: totals.minutes + session.estimatedMinutes,
    }),
    { questions: 0, minutes: 0 },
  );
}

export function buildAdaptiveStudyPlan({
  archiveQuestions,
  supplementalQuestions = [],
  state,
  now,
}: BuildAdaptiveStudyPlanInput): AdaptiveStudyPlan {
  const safeNow = finiteNumber(now, 0);
  const dayKey = localDayKey(safeNow);
  const { phase, daysRemaining } = phaseFor(state.settings.examDate, safeNow);
  const configuredPlanMinutes = sanitizedInteger(
    state.settings.adaptivePlanMinutes,
    MIN_PLAN_MINUTES,
    MAX_PLAN_MINUTES,
    DEFAULT_PLAN_MINUTES,
  );
  const phaseAdjustedPlanMinutes = phase === "taper"
    ? Math.min(configuredPlanMinutes, daysRemaining !== null && daysRemaining <= 2 ? 20 : 30)
    : configuredPlanMinutes;
  const weeklyHours = sanitizedInteger(
    state.settings.weeklyHours,
    MIN_WEEKLY_HOURS,
    MAX_WEEKLY_HOURS,
    8,
  );
  const weeklyTargetMinutes = weeklyHours * 60;
  const completedStudyMs = completedStudyMsThisWeek(state, safeNow);
  const completedMinutesThisWeek = Math.max(0, Math.floor(completedStudyMs / 60_000));
  const weeklyTargetMet = completedStudyMs >= weeklyTargetMinutes * 60_000;
  const archive = uniqueEligible(archiveQuestions);
  const due = dueQuestions(archiveQuestions, supplementalQuestions, state, safeNow);
  const unresolvedDue = due.available.filter((item) => !item.mastered);
  const maintenanceDue = due.available.filter((item) => item.mastered);
  const completedToday = completedPlanWorkToday(state, safeNow);
  const completedStudyBeforeTodayPlanMs = Math.max(0, completedStudyMs - completedToday.durationMs);
  const completedPlanMinutesToday = Math.max(0, Math.round(completedToday.durationMs / 60_000));
  const dailyBudgetMinutes = weeklyTargetMet && unresolvedDue.length === 0
    ? 0
    : weeklyTargetMet
      ? phaseAdjustedPlanMinutes
      : Math.min(
        phaseAdjustedPlanMinutes,
        Math.max(MIN_PLAN_MINUTES, Math.ceil(weeklyTargetMinutes - completedStudyBeforeTodayPlanMs / 60_000)),
      );
  const remainingDailyMinutes = Math.floor(dailyBudgetMinutes - completedToday.budgetMinutes);
  const targetMinutesToday = remainingDailyMinutes >= 2 ? remainingDailyMinutes : 0;
  const evidence = buildModuleEvidence(uniqueEligible([...archiveQuestions, ...supplementalQuestions]), state);
  const confidence = overallConfidence(evidence);
  const activeAttemptId = state.activeAttempt?.attemptId ?? null;
  const common = {
    dayKey,
    phase,
    daysRemaining,
    dailyBudgetMinutes,
    targetMinutesToday,
    completedPlanMinutesToday,
    completedPlanSessionsToday: completedToday.sessionCount,
    weeklyTargetMinutes,
    completedMinutesThisWeek,
    confidence,
    dueCount: due.available.length,
    unavailableDueCount: due.unavailableCount,
    activeAttemptId,
  };

  if (activeAttemptId) {
    return {
      ...common,
      status: "active",
      sessions: [],
      totalQuestions: 0,
      totalEstimatedMinutes: 0,
      headline: "Continue your current session",
      summary: "Your active attempt remains the next priority, with its answers and timing preserved.",
      rationale: ["Only one live attempt is allowed at a time.", `${phaseLabel(phase)} recommendations will refresh after submission.`],
    };
  }

  if (weeklyTargetMet && unresolvedDue.length === 0) {
    return {
      ...common,
      status: "complete",
      sessions: [],
      totalQuestions: 0,
      totalEstimatedMinutes: 0,
      headline: "This week’s target is complete",
      summary: maintenanceDue.length
        ? "Your planned study target is complete. Mastered maintenance items can wait for the next study window."
        : "You have met your weekly study target and have no unresolved retrieval work due.",
      rationale: [
        `${completedMinutesThisWeek} of ${weeklyTargetMinutes} planned minutes are recorded this week.`,
        "The planner will reopen automatically when unresolved retrieval becomes due or a new week begins.",
      ],
    };
  }

  if (targetMinutesToday === 0 && completedToday.sessionCount > 0) {
    return {
      ...common,
      status: "complete",
      sessions: [],
      totalQuestions: 0,
      totalEstimatedMinutes: 0,
      headline: "Today’s study plan is complete",
      summary: `You completed ${completedToday.sessionCount} adaptive session${completedToday.sessionCount === 1 ? "" : "s"} and recorded ${completedPlanMinutesToday} focused minute${completedPlanMinutesToday === 1 ? "" : "s"} today.`,
      rationale: [
        `Today’s ${dailyBudgetMinutes}-minute planning budget has been used.`,
        unresolvedDue.length
          ? `${unresolvedDue.length} unresolved retrieval item${unresolvedDue.length === 1 ? " remains" : "s remain"} queued for the next plan window.`
          : "No unresolved retrieval is currently due.",
        "Tomorrow’s plan will rebuild from the evidence recorded today.",
      ],
    };
  }

  const papers = paperCandidates(archive, state);
  const reservedIds = reservedPaperIdsByModule(papers);
  const usedIds = new Set<string>();
  const sessions: StudyPlanSession[] = [];
  const idCounts = new Map<string, number>();
  const nextId = (kind: StudyPlanSessionKind, module: ModuleId, detail: string): string => {
    const stem = `${dayKey}-${kind}-${module}-${detail.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session"}`;
    const occurrence = idCounts.get(stem) ?? 0;
    idCounts.set(stem, occurrence + 1);
    return occurrence ? `${stem}-${occurrence + 1}` : stem;
  };
  const addSession = (session: StudyPlanSession): boolean => {
    if (!session.questionIds.length || session.estimatedMinutes > Math.max(0, targetMinutesToday - planTotals(sessions).minutes)) return false;
    const exactListSignature = stableHash(session.questionIds.join("|")).toString(36);
    sessions.push({ ...session, id: `${session.id}-${exactListSignature}` });
    for (const questionId of session.questionIds) usedIds.add(questionId);
    return true;
  };
  const minutesUsed = (): number => planTotals(sessions).minutes;
  const minutesRemaining = (): number => Math.max(0, targetMinutesToday - minutesUsed());

  // Retrieval is a hard scheduling obligation. It receives at most about 40% of the
  // configured daily budget so that a large queue cannot crowd out fresh evidence.
  const dailyRetrievalAllowance = Math.floor(dailyBudgetMinutes * 0.4);
  const retrievalMinuteCap = Math.min(
    minutesRemaining(),
    Math.max(0, Math.floor(dailyRetrievalAllowance - completedToday.retrievalBudgetMinutes)),
  );
  const retrievalQuestionCap = questionCapacityForMinutes(retrievalMinuteCap);
  const selectedRetrieval = unresolvedDue.slice(0, retrievalQuestionCap);
  const retrievalGroups = new Map<string, DueQuestion[]>();
  for (const item of selectedRetrieval) {
    const key = `${item.question.targetModule}|${item.question.questionBankVersion}`;
    const group = retrievalGroups.get(key) ?? [];
    group.push(item);
    retrievalGroups.set(key, group);
  }
  const orderedRetrievalGroups = [...retrievalGroups.values()].sort((left, right) => compareDue(left[0], right[0]));
  let retrievalMinutesScheduled = 0;
  for (const group of orderedRetrievalGroups) {
    for (let offset = 0; offset < group.length;) {
      const minuteRoom = retrievalMinuteCap - retrievalMinutesScheduled;
      const chunkSize = Math.min(MAX_SESSION_QUESTIONS, questionCapacityForMinutes(minuteRoom));
      if (chunkSize <= 0) break;
      const chunk = group.slice(offset, offset + chunkSize);
      if (!chunk.length) break;
      const module = chunk[0].question.targetModule;
      const oldestDays = Math.max(0, Math.floor((safeNow - Math.min(...chunk.map((item) => item.dueDate))) / DAY_MS));
      const estimatedMinutes = estimatedMinutesForQuestions(chunk.length);
      const added = addSession({
        id: nextId("retrieval", module, String(offset / MAX_SESSION_QUESTIONS + 1)),
        kind: "retrieval",
        module,
        mode: "retry",
        questionIds: chunk.map((item) => item.question.id),
        title: `Scheduled retrieval · ${MODULE_LABELS[module]}`,
        summary: `Revisit ${chunk.length} unresolved question${chunk.length === 1 ? "" : "s"} before adding new material.`,
        rationale: [
          `${chunk.length} item${chunk.length === 1 ? " is" : "s are"} due under the spaced-retrieval schedule.`,
          oldestDays ? `The oldest selected item is ${oldestDays} day${oldestDays === 1 ? "" : "s"} overdue.` : "Every selected item is due now.",
        ],
        estimatedMinutes,
        durationMinutes: null,
        strictTimed: false,
        topic: null,
        evidenceConfidence: evidenceConfidence(evidence[module].strictFreshCount),
      });
      if (!added) break;
      retrievalMinutesScheduled += estimatedMinutes;
      offset += chunk.length;
    }
  }

  const allowNonUrgentWork = !weeklyTargetMet;
  const newModules = MODULE_ORDER
    .filter((module) => evidence[module].strictFreshCount < BASELINE_RESPONSE_COUNT)
    .sort((left, right) => (
      evidence[left].strictFreshCount - evidence[right].strictFreshCount
      || (evidence[left].lastStrictAt ?? -1) - (evidence[right].lastStrictAt ?? -1)
      || compareModule(left, right)
    ));
  const plannedBaselineModules = new Set<ModuleId>();

  const addBaseline = (module: ModuleId): boolean => {
    const baselineQuestionLimit = phase === "taper"
      ? daysRemaining !== null && daysRemaining <= 2 ? 6 : 8
      : MAX_SESSION_QUESTIONS;
    const capacity = Math.min(baselineQuestionLimit, questionCapacityForMinutes(minutesRemaining()));
    if (capacity <= 0) return false;
    const moduleQuestions = archive.filter((question) => question.targetModule === module);
    const selected = balancedUnseen(
      moduleQuestions,
      capacity,
      state,
      usedIds,
      reservedIds[module],
      `${dayKey}|baseline|${module}`,
    );
    if (!selected.length) return false;
    const estimatedMinutes = estimatedMinutesForQuestions(selected.length);
    const strictCount = evidence[module].strictFreshCount;
    const added = addSession({
      id: nextId("baseline", module, "fresh-evidence"),
      kind: "baseline",
      module,
      mode: "exam",
      questionIds: selected.map((question) => question.id),
      title: `Build a ${MODULE_LABELS[module]} baseline`,
      summary: `A fresh, paced ${selected.length}-question diagnostic will establish evidence before the plan personalises this module.`,
      rationale: [
        `${strictCount} of ${BASELINE_RESPONSE_COUNT} first-exposure strict responses are currently available for personalisation.`,
        selected.length < BASELINE_RESPONSE_COUNT
          ? "The remaining unseen pool is short, so this baseline is smaller than the standard recommendation."
          : "Questions are spread across specification areas and selected without using retake results.",
        "The newest pristine full paper is held back where the archive offers alternatives.",
      ],
      estimatedMinutes,
      durationMinutes: esatPacedDurationMs(selected.length) / 60_000,
      strictTimed: true,
      topic: null,
      evidenceConfidence: "limited",
    });
    if (!added) return false;
    plannedBaselineModules.add(module);
    return true;
  };

  if (allowNonUrgentWork) {
    const baselineLimitBeforeSimulation = phase === "simulation" && daysRemaining !== null && daysRemaining > 2
      ? 1
      : phase === "taper"
        ? 1
        : newModules.length;
    for (const module of newModules.slice(0, baselineLimitBeforeSimulation)) addBaseline(module);
  }

  // In the simulation window, deliberately spend a pristine historical paper. Outside
  // this branch, the newest intact paper remains reserved from generated practice.
  if (allowNonUrgentWork && phase === "simulation" && daysRemaining !== null && daysRemaining > 2) {
    const simulationCandidates = papers
      .filter((candidate) => candidate.pristine && candidate.questions.every((question) => !usedIds.has(question.id)))
      .map((candidate) => {
        const moduleEvidence = evidence[candidate.set.module];
        const targetAccuracy = targetAccuracyForScaledScore(state.targets[candidate.set.module]);
        const weakness = moduleEvidence.strictFreshAccuracy === null
          ? 0.5
          : clamp((targetAccuracy - moduleEvidence.strictFreshAccuracy) / Math.max(targetAccuracy, 0.35), 0, 1);
        const staleness = moduleEvidence.lastStrictAt === null
          ? 1
          : clamp((safeNow - moduleEvidence.lastStrictAt) / (21 * DAY_MS), 0, 1);
        return {
          ...candidate,
          priority: 0.7 * weakness + 0.3 * staleness,
          alreadyPlanned: plannedBaselineModules.has(candidate.set.module),
        };
      })
      .sort((left, right) => (
        Number(left.alreadyPlanned) - Number(right.alreadyPlanned)
        || right.priority - left.priority
        || right.set.year - left.set.year
        || compareModule(left.set.module, right.set.module)
        || left.set.sourceExam.localeCompare(right.set.sourceExam)
      ));
    const exact = simulationCandidates.find((candidate) => Math.ceil(candidate.set.durationMs / 60_000) <= minutesRemaining());
    if (exact) {
      const module = exact.set.module;
      addSession({
        id: nextId("simulation", module, `${exact.set.sourceExam}-${exact.set.year}`),
        kind: "simulation",
        module,
        mode: "historic",
        questionIds: exact.questions.map((question) => question.id),
        title: `${MODULE_LABELS[module]} paper simulation`,
        summary: `Sit ${exact.set.label} in its printed order at the exact ESAT-equivalent pace.`,
        rationale: [
          "The exam is close enough for fresh timed transfer to be more valuable than another generated set.",
          evidence[module].strictFreshAccuracy === null
            ? "This module has no reliable fresh timed baseline yet."
            : `${MODULE_LABELS[module]} is prioritised from its target gap and time since the last strict attempt.`,
          "This paper was pristine before today’s plan was generated.",
        ],
        estimatedMinutes: Math.ceil(exact.set.durationMs / 60_000),
        durationMinutes: exact.set.durationMs / 60_000,
        strictTimed: true,
        topic: null,
        evidenceConfidence: evidenceConfidence(evidence[module].strictFreshCount),
        source: { exam: exact.set.sourceExam, year: exact.set.year, label: exact.set.label },
      });
    }
  }

  if (allowNonUrgentWork && phase === "simulation") {
    for (const module of newModules) {
      if (plannedBaselineModules.has(module)) continue;
      addBaseline(module);
    }
  }

  if (allowNonUrgentWork) {
    const chosenFocusModules = new Set<ModuleId>();
    while (minutesRemaining() >= 2) {
      const candidates: FocusCandidate[] = MODULE_ORDER
        .filter((module) => (
          evidence[module].strictFreshCount >= BASELINE_RESPONSE_COUNT
          && !chosenFocusModules.has(module)
        ))
        .flatMap<FocusCandidate>((module) => {
          const moduleQuestions = archive.filter((question) => question.targetModule === module);
          const topicCandidates = evidence[module].topics
            .map((topic) => ({
              evidence: topic,
              unseen: moduleQuestions.filter((question) => (
                question.esatTopic === topic.topic
                && !isSeen(state.progress[question.id])
                && !usedIds.has(question.id)
              )),
            }))
            .filter((candidate) => candidate.unseen.length > 0);
          const focus = topicCandidates
            .filter((candidate) => candidate.evidence.reliableWeakness)
            .sort((left, right) => (
              right.evidence.priority - left.evidence.priority
              || left.evidence.topic.localeCompare(right.evidence.topic)
            ))[0];
          if (focus) return [{ module, kind: "focus", topic: focus.evidence, priority: focus.evidence.priority }];
          const coverage = topicCandidates
            .sort((left, right) => (
              right.evidence.coverageNeed - left.evidence.coverageNeed
              || left.evidence.topic.localeCompare(right.evidence.topic)
            ))[0];
          return coverage
            ? [{ module, kind: "coverage", topic: coverage.evidence, priority: coverage.evidence.coverageNeed }]
            : [];
        })
        .sort((left, right) => (
          Number(right.kind === "focus") - Number(left.kind === "focus")
          || right.priority - left.priority
          || (evidence[left.module].lastStrictAt ?? -1) - (evidence[right.module].lastStrictAt ?? -1)
          || compareModule(left.module, right.module)
          || left.topic.topic.localeCompare(right.topic.topic)
        ));
      const candidate = candidates[0];
      if (!candidate) break;
      const maximum = phase === "taper" ? 8 : MAX_SESSION_QUESTIONS;
      const capacity = Math.min(maximum, questionCapacityForMinutes(minutesRemaining()));
      if (capacity <= 0) break;
      const moduleQuestions = archive.filter((question) => question.targetModule === candidate.module);
      const selected = candidate.kind === "focus"
        ? focusedUnseen(
          moduleQuestions.filter((question) => question.esatTopic === candidate.topic.topic),
          capacity,
          state,
          usedIds,
          reservedIds[candidate.module],
          `${dayKey}|focus|${candidate.module}|${candidate.topic.topic}`,
        )
        : balancedUnseen(
          moduleQuestions,
          capacity,
          state,
          usedIds,
          reservedIds[candidate.module],
          `${dayKey}|coverage|${candidate.module}`,
        );
      if (!selected.length) {
        chosenFocusModules.add(candidate.module);
        continue;
      }
      const selectedTopics = [...new Set(selected.map((question) => question.esatTopic))];
      const topic = candidate.kind === "focus" ? candidate.topic.topic : selectedTopics.length === 1 ? selectedTopics[0] : null;
      const estimatedMinutes = estimatedMinutesForQuestions(selected.length);
      addSession({
        id: nextId(candidate.kind, candidate.module, topic ?? "mixed-specification"),
        kind: candidate.kind,
        module: candidate.module,
        mode: "practice",
        questionIds: selected.map((question) => question.id),
        title: candidate.kind === "focus"
          ? `Strengthen ${candidate.topic.topic}`
          : `Expand ${MODULE_LABELS[candidate.module]} coverage`,
        summary: candidate.kind === "focus"
          ? `${selected.length} unseen question${selected.length === 1 ? "" : "s"} will test whether the first-attempt gap transfers to fresh material.`
          : `${selected.length} unseen question${selected.length === 1 ? "" : "s"} will broaden specification coverage without using retakes as readiness evidence.`,
        rationale: candidate.kind === "focus"
          ? [
            `${candidate.topic.correctCount}/${candidate.topic.resultCount} first attempts were correct in ${candidate.topic.topic}.`,
            `The recommendation is based on ${candidate.topic.resultCount} independent first exposures; repeated answers are excluded.`,
            "The newest pristine full paper remains held back where alternatives exist.",
          ]
          : [
            `${candidate.topic.topic} has ${candidate.topic.seenCount}/${Math.min(8, candidate.topic.approvedCount)} first exposures toward its balanced coverage target.`,
            "There is not yet enough reliable evidence to label a topic weakness, so the plan prioritises information gain.",
            "The newest pristine full paper remains held back where alternatives exist.",
          ],
        estimatedMinutes,
        durationMinutes: esatPacedDurationMs(selected.length) / 60_000,
        strictTimed: false,
        topic,
        evidenceConfidence: evidenceConfidence(evidence[candidate.module].strictFreshCount),
      });
      chosenFocusModules.add(candidate.module);
    }
  }

  if (allowNonUrgentWork && minutesRemaining() >= 2 && maintenanceDue.length) {
    const maintenanceCapacity = Math.min(MAX_SESSION_QUESTIONS, questionCapacityForMinutes(minutesRemaining()));
    const selectedMaintenance = maintenanceDue.filter((item) => !usedIds.has(item.question.id)).slice(0, maintenanceCapacity);
    const groups = new Map<string, DueQuestion[]>();
    for (const item of selectedMaintenance) {
      const key = `${item.question.targetModule}|${item.question.questionBankVersion}`;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    for (const group of [...groups.values()].sort((left, right) => compareDue(left[0], right[0]))) {
      const module = group[0].question.targetModule;
      addSession({
        id: nextId("maintenance", module, "mastered"),
        kind: "maintenance",
        module,
        mode: "retry",
        questionIds: group.map((item) => item.question.id),
        title: `Mastery maintenance · ${MODULE_LABELS[module]}`,
        summary: `Refresh ${group.length} previously mastered question${group.length === 1 ? "" : "s"} without treating the result as new readiness evidence.`,
        rationale: [
          "These items have reached mastery but are due on their longer maintenance interval.",
          "Unresolved retrieval, baselines and fresh work take precedence.",
        ],
        estimatedMinutes: estimatedMinutesForQuestions(group.length),
        durationMinutes: null,
        strictTimed: false,
        topic: null,
        evidenceConfidence: evidenceConfidence(evidence[module].strictFreshCount),
      });
    }
  }

  const totals = planTotals(sessions);
  if (!sessions.length) {
    return {
      ...common,
      status: "unavailable",
      sessions: [],
      totalQuestions: 0,
      totalEstimatedMinutes: 0,
      headline: "No eligible session is available",
      summary: archive.length
        ? "The current constraints leave no unseen or due questions that can be scheduled safely."
        : "The approved archive is unavailable or contains no eligible questions.",
      rationale: [
        phase === "date-needed" ? "Set a future exam date to restore phase-aware recommendations." : `${phaseLabel(phase)} rules are active.`,
        due.unavailableCount
          ? `${due.unavailableCount} unavailable due ${due.unavailableCount === 1 ? "item refers" : "items refer"} to question data that is no longer in the bank.`
          : "No unresolved retrieval is currently actionable.",
      ],
    };
  }

  const first = sessions[0];
  const headline = first.kind === "retrieval"
    ? "Start with scheduled retrieval"
    : first.kind === "baseline"
      ? "Build evidence before personalising"
      : first.kind === "simulation"
        ? "Convert preparation into exam evidence"
        : first.kind === "focus"
          ? `Strengthen ${first.topic ?? MODULE_LABELS[first.module]}`
          : "Follow today’s evidence-led plan";
  const remainingSummary = `${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${totals.questions} question${totals.questions === 1 ? "" : "s"} · about ${totals.minutes} minutes remaining.`;
  const summary = completedToday.sessionCount
    ? `${completedToday.sessionCount} session${completedToday.sessionCount === 1 ? "" : "s"} completed today · ${remainingSummary}`
    : remainingSummary;
  const scheduledRetrievalCount = sessions
    .filter((session) => session.kind === "retrieval")
    .reduce((total, session) => total + session.questionIds.length, 0);
  const rationale = [
    daysRemaining === null
      ? "Set a future exam date to unlock phase-aware pacing."
      : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remain; ${phaseLabel(phase).toLowerCase()} priorities are active.`,
    unresolvedDue.length
      ? `${scheduledRetrievalCount} of ${unresolvedDue.length} unresolved due item${unresolvedDue.length === 1 ? " is" : "s are"} scheduled first.`
      : "No unresolved retrieval is due, so the plan can add fresh evidence.",
    confidence === "starting"
      ? "Personalisation is intentionally limited until strict first-exposure baselines exist."
      : confidence === "developing"
        ? "Some module-level evidence is reliable; lower-sample areas remain coverage-led."
        : "Every module has enough strict first-exposure evidence for module-level personalisation.",
  ];

  return {
    ...common,
    status: "ready",
    sessions,
    totalQuestions: totals.questions,
    totalEstimatedMinutes: totals.minutes,
    headline,
    summary,
    rationale,
  };
}
