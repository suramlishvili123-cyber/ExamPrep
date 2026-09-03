/**
 * ESAT score estimation, built on published UAT-UK data.
 *
 * Two separate things happen here, and they have very different evidential status:
 *
 *  1. Raw percentage -> estimated scaled score. UAT-UK does NOT publish raw-to-scaled
 *     tables; every live form is equated with a Rasch item-response model, so this step
 *     is an explicit, stated modelling assumption. See `estimatedScaledScore`.
 *
 *  2. Scaled score -> standing in the cohort. This is NOT modelled. It is read off the
 *     official score distributions published by UAT-UK in "Engineering and Science
 *     Admissions Test (ESAT) Explanation of Results", one histogram per module. See
 *     ESAT_SCORE_DISTRIBUTIONS.
 *
 * Published facts used (UAT-UK, Explanation of Results, October 2025 and January 2026):
 *   - "Results for the ESAT are reported on a scale that runs from 1.0 (low) to 9.0
 *      (high), with scores being reported to one decimal place."
 *   - "The scale has been designed so that typical candidates will score around 4.5."
 *   - "Approximately 10% of candidates will achieve scores higher than 7.0."
 *   - "Low scores are capped at 1.0 and high scores are capped at 9.0."
 *
 * ## Every completed session is scored
 *
 * An estimate is produced for anything that was finished, because a candidate working
 * through a past paper wants to know roughly where they stand, and withholding the number
 * does not leave them better informed. What varies is how far it can be trusted, and that
 * is carried explicitly rather than implied: `confidence` separates a representative,
 * fresh, strictly timed sitting from everything else, `range` states the sampling error a
 * short set carries, and `label` says in words why a particular result is only indicative.
 * The readiness doctrine is unchanged — `eligible` still means exactly what it did, and the
 * study plan and the progress trend still count only those sittings.
 */

import { scoreEstimateEligibility } from "./core";
import type { Attempt, ModuleId, Question, ResponseRecord, ScoreEstimateEligibilityReason } from "./core";

export type { ScoreEstimateEligibilityReason } from "./core";

/**
 * What a candidate who knows nothing scores by answering everything at random.
 *
 * Measured over the 517 published archive questions this application serves, whose option
 * counts run from 4 to 8 and are mostly 6 and 8: the mean of 1/options is 0.160. It is not
 * a guess — it is a property of the papers themselves, and it is where the scale has to
 * start, because a mark at chance is evidence of no knowledge rather than of a little.
 */
export const CHANCE_RATE = 0.16;

export const SCORE_MODEL = {
  version: "esat-atlas-estimate-v3",
  scaleMin: 1,
  scaleMax: 9,
  typicalScore: 4.5,
  chanceRate: CHANCE_RATE,
  distributionSitting: "October 2025 and January 2026",
  source: "UAT-UK, Engineering and Science Admissions Test (ESAT) Explanation of Results, October 2025 and January 2026",
  sourceUrl: "https://esat-tmua.ac.uk/test-results/",
  publishedFacts: [
    "Scores run from 1.0 to 9.0 and are reported to one decimal place",
    "Typical candidates score around 4.5",
    "Approximately 10% of candidates score higher than 7.0",
    "Low scores are capped at 1.0 and high scores are capped at 9.0",
  ],
  assumption: "Answering half of an ESAT-difficulty module correctly is treated as the typical candidate's performance, and four fifths of it as the published top-decile mark. Between and beyond those anchors the scale is modelled on the log-odds of the share actually known, which is the shape a Rasch-equated test implies. UAT-UK publishes no raw-to-scaled table, so this step is an estimate.",
  noCutOff: "Cambridge states there is no pass or fail for the ESAT, and Imperial states there are no grade boundaries or pass marks.",
} as const;

/**
 * Official score distributions, one entry per reported half-point, for the October 2025
 * and January 2026 sittings combined.
 *
 * Taken from the histograms in the UAT-UK results document by measuring the plotted bars
 * rather than reading them by eye, and normalised so each module sums to 100 per cent.
 * Every module's median falls in the 4.0-4.5 bin and its mean between 4.26 and 4.57, which
 * is the published "typical candidates will score around 4.5" reproduced from the data.
 */
