/**
 * Derived study insights: what kinds of mistake a candidate actually makes, and how
 * consistently they work.
 *
 * Both derivations are deliberately kept out of the readiness signal. An error tag is a
 * self-reported diagnosis, not a measurement, and studying every day is a habit rather
 * than evidence of attainment. They answer "what should I change?", which the raw marks
 * and the score estimate cannot.
 */

import {
  MODULE_ORDER,
  localDayKey,
  localDayOffset,
  localDaySerial,
  localDayStart,
  type Attempt,
  type ModuleId,
  type Question,
  type ResponseRecord,
} from "./core";

/* ------------------------------------------------------------------ error tags -- */

export type ErrorTagTrend = "rising" | "falling" | "steady" | "new" | "insufficient data";

export interface ErrorTagRow {
  tag: string;
  /** Responses this tag was applied to. */
  count: number;
  /** Share of all tagged responses that carry this tag, 0-1. Rows can overlap. */
  share: number;
  /** How many tagged responses came from each module. */
  modules: Record<ModuleId, number>;
  /** The specification topics this tag shows up in most, strongest first. */
  topTopics: Array<{ topic: string; count: number }>;
  lastTaggedAt: number | null;
  trend: ErrorTagTrend;
}

export interface ErrorTagSummary {
  rows: ErrorTagRow[];
  /** Missed questions carrying at least one tag. */
  taggedResponses: number;
  /** Missed questions with no diagnosis recorded yet. */
  untaggedResponses: number;
  /** Total tag applications; a single mistake can have several causes. */
  totalApplications: number;
  /** The single most frequent tag, or null when nothing is tagged. */
  leading: ErrorTagRow | null;
}

/**
 * A trend needs enough tagged mistakes for the split halves to mean anything. Below this
 * the honest answer is that there is not yet a pattern, not a direction.
 */
const MIN_TAGGED_FOR_TREND = 8;
const TREND_SENSITIVITY = 0.05;
const MAX_TOPICS_PER_TAG = 3;

function emptyModuleCounts(): Record<ModuleId, number> {
  return Object.fromEntries(MODULE_ORDER.map((module) => [module, 0])) as Record<ModuleId, number>;
}

/** A response counts as a mistake when it was marked and not correct. */
function isMistake(response: ResponseRecord): boolean {
  return response.correct === false || response.unanswered;
}

interface TaggedMistake {
  tags: string[];
  at: number;
  module: ModuleId | null;
  topic: string | null;
}

