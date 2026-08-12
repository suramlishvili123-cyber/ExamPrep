/**
 * ESAT score estimation, built on published UAT-UK data.
 *
 * Two separate things happen here, and they have very different evidential status:
 *
 *  1. Raw percentage -> estimated scaled score. UAT-UK does NOT publish raw-to-scaled
 *     tables; every live form is equated with a Rasch item-response model, so this step
 *     is an explicit, stated modelling assumption. See SCORE_CURVE.
 *
 *  2. Scaled score -> standing in the cohort. This is NOT modelled. It reads directly
 *     off the official October 2025 score distributions published by UAT-UK in
 *     "Engineering and Science Admissions Test (ESAT) Explanation of Results", one
 *     histogram per module. See ESAT_SCORE_DISTRIBUTIONS.
 *
 * Published facts used (UAT-UK, Explanation of Results, October 2025):
 *   - "Results for the ESAT are reported on a scale that runs from 1.0 (low) to 9.0
 *      (high), with scores being reported to one decimal place."
 *   - "The scale has been designed so that typical candidates will score around 4.5."
 *   - "Approximately 10% of candidates will achieve scores higher than 7.0."
 *   - "Low scores are capped at 1.0 and high scores are capped at 9.0."
 */

import type { ModuleId, Question, ResponseRecord } from "./core";

export const SCORE_MODEL = {
  version: "esat-atlas-estimate-v2",
  scaleMin: 1,
  scaleMax: 9,
  typicalScore: 4.5,
  distributionSitting: "October 2025",
  source: "UAT-UK, Engineering and Science Admissions Test (ESAT) Explanation of Results, October 2025",
  sourceUrl: "https://esat-tmua.ac.uk/test-results/",
  publishedFacts: [
    "Scores run from 1.0 to 9.0 and are reported to one decimal place",
    "Typical candidates score around 4.5",
    "Approximately 10% of candidates score higher than 7.0",
  ],
  assumption: "Answering half of an ESAT-difficulty module correctly is treated as the typical candidate's performance. UAT-UK publishes no raw-to-scaled table, so this step is an estimate.",
  noCutOff: "Cambridge states there is no pass or fail for the ESAT, and Imperial states there are no grade boundaries or pass marks.",
} as const;

/**
 * Official October 2025 score distributions, one entry per reported half-point, read
 * from the histograms in the UAT-UK results document. Percentages are of all candidates
 * sitting that module and each list sums to 100.
 */
export const ESAT_SCORE_DISTRIBUTIONS: Record<ModuleId, Array<{ score: number; percent: number }>> = {
  maths1: [
    { score: 1.0, percent: 0.4 }, { score: 1.5, percent: 0.8 }, { score: 2.0, percent: 2.2 },
    { score: 2.5, percent: 3.3 }, { score: 3.0, percent: 11.5 }, { score: 3.5, percent: 10.1 },
    { score: 4.0, percent: 14.0 }, { score: 4.5, percent: 14.2 }, { score: 5.0, percent: 10.4 },
    { score: 5.5, percent: 9.5 }, { score: 6.0, percent: 6.8 }, { score: 6.5, percent: 5.8 },
    { score: 7.0, percent: 3.6 }, { score: 7.5, percent: 2.7 }, { score: 8.0, percent: 0.3 },
    { score: 8.5, percent: 2.1 }, { score: 9.0, percent: 2.3 },
  ],
  physics: [
    { score: 1.0, percent: 2.7 }, { score: 1.5, percent: 1.9 }, { score: 2.0, percent: 2.6 },
    { score: 2.5, percent: 7.3 }, { score: 3.0, percent: 5.6 }, { score: 3.5, percent: 11.3 },
    { score: 4.0, percent: 12.3 }, { score: 4.5, percent: 13.6 }, { score: 5.0, percent: 8.4 },
    { score: 5.5, percent: 12.6 }, { score: 6.0, percent: 6.2 }, { score: 6.5, percent: 5.4 },
    { score: 7.0, percent: 4.4 }, { score: 7.5, percent: 0.5 }, { score: 8.0, percent: 2.7 },
    { score: 8.5, percent: 0.2 }, { score: 9.0, percent: 2.3 },
  ],
  maths2: [
    { score: 1.0, percent: 1.1 }, { score: 1.5, percent: 1.4 }, { score: 2.0, percent: 2.6 },
    { score: 2.5, percent: 4.7 }, { score: 3.0, percent: 7.2 }, { score: 3.5, percent: 12.5 },
    { score: 4.0, percent: 15.3 }, { score: 4.5, percent: 7.5 }, { score: 5.0, percent: 14.6 },
    { score: 5.5, percent: 8.4 }, { score: 6.0, percent: 8.9 }, { score: 6.5, percent: 4.5 },
    { score: 7.0, percent: 3.8 }, { score: 7.5, percent: 1.3 }, { score: 8.0, percent: 2.3 },
    { score: 8.5, percent: 0.5 }, { score: 9.0, percent: 3.4 },
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
 * Raw percentage correct -> estimated scaled score. Monotone and piecewise linear.
 * Pinned to the two published anchors (50% -> 4.5 typical, 80% -> 7.0 top decile) and
 * consistent with published third-party estimates for the 20-question NSAA/ENGAA
 * predecessors, which put 4.5 at roughly 11-16/27 and 7.0 at roughly 18-24/27 once
 * rescaled to a 27-question module. Deliberately conservative at the top: this curve
 * only reaches 9.0 at full marks, whereas the live cap is reached earlier.
 */
export const SCORE_CURVE: Array<{ percentCorrect: number; scaledScore: number }> = [
  { percentCorrect: 0, scaledScore: 1.0 },
  { percentCorrect: 15, scaledScore: 2.0 },
  { percentCorrect: 28, scaledScore: 3.0 },
  { percentCorrect: 39, scaledScore: 4.0 },
  { percentCorrect: 50, scaledScore: 4.5 },
  { percentCorrect: 58, scaledScore: 5.0 },
  { percentCorrect: 65, scaledScore: 5.5 },
  { percentCorrect: 72, scaledScore: 6.1 },
  { percentCorrect: 80, scaledScore: 7.0 },
  { percentCorrect: 87, scaledScore: 7.8 },
  { percentCorrect: 94, scaledScore: 8.5 },
  { percentCorrect: 100, scaledScore: 9.0 },
];

export type ScoreTone = "bad" | "warn" | "neutral" | "good";

export interface ScoreEstimate {
  rawScore: number;
  questionCount: number;
  /** Proportion correct, 0-1. */
  accuracy: number;
  /** Estimated ESAT scaled score, 1.0-9.0 to one decimal place. */
  scaledScore: number;
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

export function estimatedScaledScore(accuracy: number): number {
  const percent = Math.min(100, Math.max(0, accuracy * 100));
  for (let index = 1; index < SCORE_CURVE.length; index += 1) {
    const lower = SCORE_CURVE[index - 1];
    const upper = SCORE_CURVE[index];
    if (percent <= upper.percentCorrect) {
      const span = upper.percentCorrect - lower.percentCorrect;
      const weight = span === 0 ? 0 : (percent - lower.percentCorrect) / span;
      return Math.round((lower.scaledScore + weight * (upper.scaledScore - lower.scaledScore)) * 10) / 10;
    }
  }
  return SCORE_MODEL.scaleMax;
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