export const ESAT_SCORE_DISTRIBUTIONS: Record<ModuleId, Array<{ score: number; percent: number }>> = {
  maths1: [
    { score: 1.0, percent: 0.4 }, { score: 1.5, percent: 0.6 }, { score: 2.0, percent: 2.2 },
    { score: 2.5, percent: 3.5 }, { score: 3.0, percent: 11.3 }, { score: 3.5, percent: 11.8 },
    { score: 4.0, percent: 15.4 }, { score: 4.5, percent: 17.2 }, { score: 5.0, percent: 10.2 },
    { score: 5.5, percent: 8.7 }, { score: 6.0, percent: 5.5 }, { score: 6.5, percent: 4.9 },
    { score: 7.0, percent: 2.8 }, { score: 7.5, percent: 2.0 }, { score: 8.0, percent: 0.4 },
    { score: 8.5, percent: 1.5 }, { score: 9.0, percent: 1.6 },
  ],
  physics: [
    { score: 1.0, percent: 3.7 }, { score: 1.5, percent: 2.6 }, { score: 2.0, percent: 5.6 },
    { score: 2.5, percent: 7.5 }, { score: 3.0, percent: 7.7 }, { score: 3.5, percent: 13.0 },
    { score: 4.0, percent: 11.3 }, { score: 4.5, percent: 13.0 }, { score: 5.0, percent: 8.1 },
    { score: 5.5, percent: 10.4 }, { score: 6.0, percent: 5.0 }, { score: 6.5, percent: 4.3 },
    { score: 7.0, percent: 3.4 }, { score: 7.5, percent: 0.6 }, { score: 8.0, percent: 1.9 },
    { score: 8.5, percent: 0.2 }, { score: 9.0, percent: 1.7 },
  ],
  maths2: [
    { score: 1.0, percent: 2.1 }, { score: 1.5, percent: 2.2 }, { score: 2.0, percent: 3.4 },
    { score: 2.5, percent: 5.4 }, { score: 3.0, percent: 10.5 }, { score: 3.5, percent: 13.3 },
    { score: 4.0, percent: 14.7 }, { score: 4.5, percent: 9.9 }, { score: 5.0, percent: 12.5 },
    { score: 5.5, percent: 7.3 }, { score: 6.0, percent: 7.1 }, { score: 6.5, percent: 3.5 },
    { score: 7.0, percent: 2.7 }, { score: 7.5, percent: 1.1 }, { score: 8.0, percent: 1.6 },
    { score: 8.5, percent: 0.4 }, { score: 9.0, percent: 2.3 },
  ],
};

/**
 * Cambridge Engineering context. There is no threshold: these are where candidates
 * actually sat, published through Freedom of Information requests, and Cambridge
 * assesses the ESAT alongside the whole application.
 */
export const CAMBRIDGE_CONTEXT = {
  note: "Cambridge: \"There is no pass or fail for ESAT. You should aim to do the best you can.\"",
  offerHolderAverage: 6.1,
  offerHolderSource: "Peterhouse, Cambridge (Engineering) FOI response, 2025 cycle: offer holders averaged about 6.1; all applicants averaged Mathematics 1 5.1, Physics 4.8, Mathematics 2 5.0",
  applicantAverages: { maths1: 5.1, physics: 4.8, maths2: 5.0 },
} as const;

/**
 * The two anchors the raw-to-scaled step is pinned to. Both come from the published
 * description of the scale rather than from anything inferred, and they are the only
 * numbers in this step that came from outside the model.
 */
export const PUBLISHED_ANCHORS = [
  { percentCorrect: 50, scaledScore: 4.5 },
  { percentCorrect: 80, scaledScore: 7.0 },
] as const;

/** The share of a paper a candidate actually knew, with the guessing floor taken out. */
export function knownShare(accuracy: number): number {
  return Math.min(1, Math.max(0, (accuracy - CHANCE_RATE) / (1 - CHANCE_RATE)));
}

/**
 * Scaled score as a straight line in the log-odds of the share known.
 *
 * A Rasch-equated test reports an ability, and the proportion of items a given ability gets
 * right is logistic in that ability — so the inverse, which is what has to be computed
 * here, is a line in the log-odds rather than in the proportion itself. Working in log-odds
 * also produces the two caps without having to impose them: the reported scale runs out at
 * 1.0 and 9.0 while the ability behind it does not, which is why the published histograms
 * have a pile of candidates sitting on each end.
 *
 * The gradient and intercept are solved from the two published anchors.
 */