export function errorTagSummary(
  attempts: Attempt[],
  questionMap: Record<string, Question>,
): ErrorTagSummary {
  const tagged: TaggedMistake[] = [];
  let untaggedResponses = 0;

  for (const attempt of attempts) {
    if (attempt.rawScore === null) continue;
    const at = attempt.endedAt ?? attempt.startedAt;
    for (const response of Object.values(attempt.responses)) {
      if (!isMistake(response)) continue;
      // A corrupted record could repeat a tag; a cause applies to a mistake once.
      const tags = [...new Set(response.errorClassifications ?? [])].filter((tag) => typeof tag === "string" && tag);
      if (!tags.length) {
        untaggedResponses += 1;
        continue;
      }
      const question = questionMap[response.questionId];
      tagged.push({
        tags,
        at,
        module: question?.targetModule ?? null,
        topic: question?.esatTopic || null,
      });
    }
  }

  // The split point is the median tagged mistake, so each half holds the same number of
  // diagnoses regardless of how bursty the study pattern was.
  const times = tagged.map((item) => item.at).sort((left, right) => left - right);
  const trendable = tagged.length >= MIN_TAGGED_FOR_TREND;
  const splitAt = trendable ? times[Math.floor(times.length / 2)] : Number.POSITIVE_INFINITY;
  const recentTotal = tagged.filter((item) => item.at >= splitAt).length;
  const earlierTotal = tagged.length - recentTotal;

  interface Accumulator {
    count: number;
    recent: number;
    earlier: number;
    modules: Record<ModuleId, number>;
    topics: Map<string, number>;
    lastTaggedAt: number | null;
  }
  const byTag = new Map<string, Accumulator>();
  for (const item of tagged) {
    for (const tag of item.tags) {
      const row = byTag.get(tag) ?? {
        count: 0,
        recent: 0,
        earlier: 0,
        modules: emptyModuleCounts(),
        topics: new Map<string, number>(),
        lastTaggedAt: null,
      };
      row.count += 1;
      if (item.at >= splitAt) row.recent += 1;
      else row.earlier += 1;
      if (item.module) row.modules[item.module] += 1;
      if (item.topic) row.topics.set(item.topic, (row.topics.get(item.topic) ?? 0) + 1);
      row.lastTaggedAt = Math.max(row.lastTaggedAt ?? 0, item.at);
      byTag.set(tag, row);
    }
  }

  const trendFor = (row: Accumulator): ErrorTagTrend => {
    if (!trendable || !recentTotal || !earlierTotal) return "insufficient data";
    if (!row.earlier) return "new";
    const recentShare = row.recent / recentTotal;
    const earlierShare = row.earlier / earlierTotal;
    if (recentShare > earlierShare + TREND_SENSITIVITY) return "rising";
    if (recentShare < earlierShare - TREND_SENSITIVITY) return "falling";
    return "steady";
  };

  const rows: ErrorTagRow[] = [...byTag.entries()]
    .map(([tag, row]) => ({
      tag,
      count: row.count,
      share: tagged.length ? row.count / tagged.length : 0,
      modules: row.modules,
      topTopics: [...row.topics.entries()]
        .map(([topic, count]) => ({ topic, count }))
        .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic))
        .slice(0, MAX_TOPICS_PER_TAG),
      lastTaggedAt: row.lastTaggedAt,
      trend: trendFor(row),
    }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));

  return {
    rows,
    taggedResponses: tagged.length,
    untaggedResponses,
    totalApplications: rows.reduce((total, row) => total + row.count, 0),
    leading: rows[0] ?? null,
  };
}

/* ------------------------------------------------------------ study consistency -- */

export type StudyLevel = 0 | 1 | 2 | 3 | 4;

export interface StudyDay {
  dayKey: string;
  dayStart: number;
  studyMs: number;
  sessions: number;
  questions: number;
  level: StudyLevel;
}

export interface StudyWeek {
  key: string;
  /** Set on the first week of a month, for the heatmap's column labels. */
  monthLabel: string | null;
  /** Seven entries, Monday first. `null` is a day outside the tracked range. */
  days: Array<StudyDay | null>;
}

export interface StudyActivity {
  weeks: StudyWeek[];
  /** Consecutive active days ending today, or yesterday if today is not yet worked. */
  currentStreak: number;
  /** Whether today itself is already recorded, so the interface can say so. */
  studiedToday: boolean;
  /** Longest run across the whole recorded history, not just the rendered window. */
  longestStreak: number;
  /** Active days across the whole recorded history. */
  activeDays: number;
  /** Active days inside the rendered window. */
  activeDaysInWindow: number;
  totalStudyMs: number;
  busiestDay: StudyDay | null;
  windowDays: number;
}

/**
 * Fixed thresholds rather than quantiles of the candidate's own history: a scale that
 * rescales itself makes a light week look identical to a heavy one, which is the one
 * thing a consistency chart must not do.
 */
const LEVEL_THRESHOLD_MINUTES = [1, 15, 30, 60];