const LOG_ODDS_LINE = (() => {
  const [lower, upper] = PUBLISHED_ANCHORS;
  const logOdds = (percent: number) => {
    const share = Math.min(1 - 1e-9, Math.max(1e-9, knownShare(percent / 100)));
    return Math.log(share / (1 - share));
  };
  const gradient = (upper.scaledScore - lower.scaledScore)
    / (logOdds(upper.percentCorrect) - logOdds(lower.percentCorrect));
  return { gradient, intercept: lower.scaledScore - gradient * logOdds(lower.percentCorrect) };
})();

/** Estimated scaled score for a proportion correct, to the one decimal place reported. */
export function estimatedScaledScore(accuracy: number): number {
  const share = knownShare(accuracy);
  if (share <= 0) return SCORE_MODEL.scaleMin;
  if (share >= 1) return SCORE_MODEL.scaleMax;
  const raw = LOG_ODDS_LINE.intercept + LOG_ODDS_LINE.gradient * Math.log(share / (1 - share));
  return Math.round(Math.min(SCORE_MODEL.scaleMax, Math.max(SCORE_MODEL.scaleMin, raw)) * 10) / 10;
}

/** The proportion correct, 0-1, at which the scale reaches a given score. */
export function accuracyForScaledScore(scaledScore: number): number {
  const bounded = Math.min(SCORE_MODEL.scaleMax, Math.max(SCORE_MODEL.scaleMin, scaledScore));
  const share = 1 / (1 + Math.exp(-(bounded - LOG_ODDS_LINE.intercept) / LOG_ODDS_LINE.gradient));
  return Math.min(1, Math.max(0, CHANCE_RATE + share * (1 - CHANCE_RATE)));
}

/**
 * The curve as a table, for showing a candidate what a mark is worth and for reading the
 * scale backwards. Derived from the model above rather than written out beside it, so the
 * two cannot drift apart. It spans the range that is actually reported: below the first row
 * every mark is capped at 1.0, and above the last every mark is capped at 9.0.
 */
export const SCORE_CURVE: Array<{ percentCorrect: number; scaledScore: number }> = (() => {
  const round = (value: number) => Math.round(value * 10) / 10;
  const floor = round(accuracyForScaledScore(SCORE_MODEL.scaleMin) * 100);
  const ceiling = round(accuracyForScaledScore(SCORE_MODEL.scaleMax) * 100);
  const percents = [floor];
  for (let percent = Math.ceil((floor + 1) / 5) * 5; percent < ceiling - 1; percent += 5) percents.push(percent);
  percents.push(ceiling);
  return percents.map((percentCorrect) => ({
    percentCorrect,
    scaledScore: estimatedScaledScore(percentCorrect / 100),
  }));
})();

export type ScoreTone = "bad" | "warn" | "neutral" | "good";

/**
 * How far a number can be trusted.
 *
 * `calibrated` is a representative, fully fresh, strictly timed module: the sample the
 * cohort comparison was designed for. `indicative` is everything else that was finished —
 * a practice set, an untimed paper, a short topic drill, a repeat. Both carry a scaled
 * score, because a candidate is entitled to know roughly where a piece of work puts them;
 * only the first is treated as readiness evidence anywhere in the application.
 */
export type ScoreConfidence = "calibrated" | "indicative";

export interface ScoreEstimate {
  rawScore: number;
  questionCount: number;
  /** Proportion correct, 0-1. */
  accuracy: number;
  /** Estimated ESAT scaled score, 1.0-9.0 to one decimal place. */
  scaledScore: number;
  /**
   * The scores a mark this size is consistent with, given how few questions it rests on.
   *
   * One standard error of the proportion correct either way, mapped through the same
   * curve. Ten questions and twenty-seven questions can produce the same percentage and
   * mean very different things, and this is the difference stated rather than buried.
   */
  range: { low: number; high: number };
  /** Share of candidates estimated to score below this, 0-100. */
  percentile: number;
  /** Share of candidates estimated to score at or above this, 0-100. */
  topPercent: number;
  /** Human-readable standing, e.g. "top 10%". */
  standing: string;
  band: string;
  tone: ScoreTone;
  /** Which module's published distribution was used, if any. */
  distributionModule: ModuleId | null;
}

export interface AttemptScoreReport {
  /** Always present for a finished session; null only while one is still open. */
  estimate: ScoreEstimate | null;
  accuracy: number;
  /** True only for a representative, fresh, strictly timed module. */
  eligible: boolean;
  confidence: ScoreConfidence;
  reason: ScoreEstimateEligibilityReason;
  label: string;
  /** Why this particular result is only indicative, or null when it is not. */
  caveat: string | null;
}

const ELIGIBILITY_LABELS: Record<ScoreEstimateEligibilityReason, string> = {
  eligible: "Representative fresh strict set",
  incomplete: "Complete the session to see a result",
  retrieval: "Retrieval session — indicative only",
  practice: "Practice session — indicative only",
  original: "Challenge mock — indicative only",
  "not-strict": "Untimed session — indicative only",
  "too-short": "Short set — indicative only",
  repeated: "Repeated material — indicative only",
};

/**
 * Why a result is not readiness evidence, in the candidate's own terms.
 *
 * Each of these is a real reason the number would flatter or understate a live sitting, so
 * it is said plainly beside the estimate rather than used as grounds for hiding it.
 */
const INDICATIVE_CAVEATS: Record<ScoreEstimateEligibilityReason, string | null> = {
  eligible: null,
  incomplete: "This session has not been submitted yet.",
  retrieval: "Retrieval sessions revisit material you have already seen, so they run ahead of what a first sitting would give you.",
  practice: "Practice sessions are not sat under exam conditions, so treat this as a rough position rather than a forecast.",
  original: "The challenge mock is deliberately harder than a live form and is not calibrated to one, so this reads low.",
  "not-strict": "This was untimed, and the ESAT allows 40 minutes for 27 questions. Time pressure costs marks that this result does not show.",
  "too-short": "Too few questions to be reliable: the range beside this score is how much a set this size can swing.",
  repeated: "Some of these questions had been seen before, so this runs ahead of what fresh material would give you.",
};

/**
 * The result of a finished session, always with a scaled score attached.
 *
 * The score is produced for every completed attempt, because the question a candidate
 * actually has is "roughly where am I?" and a blank space answers it worse than a number
 * with its limits stated. What the eligibility rule decides is not whether to show a
 * figure but what weight it carries: `eligible` still means a representative, fresh,
 * strictly timed module and is still the only thing the study plan and the progress trend
 * will count, while everything else comes back marked indicative with the reason attached.
 */
export function scoreReportForAttempt(attempt: Attempt): AttemptScoreReport {
  const count = Math.max(0, attempt.questionIds.length);
  const raw = Math.max(0, Math.min(count, attempt.rawScore ?? 0));
  const reason = scoreEstimateEligibility(attempt);
  const eligible = reason === "eligible";
  // A session still in progress has no mark to scale; everything finished does.
  const finished = reason !== "incomplete";
  return {
    estimate: finished ? scoreEstimate(raw, count, attempt.module) : null,
    accuracy: count ? raw / count : 0,
    eligible,
    confidence: eligible ? "calibrated" : "indicative",
    reason,
    label: ELIGIBILITY_LABELS[reason],
    caveat: INDICATIVE_CAVEATS[reason],
  };
}

const BIN_HALF_WIDTH = 0.25;

/**
 * Share of candidates scoring below `scaledScore`, read from a published distribution.
 * Each reported half-point is treated as a bin spanning +/- 0.25, and a score inside a
 * bin takes a proportional share of it.
 */
export function scaledScorePercentile(scaledScore: number, module: ModuleId | null = null): number {
  const bins = module ? ESAT_SCORE_DISTRIBUTIONS[module] : averagedDistribution();
  let below = 0;
  for (const bin of bins) {
    const binStart = bin.score - BIN_HALF_WIDTH;
    const binEnd = bin.score + BIN_HALF_WIDTH;
    if (scaledScore >= binEnd) below += bin.percent;
    else if (scaledScore > binStart) below += bin.percent * ((scaledScore - binStart) / (BIN_HALF_WIDTH * 2));
  }
  return Math.min(99.9, Math.max(0.1, below));
}

let averagedCache: Array<{ score: number; percent: number }> | null = null;

/** The mean of the three Engineering module distributions, for mixed or unknown sets. */
function averagedDistribution(): Array<{ score: number; percent: number }> {
  if (averagedCache) return averagedCache;
  const modules: ModuleId[] = ["maths1", "physics", "maths2"];
  averagedCache = ESAT_SCORE_DISTRIBUTIONS.maths1.map((bin, index) => ({
    score: bin.score,
    percent: modules.reduce((sum, module) => sum + ESAT_SCORE_DISTRIBUTIONS[module][index].percent, 0) / modules.length,
  }));
  return averagedCache;
}