function levelForMinutes(minutes: number): StudyLevel {
  if (minutes < LEVEL_THRESHOLD_MINUTES[0]) return 0;
  if (minutes < LEVEL_THRESHOLD_MINUTES[1]) return 1;
  if (minutes < LEVEL_THRESHOLD_MINUTES[2]) return 2;
  if (minutes < LEVEL_THRESHOLD_MINUTES[3]) return 3;
  return 4;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface DayTotals {
  studyMs: number;
  sessions: number;
  questions: number;
}

/** Monday-first weekday index (Monday 0 … Sunday 6). */
function mondayIndex(timestamp: number): number {
  return (new Date(timestamp).getDay() + 6) % 7;
}

export function studyActivity(attempts: Attempt[], now: number, windowWeeks = 26): StudyActivity {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const todaySerial = localDaySerial(safeNow);
  const totals = new Map<number, DayTotals>();

  for (const attempt of attempts) {
    // Only finished, positively-timed work counts; an abandoned record is not study.
    if (attempt.rawScore === null) continue;
    const endedAt = attempt.endedAt;
    const durationMs = attempt.durationMs ?? 0;
    if (!Number.isFinite(endedAt) || endedAt === null || !Number.isFinite(durationMs) || durationMs <= 0) continue;
    // A clock skewed into the future must not invent a streak day.
    if (endedAt > safeNow) continue;
    const serial = localDaySerial(endedAt);
    const day = totals.get(serial) ?? { studyMs: 0, sessions: 0, questions: 0 };
    day.studyMs += durationMs;
    day.sessions += 1;
    day.questions += attempt.questionIds.length;
    totals.set(serial, day);
  }

  const activeSerials = [...totals.keys()].sort((left, right) => left - right);

  // A streak survives until a whole day is missed, so today being unworked does not
  // break a run that was alive yesterday.
  const studiedToday = totals.has(todaySerial);
  let currentStreak = 0;
  const streakAnchor = studiedToday ? todaySerial : totals.has(todaySerial - 1) ? todaySerial - 1 : null;
  if (streakAnchor !== null) {
    for (let serial = streakAnchor; totals.has(serial); serial -= 1) currentStreak += 1;
  }

  let longestStreak = 0;
  let run = 0;
  for (let index = 0; index < activeSerials.length; index += 1) {
    run = index > 0 && activeSerials[index] === activeSerials[index - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  const windowDays = Math.max(7, Math.round(windowWeeks) * 7);
  // Align the window to a Monday so every heatmap column is a whole week.
  const todayStart = localDayStart(safeNow);
  const firstCandidate = localDayOffset(todayStart, -(windowDays - 1));
  const windowStart = localDayOffset(firstCandidate, -mondayIndex(firstCandidate));
  const windowStartSerial = localDaySerial(windowStart);
  const columnCount = Math.ceil((todaySerial - windowStartSerial + 1) / 7);

  const dayFor = (serial: number, dayStart: number): StudyDay => {
    const day = totals.get(serial) ?? { studyMs: 0, sessions: 0, questions: 0 };
    return {
      dayKey: localDayKey(dayStart),
      dayStart,
      studyMs: day.studyMs,
      sessions: day.sessions,
      questions: day.questions,
      level: levelForMinutes(day.studyMs / 60_000),
    };
  };

  const weeks: StudyWeek[] = [];
  let previousMonth = -1;
  let activeDaysInWindow = 0;
  let busiestDay: StudyDay | null = null;
  for (let column = 0; column < columnCount; column += 1) {
    const days: Array<StudyDay | null> = [];
    let monthLabel: string | null = null;
    for (let row = 0; row < 7; row += 1) {
      const dayStart = localDayOffset(windowStart, column * 7 + row);
      const serial = localDaySerial(dayStart);
      if (serial > todaySerial) {
        days.push(null);
        continue;
      }
      const day = dayFor(serial, dayStart);
      days.push(day);
      if (day.studyMs > 0) activeDaysInWindow += 1;
      if (!busiestDay || day.studyMs > busiestDay.studyMs) busiestDay = day;
      if (row === 0) {
        const month = new Date(dayStart).getMonth();
        if (month !== previousMonth) {
          monthLabel = MONTH_LABELS[month];
          previousMonth = month;
        }
      }
    }
    weeks.push({ key: localDayKey(localDayOffset(windowStart, column * 7)), monthLabel, days });
  }

  return {
    weeks,
    currentStreak,
    studiedToday,
    longestStreak,
    activeDays: activeSerials.length,
    activeDaysInWindow,
    totalStudyMs: [...totals.values()].reduce((total, day) => total + day.studyMs, 0),
    busiestDay: busiestDay && busiestDay.studyMs > 0 ? busiestDay : null,
    windowDays: columnCount * 7,
  };
}