/** 1st, 2nd, 3rd, 4th … 22nd, 23rd. */
export function ordinal(value: number): string {
  const rounded = Math.round(value);
  const lastTwo = rounded % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rounded}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rounded % 10] ?? "th";
  return `${rounded}${suffix}`;
}

/**
 * "Top n%" only ever describes the upper half. Below the typical candidate it would be
 * misleading, so the plain percentile is reported instead.
 */
function standingLabel(topPercent: number, percentile: number): string {
  const rounded = Math.round(topPercent * 10) / 10;
  if (rounded <= 1) return "top 1%";
  if (rounded <= 2) return "top 2%";
  if (rounded <= 5) return "top 5%";
  if (rounded <= 10) return "top 10%";
  if (rounded <= 20) return "top 20%";
  if (rounded <= 33) return "top third";
  if (rounded <= 50) return "upper half";
  return `${ordinal(percentile)} percentile`;
}

function bandFor(scaledScore: number): { band: string; tone: ScoreTone } {
  if (scaledScore >= 8) return { band: "Exceptional", tone: "good" };
  if (scaledScore >= 7) return { band: "Very strong", tone: "good" };
  if (scaledScore >= 6) return { band: "Strong", tone: "good" };
  if (scaledScore >= 5) return { band: "Above typical", tone: "neutral" };
  if (scaledScore >= 4) return { band: "Around typical", tone: "warn" };
  return { band: "Developing", tone: "bad" };
}

/**
 * How much a mark of this size could have been luck, as a scaled-score range.
 *
 * The standard error of a proportion over `count` questions, mapped through the same curve
 * as the score itself. Twelve out of twenty-four and six out of twelve are the same
 * percentage and are not the same evidence, and this is where that difference is said. One
 * standard error rather than two: a 95% interval on a short set spans most of the scale,
 * which is true but tells a candidate nothing they can use.
 */
export function scoreRange(accuracy: number, questionCount: number): { low: number; high: number } {
  const count = Math.max(1, questionCount);
  const error = Math.sqrt(Math.max(0, accuracy * (1 - accuracy)) / count);
  return {
    low: estimatedScaledScore(accuracy - error),
    high: estimatedScaledScore(accuracy + error),
  };
}

export function scoreEstimate(rawScore: number, questionCount: number, module: ModuleId | null = null): ScoreEstimate {
  const safeCount = Math.max(1, questionCount);
  const accuracy = Math.min(1, Math.max(0, rawScore / safeCount));
  const scaledScore = estimatedScaledScore(accuracy);
  const percentile = scaledScorePercentile(scaledScore, module);
  const topPercent = Math.max(0.1, 100 - percentile);
  const { band, tone } = bandFor(scaledScore);
  return {
    rawScore,
    questionCount: safeCount,
    accuracy,
    scaledScore,
    range: scoreRange(accuracy, safeCount),
    percentile,
    topPercent,
    standing: standingLabel(topPercent, percentile),
    band,
    tone,
    distributionModule: module,
  };
}

/** Combined estimate across several modules, e.g. a full three-module mock. */
export function combinedScoreEstimate(parts: Array<{ rawScore: number; questionCount: number }>): ScoreEstimate | null {
  if (!parts.length) return null;
  return scoreEstimate(
    parts.reduce((sum, part) => sum + part.rawScore, 0),
    parts.reduce((sum, part) => sum + part.questionCount, 0),
  );
}

/** How this score sits against published Cambridge Engineering offer-holder context. */
export function cambridgeContextFor(scaledScore: number): { tone: ScoreTone; message: string } {
  const gap = Math.round((scaledScore - CAMBRIDGE_CONTEXT.offerHolderAverage) * 10) / 10;
  if (gap >= 0.5) return { tone: "good", message: `Comfortably above the ~${CAMBRIDGE_CONTEXT.offerHolderAverage} average of recent Cambridge Engineering offer holders. There is no cut-off, and the ESAT is read alongside the rest of the application.` };
  if (gap >= -0.3) return { tone: "neutral", message: `Around the ~${CAMBRIDGE_CONTEXT.offerHolderAverage} average of recent Cambridge Engineering offer holders. There is no cut-off, and the ESAT is read alongside the rest of the application.` };
  if (gap >= -1.2) return { tone: "warn", message: `Below the ~${CAMBRIDGE_CONTEXT.offerHolderAverage} average of recent offer holders, but within reach: that average sits only about ${Math.abs(gap).toFixed(1)} above this result.` };
  return { tone: "bad", message: `Well below the ~${CAMBRIDGE_CONTEXT.offerHolderAverage} average of recent offer holders. Treat this as a starting baseline rather than a forecast.` };
}

export interface SectionRow {
  key: string;
  label: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
  averageMs: number;
  tone: ScoreTone;
  verdict: string;
}

function sectionVerdict(total: number, accuracy: number): { tone: ScoreTone; verdict: string } {
  if (total < 3) return { tone: "neutral", verdict: "Too few items" };
  if (accuracy >= 0.85) return { tone: "good", verdict: "Secure" };
  if (accuracy >= 0.65) return { tone: "neutral", verdict: "Solid" };
  if (accuracy >= 0.45) return { tone: "warn", verdict: "Shaky" };
  return { tone: "bad", verdict: "Priority" };
}

/**
 * Group responses into sections. `keyOf` decides what a section means - the topic for a
 * single module, or the module itself when several modules are reviewed together.
 */
export function sectionBreakdown(
  responses: ResponseRecord[],
  questionMap: Record<string, Question>,
  keyOf: (question: Question) => string = (question) => question.esatTopic,
): SectionRow[] {
  const rows = new Map<string, SectionRow>();
  for (const response of responses) {
    const question = questionMap[response.questionId];
    if (!question) continue;
    const key = keyOf(question) || "Unclassified";
    const row = rows.get(key) ?? {
      key, label: key, total: 0, correct: 0, incorrect: 0, unanswered: 0,
      accuracy: 0, averageMs: 0, tone: "neutral" as ScoreTone, verdict: "",
    };
    row.total += 1;
    if (response.correct) row.correct += 1;
    else if (response.unanswered) row.unanswered += 1;
    else row.incorrect += 1;
    row.averageMs += response.timeSpentMs;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row) => {
      const accuracy = row.total ? row.correct / row.total : 0;
      const { tone, verdict } = sectionVerdict(row.total, accuracy);
      return { ...row, accuracy, averageMs: row.total ? row.averageMs / row.total : 0, tone, verdict };
    })
    .sort((left, right) => left.accuracy - right.accuracy || right.total - left.total);
}

export interface PacingSummary {
  targetMsPerQuestion: number;
  actualMsPerQuestion: number;
  overtimeQuestions: number;
  rushedIncorrect: number;
  slowIncorrect: number;
  verdict: string;
}

export function pacingSummary(
  responses: ResponseRecord[],
  questionCount: number,
  totalDurationMs: number,
): PacingSummary {
  const targetMsPerQuestion = questionCount ? (40 * 60_000) / 27 : 0;
  const actualMsPerQuestion = questionCount ? totalDurationMs / questionCount : 0;
  const overtimeQuestions = responses.filter((response) => response.timeSpentMs > targetMsPerQuestion * 1.5).length;
  // A blank is not a wrong answer; counting it as one would double-report the same mark.
  const incorrect = responses.filter((response) => response.correct === false && !response.unanswered);
  const rushedIncorrect = incorrect.filter((response) => response.timeSpentMs < targetMsPerQuestion * 0.6).length;
  const slowIncorrect = incorrect.filter((response) => response.timeSpentMs > targetMsPerQuestion * 1.5).length;
  let verdict = "Pacing is close to the ESAT reference of 89 seconds per question.";
  if (actualMsPerQuestion > targetMsPerQuestion * 1.15) verdict = "Slower than the ESAT reference; practise recognising when to move on.";
  else if (actualMsPerQuestion < targetMsPerQuestion * 0.7 && incorrect.length > responses.length * 0.25) verdict = "Fast but inaccurate; the marks lost outweigh the time saved.";
  else if (actualMsPerQuestion < targetMsPerQuestion * 0.7) verdict = "Comfortably ahead of the ESAT reference pace.";
  return { targetMsPerQuestion, actualMsPerQuestion, overtimeQuestions, rushedIncorrect, slowIncorrect, verdict };
}
