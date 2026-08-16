"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  Filter,
  Flag,
  Gauge,
  Home,
  LibraryBig,
  Lightbulb,
  LogOut,
  Maximize2,
  Menu,
  Moon,
  NotebookPen,
  Pause,
  PencilRuler,
  Play,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Timer,
  TrendingUp,
  TriangleAlert,
  UserRound,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MODULE_LABELS,
  MODULE_ORDER,
  STORAGE_KEY,
  applyCompletedAttempt,
  attemptPaperKey,
  chooseQuestions,
  createAttempt,
  defaultState,
  eligibleQuestions,
  esatPacedDurationMs,
  finalizeAttempt,
  isAttemptExpired,
  isReadinessEvidence,
  formatDuration,
  formatLongDuration,
  formatSeconds,
  listPaperSets,
  listTopics,
  mergeState,
  moduleStats,
  paperQuestions,
  remainingMs,
  settleCurrentVisit,
  storageKeyForUser,
  touchSyncSection,
  MAX_QUESTION_ZOOM,
  MIN_QUESTION_ZOOM,
  type Attempt,
  type AttemptMode,
  type BankPayload,
  type MistakeItem,
  type ModuleId,
  type MockPayload,
  type PaperSet,
  type Question,
  type ResponseRecord,
  type Settings,
  type StoredState,
} from "./lib/core";
import {
  CAMBRIDGE_CONTEXT,
  ESAT_SCORE_DISTRIBUTIONS,
  SCORE_CURVE,
  SCORE_MODEL,
  cambridgeContextFor,
  combinedScoreEstimate,
  pacingSummary,
  scoreReportForAttempt,
  scoreEstimate,
  sectionBreakdown,
  type AttemptScoreReport,
  type ScoreEstimate,
  type SectionRow,
} from "./lib/scoring";
import {
  buildAdaptiveStudyPlan,
  type AdaptiveStudyPlan,
  type StudyPlanSession,
} from "./lib/study-plan";
import { persistStoredState, type PersistResult } from "./lib/persistence";
import {
  errorTagSummary,
  studyActivity,
  type ErrorTagRow,
  type StudyActivity,
  type StudyDay,
} from "./lib/insights";
import {
  EXAM_TACTICS,
  TECHNIQUE_GUIDES,
  techniqueForQuestion,
  type TechniqueGuide,
} from "./lib/learning";
import { MathText } from "./math-text";
import { publicAsset } from "./lib/assets";
import { mathToPlainText } from "./lib/math-markup";
import {
  BOARD_WIDTH,
  decodePage,
  encodePage,
  pageIsEmpty,
  type ScratchPage,
  type ScratchTool,
} from "./lib/scratch";
import {
  AnnotationToolbar,
  EMPTY_ANNOTATION_STATUS,
  QuestionAnnotator,
  ScratchpadPreview,
  type AnnotationStatus,
  type AnnotatorHandle,
  type ScratchPreferences,
} from "./scratchpad";
import {
  ConnectionStatus,
  OfflinePanel,
  UpdateBanner,
  useOfflineRuntime,
  type OfflineRuntime,
  type SyncState,
} from "./offline";
import {
  deleteAccountAndData,
  deleteActiveAttemptCloud,
  deleteAttemptCloud,
  deleteScratchPagesCloud,
  deleteUserStateCloud,
  firebaseConfigured,
  loadActiveAttemptCloud,
  loadScratchPagesCloud,
  loadUserStateCloud,
  observeUser,
  saveActiveAttemptCloud,
  saveAttemptOutcomeCloud,
  saveScratchPageCloud,
  saveUserProfileCloud,
  saveUserStateCloud,
  signInWithGoogle,
  signOutUser,
} from "./lib/firebase";

type ViewId = "dashboard" | "plan" | "practice" | "tricks" | "originals" | "analytics" | "mistakes" | "papers" | "settings";
type QuestionFilter = "all" | "unseen" | "incorrect" | "due";
type HistoryFilter = "all" | "paper" | "original" | "strict" | "practice" | "retrieval";
type AttemptKind = "paper" | "original" | "strict" | "practice" | "retrieval";

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Overview", icon: Home },
  { id: "plan", label: "Study plan", icon: CalendarCheck2 },
  { id: "practice", label: "Practice", icon: BookOpen },
  { id: "tricks", label: "Quick tricks", icon: Zap },
  { id: "originals", label: "Original mocks", icon: Sparkles },
  { id: "papers", label: "Paper history", icon: LibraryBig },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "mistakes", label: "Mistakes", icon: Brain },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const VIEW_IDS = NAV_ITEMS.map((item) => item.id);

const ERROR_TAGS = [
  "Concept gap",
  "Formula recall",
  "Algebra",
  "Arithmetic",
  "Misread question",
  "Units",
  "Sign / direction",
  "Graph interpretation",
  "Diagram interpretation",
  "Time pressure",
  "Careless error",
  "Guess",
  "Strategy / approach",
  "Other",
];

const CAMBRIDGE_BENCHMARKS = [
  { cohort: "Home applicants", maths1: 4.25, physics: 4.32, maths2: 4.24 },
  { cohort: "Home offer holders", maths1: 5.67, physics: 5.85, maths2: 5.67 },
  { cohort: "International applicants", maths1: 5.51, physics: 5.19, maths2: 5.38 },
  { cohort: "International offer holders", maths1: 7.41, physics: 7.2, maths2: 7.21 },
];

function mergeAttempts(remote: Attempt[] = [], local: Attempt[] = []): Attempt[] {
  const attempts = new Map<string, Attempt>();
  for (const attempt of [...remote, ...local]) {
    const current = attempts.get(attempt.attemptId);
    const attemptTime = attempt.endedAt ?? attempt.startedAt;
    const currentTime = current ? current.endedAt ?? current.startedAt : -1;
    if (!current || attemptTime >= currentTime) attempts.set(attempt.attemptId, attempt);
  }
  return [...attempts.values()].sort(
    (left, right) => (right.endedAt ?? right.startedAt) - (left.endedAt ?? left.startedAt),
  );
}

function mergeCloudState(local: StoredState, remoteValue: Partial<StoredState>): StoredState {
  const remote = mergeState(remoteValue);
  const progress = { ...remote.progress };
  for (const [questionId, localProgress] of Object.entries(local.progress)) {
    const cloudProgress = progress[questionId];
    if (!cloudProgress || (localProgress.lastAttemptedAt ?? 0) >= (cloudProgress.lastAttemptedAt ?? 0)) {
      progress[questionId] = localProgress;
    }
  }
  const mistakes = { ...remote.mistakes };
  for (const [questionId, localMistake] of Object.entries(local.mistakes)) {
    const localProgressTime = local.progress[questionId]?.lastAttemptedAt ?? 0;
    const remoteProgressTime = remote.progress[questionId]?.lastAttemptedAt ?? 0;
    if (!mistakes[questionId] || localProgressTime >= remoteProgressTime) mistakes[questionId] = localMistake;
  }
  const section = <T,>(name: "settings" | "targets" | "notes", localValue: T, remoteValueForSection: T): T =>
    local.syncMetadata[name] > remote.syncMetadata[name] ? localValue : remoteValueForSection;
  return mergeState({
    ...local,
    attempts: mergeAttempts(remote.attempts, local.attempts),
    progress,
    mistakes,
    targets: section("targets", local.targets, remote.targets),
    settings: section("settings", local.settings, remote.settings),
    notes: section("notes", local.notes, remote.notes),
    syncMetadata: {
      settings: Math.max(local.syncMetadata.settings, remote.syncMetadata.settings),
      targets: Math.max(local.syncMetadata.targets, remote.syncMetadata.targets),
      notes: Math.max(local.syncMetadata.notes, remote.syncMetadata.notes),
    },
  });
}

function authMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "auth/unauthorized-domain") return "This production address is not yet authorised in Firebase. Add it under Authentication → Settings → Authorized domains, then try again.";
  if (code === "auth/operation-not-allowed") return "Google sign-in is not enabled for this Firebase project yet.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled. Your progress has not been changed.";
  if (code === "auth/network-request-failed") return "Firebase could not be reached. Check your connection and try again.";
  return error instanceof Error ? error.message : "Google sign-in did not complete.";
}

function sourceLabel(question: Question | undefined): string {
  if (!question) return "Question unavailable";
  if (question.authored) return `Original · ${question.sourcePaper} · Q${question.originalQuestionNumber}`;
  const section = question.sourceExam === "ENGAA" ? "Part B" : question.sourceExam === "TMUA" ? "Paper 1" : question.sourcePart === "E" ? "Part E" : "Section 1";
  return `${question.sourceExam} ${question.year} · ${section} · Q${question.originalQuestionNumber}`;
}

function sourceLabelForAttempt(question: Question | undefined, attempt: Attempt): string {
  if (!question) return "Question unavailable";
  const requestedExam = attempt.mode === "historic" ? attempt.sourceExams?.[0] : null;
  const alternate = requestedExam && requestedExam !== question.sourceExam
    ? question.alternateSources?.find((source) => source.sourceExam === requestedExam)
    : null;
  if (!alternate) return sourceLabel(question);
  return `${alternate.sourceExam} ${question.year} · Part ${alternate.sourcePart} · Q${alternate.originalQuestionNumber} · retained equivalent`;
}

function attemptKind(attempt: Attempt): AttemptKind {
  if (attempt.mode === "retry") return "retrieval";
  if (attempt.mode === "historic") return "paper";
  if (attempt.mode === "original") return "original";
  if (attempt.strictTimed) return "strict";
  return "practice";
}

const KIND_LABELS: Record<AttemptKind, string> = {
  paper: "Past paper",
  original: "Original mock",
  strict: "Strict module",
  practice: "Practice",
  retrieval: "Retrieval",
};

function attemptTitle(attempt: Attempt): string {
  if (attempt.mode === "historic") return attempt.sourceSetLabel || "Archive paper";
  if (attempt.planSessionTitle) return attempt.planSessionTitle;
  if (attempt.mode === "original") return "Challenge Mock A";
  if (attempt.strictTimed) return "Strict 27-question module";
  if (attempt.mode === "retry") return "Targeted retry";
  return "Custom practice set";
}

function percent(value: number | null): string {
  return value === null ? "Not enough data" : `${Math.round(value * 100)}%`;
}

/** Proportion correct, 0-1. A zero-length record must not yield NaN. */
function attemptAccuracy(attempt: Attempt): number {
  const total = attempt.questionIds.length;
  return total ? (attempt.rawScore ?? 0) / total : 0;
}

/** Bar height/width for an attempt's accuracy. */
function attemptAccuracyPercent(attempt: Attempt): number {
  return attemptAccuracy(attempt) * 100;
}

/**
 * The most recent comparable attempt that finished *before* this one. Selecting on
 * completion time rather than array position means a re-sorted or merged history cannot
 * make "vs last" compare against a later result.
 */
function previousComparableAttempt(attempts: Attempt[], attempt: Attempt): Attempt | null {
  const endedAt = attempt.endedAt ?? attempt.startedAt;
  return attempts.reduce<Attempt | null>((best, candidate) => {
    if (candidate.attemptId === attempt.attemptId || candidate.rawScore === null) return best;
    if (candidate.module !== attempt.module || attemptKind(candidate) !== attemptKind(attempt)) return best;
    const candidateEnd = candidate.endedAt ?? candidate.startedAt;
    if (candidateEnd >= endedAt) return best;
    return !best || candidateEnd > (best.endedAt ?? best.startedAt) ? candidate : best;
  }, null);
}

/**
 * Change against an earlier attempt, in percentage points. Papers differ in length, so
 * comparing raw marks would report progress that is really just a longer paper.
 */
function accuracyDelta(attempt: Attempt, previous: Attempt | null): number | null {
  if (!previous || previous.rawScore === null || attempt.rawScore === null) return null;
  return Math.round((attemptAccuracy(attempt) - attemptAccuracy(previous)) * 100);
}

// Constructed once: these format inside loops over attempts, log rows and 180-odd
// calendar cells, and building an Intl formatter per call is the expensive part.
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const LONG_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "—";
  return DATE_FORMAT.format(timestamp);
}

function formatDateTime(timestamp: number | null): string {
  if (!timestamp) return "—";
  return DATE_TIME_FORMAT.format(timestamp);
}

function download(filename: string, contents: string, type: string): void {
  const href = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Firefox aborts the download if the object URL is revoked in the same task.
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Activity; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={22} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

function Pill({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "blue"; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function ScoreEstimateBlock({ estimate, compact = false }: { estimate: ScoreEstimate; compact?: boolean }) {
  const cambridge = cambridgeContextFor(estimate.scaledScore);
  const offerAverage = CAMBRIDGE_CONTEXT.offerHolderAverage;
  // Position both markers on the reported 1.0-9.0 scale.
  const asPercent = (score: number) => ((Math.min(9, Math.max(1, score)) - 1) / 8) * 100;
  return (
    <div className={compact ? "score-estimate score-estimate-compact" : "score-estimate"}>
      <div className="score-estimate-value">
        <strong>{estimate.scaledScore.toFixed(1)}</strong>
        <span>estimated ESAT score</span>
      </div>
      <div className="score-estimate-meta">
        <Pill tone={estimate.tone}>{estimate.band}</Pill>
        <span>Approximately the <strong>{estimate.standing}</strong> of candidates</span>
      </div>
      {!compact ? (
        <>
          <div className="score-scale" role="img" aria-label={`${estimate.scaledScore.toFixed(1)} on the 1.0 to 9.0 ESAT scale; typical candidate ${SCORE_MODEL.typicalScore}; recent Cambridge Engineering offer holders averaged ${offerAverage}`}>
            <i className="score-scale-track">
              <b style={{ width: `${asPercent(estimate.scaledScore)}%` }} />
            </i>
            <span className="score-scale-marker score-scale-typical" style={{ left: `${asPercent(SCORE_MODEL.typicalScore)}%` }}><em>{SCORE_MODEL.typicalScore}</em>typical</span>
            <span className="score-scale-marker score-scale-offer" style={{ left: `${asPercent(offerAverage)}%` }}><em>{offerAverage}</em>offer holders</span>
          </div>
          <p className={`score-estimate-cambridge tone-${cambridge.tone}`}>{cambridge.message}</p>
          <p className="score-estimate-note">
            If this proxy scaled score matched a live result, the official {SCORE_MODEL.distributionSitting} distribution would place it around this standing.
            The raw-to-scaled step is modelled because UAT-UK does not publish a conversion table and live forms are Rasch-equated per sitting.
          </p>
        </>
      ) : null}
    </div>
  );
}

export function ScoreEvidenceNotice({ report }: { report: AttemptScoreReport }) {
  const detail = report.reason === "retrieval"
    ? "This session measures recall on material you have already seen. It updates mastery and scheduling, but cannot estimate exam standing."
    : report.reason === "original"
      ? "The challenge mock is intentionally harder and is not calibrated to a live ESAT form, so its exact raw mark is the honest result."
      : report.reason === "too-short"
        ? "A cohort comparison needs at least 18 fresh questions under strict timing. One or a few correct answers are not enough to infer a 1.0–9.0 score."
        : report.reason === "repeated"
          ? "Some questions were previously seen. Use this result to measure learning; only a fully fresh set can contribute a cohort estimate."
          : "This activity is useful practice, but its conditions are not representative enough for a cohort estimate.";
  return (
    <div className="score-evidence-notice" role="note">
      <ShieldCheck size={19} />
      <div><strong>{report.label}</strong><span>{detail}</span></div>
    </div>
  );
}

/**
 * An authored figure supplements the stem instead of replacing it, so unlike questionImage
 * it renders alongside the question text. The alt text carries every value the figure
 * shows, because for a learner who cannot see it that text is the only way to answer.
 */
function QuestionFigure({ question }: { question: Question | undefined }) {
  if (!question?.questionDiagram) return null;
  return (
    <figure className="question-figure">
      <img
        src={publicAsset(question.questionDiagram)}
        alt={question.questionDiagramAlt || `Figure for question ${question.originalQuestionNumber}`}
        loading="lazy"
      />
    </figure>
  );
}

function SectionTable({ rows, caption }: { rows: SectionRow[]; caption?: string }) {
  if (!rows.length) return null;
  return (
    <div className="section-table">
      {caption ? <p className="section-table-caption">{caption}</p> : null}
      <div className="section-row header-row">
        <span>Section</span><span>Marks</span><span>Accuracy</span><span>Average pace</span><span>Standing</span>
      </div>
      {rows.map((row) => (
        <div className="section-row" key={row.key}>
          <strong>{row.label}</strong>
          <span>{row.correct}/{row.total}</span>
          <span className="section-bar">
            <i><b className={`bar-${row.tone}`} style={{ width: `${Math.round(row.accuracy * 100)}%` }} /></i>
            <em>{Math.round(row.accuracy * 100)}%</em>
          </span>
          <span>{formatDuration(row.averageMs)}</span>
          <Pill tone={row.tone}>{row.verdict}</Pill>
        </div>
      ))}
    </div>
  );
}

function LoginScreen({ busy, error, online, onSignIn }: { busy: boolean; error: string | null; online: boolean; onSignIn: () => void }) {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="brand-mark">EA</span>
          <div><strong>ESAT Atlas</strong><small>Cambridge Engineering preparation</small></div>
        </div>
        <div className="auth-story-copy">
          <span className="auth-kicker"><ShieldCheck size={14} /> Private, focused preparation</span>
          <h1>Your complete ESAT workspace, on every device.</h1>
          <p>Sit real past papers by year, train with the validated archive, take high-difficulty original mocks, and turn every result into a clear revision plan.</p>
          <div className="auth-benefits">
            <div><LibraryBig size={18} /><span><strong>Past papers by year</strong><small>Sit any archived paper end to end, at exam pace.</small></span></div>
            <div><BarChart3 size={18} /><span><strong>Honest analysis</strong><small>Exact raw results for every attempt; estimates only for representative fresh sets.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Private cloud progress</strong><small>Firebase keeps each account&apos;s revision data separate.</small></span></div>
          </div>
        </div>
        <small className="auth-story-foot">Built for the 2026 ESAT preparation cycle</small>
      </section>
      <section className="auth-entry">
        <div className="auth-card">
          <div className="auth-card-icon"><UserRound size={22} /></div>
          <span className="eyebrow">Secure account</span>
          <h2>Sign in to ESAT Atlas</h2>
          <p>Use Google through Firebase Authentication. Your progress will load automatically and stay synced to your private account.</p>
          {!firebaseConfigured() ? <div className="auth-error"><TriangleAlert size={17} /><span>Firebase has not been configured for this deployment.</span></div> : null}
          {/* Signing in is the one thing that genuinely needs a connection: Google issues the
              token. Once signed in the session is remembered on the device and everything —
              papers, mocks, the whiteboard, the plan — works with no network at all. */}
          {!online ? (
            <div className="auth-error" role="status">
              <CloudOff size={17} />
              <span>You are offline. Signing in for the first time needs a connection; after that ESAT Atlas opens and runs offline on this device.</span>
            </div>
          ) : null}
          {error ? <div className="auth-error" role="alert"><TriangleAlert size={17} /><span>{error}</span></div> : null}
          <button className="google-button" onClick={onSignIn} disabled={busy || !firebaseConfigured() || !online}>
            <span className="google-g" aria-hidden="true">G</span>
            <span>{busy ? "Connecting securely…" : online ? "Continue with Google" : "Waiting for a connection…"}</span>
            {busy ? <i className="auth-spinner" /> : <ChevronRight size={17} />}
          </button>
          <div className="auth-trust"><ShieldCheck size={15} /><span>Authentication is handled by Google and Firebase. ESAT Atlas never receives your Google password.</span></div>
        </div>
      </section>
    </main>
  );
}

export default function EsatApp() {
  const [bank, setBank] = useState<BankPayload | null>(null);
  const [mockBank, setMockBank] = useState<MockPayload | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<ViewId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<Attempt | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [multiTabWarning, setMultiTabWarning] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const [builderModule, setBuilderModule] = useState<ModuleId>("maths1");
  const [builderCount, setBuilderCount] = useState(10);
  const [builderFilter, setBuilderFilter] = useState<QuestionFilter>("unseen");
  const [builderTiming, setBuilderTiming] = useState<"untimed" | "pace" | "module">("pace");
  const [builderTopic, setBuilderTopic] = useState<string>("");
  const [retryScope, setRetryScope] = useState<"all" | "due">("all");
  const [retryModule, setRetryModule] = useState<ModuleId>("maths1");
  const [retryTimed, setRetryTimed] = useState(false);
  const [paperModule, setPaperModule] = useState<ModuleId>("maths1");
  const [paperExam, setPaperExam] = useState<string>("NSAA");
  const [paperYear, setPaperYear] = useState<number | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  const offline = useOfflineRuntime();
  const [updateDismissed, setUpdateDismissed] = useState(false);
  /** Cloud writes that have not been acknowledged; while offline, every one of them. */
  const [pendingWrites, setPendingWrites] = useState(0);
  /**
   * The working for the session in progress, held outside React state on purpose: a stroke
   * must not re-render the exam player, and the pages are far too bulky for the bounded
   * device cache in `lib/persistence.ts`. Firestore's own IndexedDB cache is their local
   * copy, which is also what makes an offline page survive a reload.
   */
  const scratchPagesRef = useRef(new Map<string, ScratchPage>());
  const scratchAttemptRef = useRef<string | null>(null);
  const scratchDirtyRef = useRef(new Set<string>());
  const scratchTimerRef = useRef<number | null>(null);
  const [scratchLoadedFor, setScratchLoadedFor] = useState<string | null>(null);
  /** Pages of a finished attempt, loaded on demand for the review screens. */
  const [reviewScratch, setReviewScratch] = useState<{ attemptId: string; pages: Record<string, ScratchPage> } | null>(null);
  const timedOutRef = useRef(false);
  /** When the review list was opened, or null while a question is on screen. */
  const reviewOpenedAtRef = useRef<number | null>(null);
  const syncedUserRef = useRef<string | null>(null);
  const cloudSettingsReadyUserRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const activeAttemptRef = useRef<Attempt | null>(null);
  const storageWarnedRef = useRef(false);
  const compactionWarnedRef = useRef(false);
  const deepLinkReadRef = useRef(false);
  const tabIdRef = useRef("");
  const authGenerationRef = useRef(0);
  const destructiveCloudActionRef = useRef(false);
  const expiryCheckedRef = useRef(false);
  const active = state.activeAttempt;
  const activeAttemptId = active?.attemptId;
  const activeQuestionIds = active?.questionIds;
  const activeQuestionIndex = active?.currentIndex;
  const activeEndsAt = active?.endsAt ?? null;
  const activePausedAt = active?.pausedAt ?? null;
  const resultAttemptId = result?.attemptId;

  useEffect(() => {
    // The pre-account-storage schema could contain another person's revision data on a
    // shared browser. It is deliberately discarded rather than guessed/migrated.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
    fetch(publicAsset("data/question-bank.json"))
      .then((response) => {
        if (!response.ok) throw new Error("Question bank unavailable");
        return response.json() as Promise<BankPayload>;
      })
      .then(setBank)
      .catch(() => setBankError("The validated question bank could not be loaded. Check your connection and reload."));
    fetch(publicAsset("data/original-mocks.json"))
      .then((response) => {
        if (!response.ok) throw new Error("Original mocks unavailable");
        return response.json() as Promise<MockPayload>;
      })
      .then(setMockBank)
      .catch(() => setBankError("The original challenge mocks could not be loaded. Check your connection and reload."));
  }, []);

  useEffect(() => observeUser(
    (nextUser) => {
      authGenerationRef.current += 1;
      syncedUserRef.current = null;
      cloudSettingsReadyUserRef.current = null;
      expiryCheckedRef.current = false;
      setHydrated(false);
      setState(defaultState());
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) setHydrated(true);
    },
    (error) => {
      setAuthError(authMessage(error));
      setAuthReady(true);
    },
  ), []);

  useEffect(() => {
    stateRef.current = state;
    activeAttemptRef.current = state.activeAttempt;
  }, [state]);

  /**
   * Count a cloud write until it is acknowledged.
   *
   * Offline, a Firestore write is durably queued and its promise simply does not settle
   * until the connection returns — so an outstanding count is exactly "work that has not
   * reached the account yet", with no separate outbox to keep correct.
   */
  const trackWrite = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    setPendingWrites((count) => count + 1);
    return promise.finally(() => setPendingWrites((count) => Math.max(0, count - 1)));
  }, []);

  useEffect(() => {
    if (!authReady || !user || syncedUserRef.current === user.uid) return;
    const generation = authGenerationRef.current;
    let localState = defaultState();
    let localReadFailed = false;
    try {
      const stored = localStorage.getItem(storageKeyForUser(user.uid));
      localState = mergeState(stored ? (JSON.parse(stored) as Partial<StoredState>) : null);
    } catch {
      localReadFailed = true;
    }
    stateRef.current = localState;
    setState(localState);
    syncedUserRef.current = user.uid;
    setAuthBusy(true);
    Promise.all([
      loadUserStateCloud(user.uid),
      // One unreadable resumable session must not discard the whole cloud profile:
      // attempts, progress and the retrieval queue are far more valuable than an
      // autosave that can be rebuilt by starting a new session.
      loadActiveAttemptCloud(user.uid).catch(() => null),
    ])
      .then(([remoteState, remoteActiveAttempt]) => {
        if (generation !== authGenerationRef.current) return;
        const localActiveAttempt = localState.activeAttempt;
        const activeAttempt = !localActiveAttempt
          ? remoteActiveAttempt
          : !remoteActiveAttempt
            ? localActiveAttempt
            : localActiveAttempt.startedAt >= remoteActiveAttempt.startedAt
              ? localActiveAttempt
              : remoteActiveAttempt;
        const merged = { ...mergeCloudState(localState, remoteState), activeAttempt };
        stateRef.current = merged;
        setState(merged);
        setHydrated(true);
        // Deliberately not awaited. Offline, this write is queued durably by Firestore and
        // its promise does not settle until the connection returns; awaiting it would leave
        // the account menu disabled and profile syncing switched off for the whole session.
        trackWrite(saveUserStateCloud(user.uid, merged)).catch(() => undefined);
        if (activeAttempt) trackWrite(saveActiveAttemptCloud(user.uid, activeAttempt)).catch(() => undefined);
        cloudSettingsReadyUserRef.current = user.uid;
        setToast(localReadFailed
          ? "Signed in. This account's local copy was unreadable, so its private cloud copy was used."
          : navigator.onLine === false
            ? "Signed in offline. Everything stored on this device is available, and your work syncs when you reconnect."
            : "Signed in. Your private Firebase progress is up to date.");
      })
      .catch((error: unknown) => {
        syncedUserRef.current = null;
        setHydrated(true);
        setToast(error instanceof Error ? `Signed in, but cloud progress could not load: ${error.message}` : "Signed in, but cloud progress could not load.");
      })
      .finally(() => {
        if (generation === authGenerationRef.current) setAuthBusy(false);
      });
  }, [authReady, trackWrite, user]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  // Persisting the whole record is cheap but not free, so writes are coalesced and
  // flushed if the page is hidden or closed before the timer fires.
  useEffect(() => {
    if (!hydrated || !user || destructiveCloudActionRef.current) return;
    const write = () => {
      let outcome: PersistResult;
      try {
        outcome = persistStoredState(localStorage, storageKeyForUser(user.uid), stateRef.current);
      } catch {
        // Reaching `localStorage` at all can throw where storage is blocked outright.
        outcome = { stored: false, tier: 0, bytes: 0, droppedAttempts: 0, reason: "unavailable" };
      }
      if (outcome.stored && outcome.reason === "ok") return;
      // Each distinct outcome is reported once per session: repeating it on every
      // debounced save would bury the interface in identical toasts.
      if (!outcome.stored && !storageWarnedRef.current) {
        storageWarnedRef.current = true;
        setToast(outcome.reason === "quota"
          ? "This device's storage is full, so progress is being kept in your Firebase account instead. Your results are safe."
          : "This browser refused to save progress locally. Sign-in keeps your cloud copy safe.");
        return;
      }
      if (outcome.stored && !compactionWarnedRef.current) {
        compactionWarnedRef.current = true;
        setToast(outcome.droppedAttempts
          ? `This device is low on storage, so only your ${outcome.droppedAttempts === 1 ? "oldest result is" : `${outcome.droppedAttempts} oldest results are`} kept in Firebase rather than on this device. Nothing has been lost.`
          : "This device is low on storage, so fine-grained answer history is kept in Firebase rather than on this device. Nothing has been lost.");
      }
    };
    const timeout = window.setTimeout(write, 250);
    const flush = () => { if (document.visibilityState === "hidden") write(); };
    window.addEventListener("pagehide", write);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pagehide", write);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [state, hydrated, user]);

  useEffect(() => {
    if (!hydrated || !user || authBusy || cloudSettingsReadyUserRef.current !== user.uid) return;
    if (destructiveCloudActionRef.current) return;
    const timeout = window.setTimeout(() => {
      saveUserProfileCloud(user.uid, {
        settings: state.settings,
        targets: state.targets,
        notes: state.notes,
        syncMetadata: state.syncMetadata,
      }).catch(() =>
        setToast("Profile changes are safe locally; cloud sync will retry after your next session."),
      );
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [authBusy, hydrated, state.notes, state.settings, state.syncMetadata, state.targets, user]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view, activeAttemptId, resultAttemptId, reviewOpen, openAttemptId]);

  // Keep the address bar in step with the view so browser navigation works.
  useEffect(() => {
    // Read the deep link exactly once: the writer effect below rewrites the hash, and
    // a second read would then simply echo whatever it had just written.
    if (!deepLinkReadRef.current) {
      deepLinkReadRef.current = true;
      const fromHash = window.location.hash.replace(/^#\/?/, "");
      if (VIEW_IDS.includes(fromHash as ViewId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView(fromHash as ViewId);
      }
    }
    const onHashChange = () => {
      const next = window.location.hash.replace(/^#\/?/, "");
      if (!VIEW_IDS.includes(next as ViewId)) return;
      setView(next as ViewId);
      // Browser navigation must leave an open attempt breakdown, not sit behind it.
      setOpenAttemptId(null);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace(/^#\/?/, "") !== view) window.history.replaceState(null, "", `#/${view}`);
  }, [view]);

  // The clock only needs to be accurate while a countdown is on screen.
  useEffect(() => {
    const period = activeEndsAt && !activePausedAt ? 500 : 60_000;
    const interval = window.setInterval(() => setTick(Date.now()), period);
    return () => window.clearInterval(interval);
  }, [activeEndsAt, activePausedAt]);

  useEffect(() => {
    if (!user || !activeAttemptId) return;
    const interval = window.setInterval(() => {
      const attempt = activeAttemptRef.current;
      if (attempt && !destructiveCloudActionRef.current) saveActiveAttemptCloud(user.uid, attempt).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [user, activeAttemptId]);

  /* ------------------------------------------------------ whiteboard persistence -- */

  /**
   * Write every page that has changed since the last flush.
   *
   * Called on a short debounce, whenever the question changes, and when the page is hidden
   * or the session ends. Writing on every stroke would be one document write per pen
   * movement; writing only at the end would lose a session to a closed lid.
   */
  const flushScratch = useCallback(() => {
    if (scratchTimerRef.current !== null) {
      window.clearTimeout(scratchTimerRef.current);
      scratchTimerRef.current = null;
    }
    const attemptId = scratchAttemptRef.current;
    const dirty = [...scratchDirtyRef.current];
    scratchDirtyRef.current.clear();
    if (!user || !attemptId || !dirty.length || destructiveCloudActionRef.current) return;
    for (const questionId of dirty) {
      const page = scratchPagesRef.current.get(questionId);
      const empty = pageIsEmpty(page);
      trackWrite(saveScratchPageCloud(user.uid, {
        attemptId,
        questionId,
        page: empty || !page ? "" : encodePage(page),
        height: page?.height ?? 0,
        strokeCount: page?.strokes.length ?? 0,
        updatedAt: Date.now(),
      })).catch(() => setToast("Your working is safe on this device; it will sync to your account shortly."));
    }
  }, [trackWrite, user]);

  const recordScratchPage = useCallback((questionId: string, page: ScratchPage) => {
    scratchPagesRef.current.set(questionId, page);
    scratchDirtyRef.current.add(questionId);
    if (scratchTimerRef.current !== null) window.clearTimeout(scratchTimerRef.current);
    scratchTimerRef.current = window.setTimeout(flushScratch, 2_500);
  }, [flushScratch]);

  const scratchPageFor = useCallback(
    (questionId: string): ScratchPage | null => scratchPagesRef.current.get(questionId) ?? null,
    [],
  );

  // The working for a resumed session, read back before the board is shown so a candidate
  // never sees a blank page where their own writing should be.
  useEffect(() => {
    if (!user || !activeAttemptId) {
      scratchAttemptRef.current = null;
      scratchPagesRef.current = new Map();
      scratchDirtyRef.current.clear();
      // `scratchLoadedFor` is deliberately left as it was. It is only ever compared against
      // the attempt currently on screen, so a stale identifier reads as "not this one" —
      // which is the answer — without a synchronous state write from an effect.
      return;
    }
    if (scratchAttemptRef.current === activeAttemptId) return;
    let cancelled = false;
    scratchAttemptRef.current = activeAttemptId;
    scratchPagesRef.current = new Map();
    scratchDirtyRef.current.clear();
    loadScratchPagesCloud(user.uid, activeAttemptId)
      .then((records) => {
        if (cancelled) return;
        for (const [questionId, record] of Object.entries(records)) {
          scratchPagesRef.current.set(questionId, decodePage(record.page));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setScratchLoadedFor(activeAttemptId);
      });
    return () => { cancelled = true; };
  }, [user, activeAttemptId]);

  // A closed lid, a swipe away from the browser or a crash must not cost the last strokes.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushScratch(); };
    window.addEventListener("pagehide", flushScratch);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushScratch);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushScratch]);

  // Mount-scoped, so a debounce still in flight cannot fire against a signed-out account
  // after teardown. It is deliberately not tied to `flushScratch`, whose identity changes
  // with the signed-in user — cancelling on that would drop a save that is about to run.
  useEffect(() => () => {
    if (scratchTimerRef.current !== null) window.clearTimeout(scratchTimerRef.current);
  }, []);

  useEffect(() => {
    if (!activeAttemptId || typeof BroadcastChannel === "undefined") return;
    // Identifies this tab so its own broadcast is not mistaken for a competing one.
    const tabId = tabIdRef.current || (tabIdRef.current = crypto.randomUUID());
    const channel = new BroadcastChannel("esat-active-attempt");
    channel.postMessage({ type: "active", tabId, attemptId: activeAttemptId });
    channel.onmessage = (event: MessageEvent<{ type: string; tabId: string; attemptId: string }>) => {
      if (event.data.type === "active" && event.data.tabId !== tabId && event.data.attemptId === activeAttemptId) {
        setMultiTabWarning(true);
      }
    };
    return () => channel.close();
  }, [activeAttemptId]);

  const effectiveQuestions = useMemo(() => [...(bank?.questions ?? []), ...(mockBank?.questions ?? [])], [bank, mockBank]);
  const supplementalQuestionIds = useMemo(() => new Set((mockBank?.questions ?? []).map((question) => question.id)), [mockBank]);
  const questionMap = useMemo(
    () => Object.fromEntries(effectiveQuestions.map((question) => [question.id, question])),
    [effectiveQuestions],
  );
  const approvedCounts = useMemo(
    () => Object.fromEntries(MODULE_ORDER.map((module) => [module, eligibleQuestions(bank?.questions ?? [], module).length])) as Record<ModuleId, number>,
    [bank],
  );
  const paperSets = useMemo(() => listPaperSets(bank?.questions ?? []), [bank]);
  const adaptivePlan = useMemo(
    () => buildAdaptiveStudyPlan({
      archiveQuestions: bank?.questions ?? [],
      supplementalQuestions: mockBank?.questions ?? [],
      state,
      now: tick,
    }),
    [bank, mockBank, state, tick],
  );

  const finishAttempt = useCallback(
    (timedOut = false) => {
      const current = stateRef.current;
      if (!current.activeAttempt) return;
      // The current question's visit ended when the review list opened. Passing that
      // moment — rather than reading it back off state — is correct whether or not the
      // settle has committed yet, so a timer expiry mid-commit can neither double-charge
      // the question nor drop its final visit.
      const visitEndedAt = reviewOpenedAtRef.current ?? undefined;
      const finalized = finalizeAttempt(current.activeAttempt, questionMap, timedOut, Date.now(), visitEndedAt);
      const next = applyCompletedAttempt(current, finalized);
      stateRef.current = next;
      setState(next);
      setResult(finalized);
      reviewOpenedAtRef.current = null;
      setReviewOpen(false);
      timedOutRef.current = false;
      // The board's last strokes belong to this attempt and have to be written before the
      // review screen offers to show them back.
      flushScratch();
      if (user) {
        trackWrite(Promise.all([
          saveAttemptOutcomeCloud(user.uid, finalized, next),
          deleteActiveAttemptCloud(user.uid, finalized.attemptId),
        ])).catch(() =>
          setToast("Saved locally; cloud sync will be retried later."),
        );
      }
    },
    [flushScratch, questionMap, trackWrite, user],
  );

  // An attempt restored from a previous session may already have run out of time. This
  // runs once, before the live countdown below is allowed to submit anything, so a stale
  // empty session is discarded rather than recorded as a zero.
  useEffect(() => {
    if (!hydrated || !bank || !mockBank || expiryCheckedRef.current) return;
    expiryCheckedRef.current = true;
    const attempt = stateRef.current.activeAttempt;
    if (!attempt || !isAttemptExpired(attempt)) return;
    const answered = Object.values(attempt.responses).some((response) => response.selectedAnswer);
    if (answered) {
      finishAttempt(true);
      setToast("The timer on your saved session had already expired, so it was submitted with the answers you had given.");
    } else {
      setState((current) => ({ ...current, activeAttempt: null }));
      setToast("An expired empty session was discarded rather than recorded as a zero.");
    }
  }, [hydrated, bank, mockBank, finishAttempt]);

  useEffect(() => {
    if (!active || active.pausedAt || active.completionStatus !== "active" || !expiryCheckedRef.current) return;
    const timeLeft = remainingMs(active, tick);
    if (timeLeft === 0 && !timedOutRef.current) {
      timedOutRef.current = true;
      finishAttempt(true);
    }
  }, [active, tick, finishAttempt]);

  useEffect(() => {
    if (!activeQuestionIds || activeQuestionIndex === undefined) return;
    const indexes = [activeQuestionIndex - 1, activeQuestionIndex, activeQuestionIndex + 1];
    for (const index of indexes) {
      const id = activeQuestionIds[index];
      const source = id ? questionMap[id]?.questionImage : null;
      if (source) new Image().src = publicAsset(source);
    }
  }, [activeQuestionIndex, activeQuestionIds, questionMap]);

  const updateActive = useCallback((updater: (attempt: Attempt) => Attempt) => {
    setState((current) => (current.activeAttempt ? { ...current, activeAttempt: updater(current.activeAttempt) } : current));
  }, []);

  /**
   * The review list is not a question, so no question should be billed for the time spent
   * on it. Opening it ends the current visit; leaving it starts a fresh one.
   */
  const openOrCloseReview = useCallback((open: boolean) => {
    const at = Date.now();
    reviewOpenedAtRef.current = open ? at : null;
    updateActive((attempt) => {
      if (attempt.pausedAt) return attempt;
      return open ? settleCurrentVisit(attempt, at) : { ...attempt, lastVisitStartedAt: at };
    });
    setReviewOpen(open);
  }, [updateActive]);

  // Settings, targets and notes are the three independently mergeable sections. Every
  // edit has to stamp its section clock, otherwise a later sign-in cannot tell a local
  // change from a stale one and silently resolves in favour of whatever the cloud holds.
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((current) => touchSyncSection({ ...current, settings: { ...current.settings, ...patch } }, "settings"));
  }, []);

  const updateTarget = useCallback((module: ModuleId, value: number) => {
    setState((current) => touchSyncSection({ ...current, targets: { ...current.targets, [module]: value } }, "targets"));
  }, []);

  const updateNote = useCallback((questionId: string, note: string) => {
    setState((current) => touchSyncSection({ ...current, notes: { ...current.notes, [questionId]: note } }, "notes"));
  }, []);

  const selectOption = useCallback(
    (letter: string) => {
      updateActive((attempt) => {
        if (attempt.pausedAt) return attempt;
        const questionId = attempt.questionIds[attempt.currentIndex];
        const prior = attempt.responses[questionId];
        if (!prior || prior.selectedAnswer === letter) return attempt;
        return {
          ...attempt,
          responses: {
            ...attempt.responses,
            [questionId]: {
              ...prior,
              selectedAnswer: letter,
              firstSelectedAnswer: prior.firstSelectedAnswer ?? letter,
              answerChanges: [...prior.answerChanges, { from: prior.selectedAnswer, to: letter, at: Date.now() }],
              timestamps: [...prior.timestamps, Date.now()],
            },
          },
        };
      });
    },
    [updateActive],
  );

  const clearOption = useCallback(() => {
    updateActive((attempt) => {
      if (attempt.pausedAt) return attempt;
      const questionId = attempt.questionIds[attempt.currentIndex];
      const prior = attempt.responses[questionId];
      if (!prior || prior.selectedAnswer === null) return attempt;
      return {
        ...attempt,
        responses: { ...attempt.responses, [questionId]: { ...prior, selectedAnswer: null } },
      };
    });
  }, [updateActive]);

  const navigateQuestion = useCallback(
    (index: number) => {
      updateActive((attempt) => {
        if (attempt.pausedAt) return attempt;
        const settled = settleCurrentVisit(attempt);
        const safeIndex = Math.max(0, Math.min(index, settled.questionIds.length - 1));
        const nextId = settled.questionIds[safeIndex];
        if (!nextId) return settled;
        return {
          ...settled,
          currentIndex: safeIndex,
          lastVisitStartedAt: Date.now(),
          responses: {
            ...settled.responses,
            [nextId]: { ...settled.responses[nextId], visits: settled.responses[nextId].visits + (safeIndex === attempt.currentIndex ? 0 : 1) },
          },
        };
      });
      reviewOpenedAtRef.current = null;
      setReviewOpen(false);
      // Leaving a question is the natural moment to store what was written on it, rather
      // than waiting for the debounce and risking the session ending first.
      flushScratch();
    },
    [flushScratch, updateActive],
  );

  const toggleWriting = useCallback((enabled: boolean) => {
    updateSettings({ scratchpadEnabled: enabled });
  }, [updateSettings]);

  const toggleFlag = useCallback(() => {
    updateActive((attempt) => {
      if (attempt.pausedAt) return attempt;
      const id = attempt.questionIds[attempt.currentIndex];
      if (!attempt.responses[id]) return attempt;
      return { ...attempt, responses: { ...attempt.responses, [id]: { ...attempt.responses[id], flagged: !attempt.responses[id].flagged } } };
    });
  }, [updateActive]);

  useEffect(() => {
    if (!active || active.pausedAt || reviewOpen || !state.settings.keyboardShortcuts) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Buttons are deliberately not excluded. Choosing an option with the mouse leaves
      // focus on that option, and the A-H / 1-8 / arrow shortcuts have to keep working
      // afterwards. None of the keys handled below activate a focused button.
      if (target && (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const currentQuestion = questionMap[active.questionIds[active.currentIndex]];
      if (!currentQuestion) return;
      const key = event.key.toUpperCase();
      const numberIndex = Number(event.key) - 1;
      let handled = true;
      if (Number.isInteger(numberIndex) && numberIndex >= 0 && numberIndex < currentQuestion.answerOptions.length) selectOption(currentQuestion.answerOptions[numberIndex]);
      else if (currentQuestion.answerOptions.includes(key)) selectOption(key);
      else if (event.key === "ArrowLeft") navigateQuestion(active.currentIndex - 1);
      else if (event.key === "ArrowRight") navigateQuestion(active.currentIndex + 1);
      else if (event.key === "Backspace" || event.key === "Delete") clearOption();
      else if (key === "F") toggleFlag();
      else if (key === "R") openOrCloseReview(true);
      // W starts and stops writing on the question. It is never an answer letter, and it is
      // within reach of the hand that is not holding the stylus.
      else if (key === "W") toggleWriting(!state.settings.scratchpadEnabled);
      else handled = false;
      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, clearOption, navigateQuestion, openOrCloseReview, questionMap, reviewOpen, selectOption, state.settings.keyboardShortcuts, state.settings.scratchpadEnabled, toggleWriting, toggleFlag]);

  function beginQuestionList(
    pool: Question[],
    module: ModuleId,
    mode: AttemptMode,
    durationMinutes: number | null,
    strictTimed: boolean,
    originalHistoricSet = false,
    sequenceRemaining?: ModuleId[],
    sequenceSource: "archive" | "original" = "archive",
    sourceOverride?: { exam: string; year: number; label: string },
    planContext?: Pick<StudyPlanSession, "id" | "kind" | "title" | "estimatedMinutes">,
  ): void {
    const currentState = stateRef.current;
    if (currentState.activeAttempt) {
      setToast("A session is already active. Continue or submit it before starting another.");
      return;
    }
    if (!pool.length) {
      setToast("No questions matched that request.");
      return;
    }
    let attempt = createAttempt({
      questions: pool,
      module,
      mode,
      durationMinutes,
      strictTimed,
      generated: !originalHistoricSet,
      originalHistoricSet,
      progress: currentState.progress,
      sequenceRemaining,
      sequenceSource,
    });
    if (sourceOverride) {
      attempt = {
        ...attempt,
        sourceExams: [sourceOverride.exam],
        sourceYears: [sourceOverride.year],
        sourceSetLabel: sourceOverride.label,
      };
    }
    if (planContext) {
      attempt = {
        ...attempt,
        planSessionId: planContext.id,
        planSessionKind: planContext.kind,
        planSessionTitle: planContext.title,
        planSessionEstimatedMinutes: planContext.estimatedMinutes,
      };
    }
    setResult(null);
    setOpenAttemptId(null);
    setMultiTabWarning(false);
    timedOutRef.current = false;
    const nextState = { ...currentState, activeAttempt: attempt };
    stateRef.current = nextState;
    setState(nextState);
    if (user) {
      saveActiveAttemptCloud(user.uid, attempt).catch(() =>
        setToast("The session is safe on this device; its cloud autosave will retry shortly."),
      );
    }
  }

  function beginSession(args: {
    module: ModuleId;
    count: number;
    mode: AttemptMode;
    filter?: QuestionFilter;
    durationMinutes: number | null;
    strictTimed: boolean;
    requireExactCount?: boolean;
    topic?: string;
    sequenceRemaining?: ModuleId[];
  }): void {
    if (!bank) return;
    const pool = chooseQuestions(bank.questions, args.module, args.count, state.progress, args.filter ?? "all", state.mistakes, undefined, args.topic || undefined);
    if (!pool.length) {
      setToast(args.topic
        ? `No ${args.topic} questions in ${MODULE_LABELS[args.module]} match that filter yet.`
        : `No ${MODULE_LABELS[args.module]} questions match that filter yet.`);
      return;
    }
    if (pool.length < args.count) {
      if (args.requireExactCount) {
        setToast(`${MODULE_LABELS[args.module]} needs ${args.count} eligible questions for that mode; only ${pool.length} match.`);
        return;
      }
      setToast(`Starting with the ${pool.length} question${pool.length === 1 ? "" : "s"} that match this filter.`);
    }
    const duration = args.durationMinutes === null
      ? null
      : args.durationMinutes * (args.requireExactCount ? 1 : pool.length / args.count);
    beginQuestionList(pool, args.module, args.mode, duration, args.strictTimed, false, args.sequenceRemaining);
  }

  function beginPaper(set: PaperSet): void {
    const pool = paperQuestions(bank?.questions ?? [], set.sourceExam, set.year, set.module);
    if (!pool.length) {
      setToast("No validated questions are available for that paper.");
      return;
    }
    beginQuestionList(
      pool,
      set.module,
      "historic",
      esatPacedDurationMs(pool.length) / 60_000,
      true,
      true,
      undefined,
      "archive",
      { exam: set.sourceExam, year: set.year, label: set.label },
    );
  }

  function beginOriginal(module: ModuleId, sequenceRemaining: ModuleId[] = []): void {
    const pool = (mockBank?.questions ?? []).filter((question) => question.targetModule === module);
    if (pool.length !== 27) {
      setToast(`${MODULE_LABELS[module]} original mock is not fully available.`);
      return;
    }
    beginQuestionList(pool, module, "original", 40, true, false, sequenceRemaining, "original");
  }

  function beginFullMock(): void {
    const unavailable = MODULE_ORDER.find((module) => approvedCounts[module] < 27);
    if (unavailable) {
      setToast(`${MODULE_LABELS[unavailable]} needs 27 approved questions before a full Engineering mock can run.`);
      return;
    }
    beginSession({ module: "maths1", count: 27, mode: "exam", filter: "all", durationMinutes: 40, strictTimed: true, requireExactCount: true, sequenceRemaining: ["physics", "maths2"] });
  }

  function beginPlanSession(session: StudyPlanSession): void {
    const pool = session.questionIds
      .map((questionId) => questionMap[questionId])
      .filter((question): question is Question => Boolean(question) && question.targetModule === session.module && !question.excluded && !question.reviewRequired);
    if (!pool.length || pool.length !== session.questionIds.length) {
      setToast("The question bank changed, so today’s plan has been refreshed. Choose the updated session instead.");
      return;
    }
    const sequenceSource = pool.every((question) => supplementalQuestionIds.has(question.id)) ? "original" : "archive";
    beginQuestionList(
      pool,
      session.module,
      session.mode,
      session.durationMinutes,
      session.strictTimed,
      session.mode === "historic",
      undefined,
      sequenceSource,
      session.source,
      session,
    );
  }

  function continueSequence(attempt: Attempt): void {
    const [module, ...rest] = attempt.sequenceRemaining ?? [];
    if (!module) {
      setResult(null);
      setView("dashboard");
      return;
    }
    if (attempt.sequenceSource === "original") beginOriginal(module, rest);
    else beginSession({ module, count: 27, mode: "exam", filter: "all", durationMinutes: 40, strictTimed: true, requireExactCount: true, sequenceRemaining: rest });
  }

  function discardActiveAttempt(): void {
    const discarded = state.activeAttempt;
    if (!discarded) return;
    setState((current) => ({ ...current, activeAttempt: null }));
    reviewOpenedAtRef.current = null;
    setReviewOpen(false);
    setResult(null);
    setView("dashboard");
    timedOutRef.current = false;
    // Nothing about a discarded attempt is kept, so its working goes with it. The pending
    // debounce is dropped first so it cannot write a page back after the delete.
    scratchDirtyRef.current.clear();
    if (scratchTimerRef.current !== null) window.clearTimeout(scratchTimerRef.current);
    scratchTimerRef.current = null;
    if (user) {
      deleteActiveAttemptCloud(user.uid, discarded.attemptId).catch(() =>
        setToast("The session was discarded locally, but its cloud autosave could not be removed."),
      );
      deleteScratchPagesCloud(user.uid, discarded.attemptId).catch(() => undefined);
    }
  }

  function deleteAttempt(attemptId: string): void {
    setState((current) => ({ ...current, attempts: current.attempts.filter((attempt) => attempt.attemptId !== attemptId) }));
    setOpenAttemptId(null);
    setToast("That result was removed from your history, along with any working you wrote on its whiteboard. Question progress and the retrieval queue were left untouched.");
    if (user) {
      deleteAttemptCloud(user.uid, attemptId).catch(() => undefined);
      deleteScratchPagesCloud(user.uid, attemptId).catch(() => undefined);
    }
  }

  /**
   * Wipe every local trace of the signed-in account without touching its cloud copy.
   * Signing out is part of the operation, not a courtesy: while the session stays open,
   * any later save would push this now-empty profile over the cloud copy the
   * confirmation promises to keep.
   */
  async function clearLocalProgress(): Promise<void> {
    if (!user) return;
    if (!window.confirm("Erase all progress stored on this device and sign out? Your Firebase copy is not deleted, and it returns the next time you sign in.")) return;
    const storageKey = storageKeyForUser(user.uid);
    destructiveCloudActionRef.current = true;
    setAuthBusy(true);
    try {
      await signOutUser();
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Storage can be unavailable in hardened/private browser contexts.
      }
      syncedUserRef.current = null;
      cloudSettingsReadyUserRef.current = null;
      stateRef.current = defaultState();
      activeAttemptRef.current = null;
      setState(defaultState());
      setResult(null);
      reviewOpenedAtRef.current = null;
      setReviewOpen(false);
      setOpenAttemptId(null);
    } catch {
      setToast("This device could not be cleared because sign-out did not complete. Please try again.");
    } finally {
      destructiveCloudActionRef.current = false;
      setAuthBusy(false);
    }
  }

  /** Permanently purge the account's server-side revision data, as the privacy notice offers. */
  async function handleEraseCloudData(): Promise<void> {
    if (!user) return;
    if (!window.confirm("Permanently erase every attempt, answer, note, target and setting from this account's Firebase storage and from this browser? This cannot be undone.")) return;
    destructiveCloudActionRef.current = true;
    setAuthBusy(true);
    try {
      await deleteUserStateCloud(user.uid);
      try {
        localStorage.removeItem(storageKeyForUser(user.uid));
      } catch {
        // A refused local delete must not abort a completed server-side purge.
      }
      // Stamped as the newest edit so a stale replica on another device cannot
      // resurrect the erased profile the next time that device merges.
      const cleared = (["settings", "targets", "notes"] as const)
        .reduce((state, section) => touchSyncSection(state, section), defaultState());
      stateRef.current = cleared;
      activeAttemptRef.current = null;
      setState(cleared);
      setResult(null);
      reviewOpenedAtRef.current = null;
      setReviewOpen(false);
      setOpenAttemptId(null);
      setToast("Your revision data was permanently erased from Firebase and from this device.");
    } catch (error) {
      setToast(error instanceof Error ? `Your data could not be erased: ${error.message}` : "Your data could not be erased. Please try again.");
    } finally {
      destructiveCloudActionRef.current = false;
      setAuthBusy(false);
    }
  }

  /** Purge the server data, then remove the Firebase Auth identity itself. */
  async function handleDeleteAccount(): Promise<void> {
    if (!user) return;
    if (!window.confirm("Permanently delete this ESAT Atlas account and all of its cloud and device data? Google will ask you to confirm the account. This cannot be undone.")) return;
    const storageKey = storageKeyForUser(user.uid);
    destructiveCloudActionRef.current = true;
    setAuthBusy(true);
    try {
      await deleteAccountAndData(user);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // As above: the account is already gone server-side.
      }
      const cleared = defaultState();
      stateRef.current = cleared;
      activeAttemptRef.current = null;
      syncedUserRef.current = null;
      cloudSettingsReadyUserRef.current = null;
      setState(cleared);
      setResult(null);
      reviewOpenedAtRef.current = null;
      setReviewOpen(false);
      setOpenAttemptId(null);
      setToast("Your ESAT Atlas account and stored revision data were permanently deleted.");
    } catch (error) {
      setToast(error instanceof Error ? `Account deletion did not complete: ${error.message}` : "Account deletion did not complete. Please try again.");
    } finally {
      destructiveCloudActionRef.current = false;
      setAuthBusy(false);
    }
  }

  async function handleSignIn(): Promise<void> {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = authMessage(error);
      setAuthError(message);
      setToast(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    setAuthBusy(true);
    try {
      await signOutUser();
      syncedUserRef.current = null;
      cloudSettingsReadyUserRef.current = null;
      setToast("Signed out securely. Your cloud progress remains in Firebase.");
    } catch {
      setToast("Sign-out did not complete. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  const daysRemaining = adaptivePlan.daysRemaining;
  const dueCount = adaptivePlan.dueCount;
  const studyMs = adaptivePlan.completedMinutesThisWeek * 60_000;

  // The review screens read the working back for the attempt being examined. It is loaded
  // on demand rather than with the profile: most attempts are never reopened, and pages are
  // by far the bulkiest thing the account stores.
  const reviewAttemptId = result?.attemptId ?? openAttemptId ?? null;
  useEffect(() => {
    if (!user || !reviewAttemptId) return;
    if (reviewScratch?.attemptId === reviewAttemptId) return;
    let cancelled = false;
    loadScratchPagesCloud(user.uid, reviewAttemptId)
      .then((records) => {
        if (cancelled) return;
        setReviewScratch({
          attemptId: reviewAttemptId,
          pages: Object.fromEntries(
            Object.entries(records).map(([questionId, record]) => [questionId, decodePage(record.page)]),
          ),
        });
      })
      .catch(() => {
        if (!cancelled) setReviewScratch({ attemptId: reviewAttemptId, pages: {} });
      });
    return () => { cancelled = true; };
  }, [reviewAttemptId, reviewScratch, user]);

  const reviewPages = reviewScratch?.attemptId === reviewAttemptId ? reviewScratch.pages : {};

  const syncState: SyncState = !offline.online
    ? "offline"
    : pendingWrites > 0
      ? "pending"
      : "synced";

  // Memoised because the exam clock re-renders the player twice a second while a countdown
  // is on screen. The board is memoised in turn, and a fresh preferences object on every
  // tick would defeat that and re-render the toolbar under the candidate's hand.
  const scratchPreferences = useMemo<ScratchPreferences>(() => ({
    colour: state.settings.scratchpadColour,
    size: state.settings.scratchpadSize,
    stylusOnly: state.settings.scratchpadStylusOnly,
  }), [state.settings.scratchpadColour, state.settings.scratchpadSize, state.settings.scratchpadStylusOnly]);

  const updateScratchPreferences = useCallback((patch: Partial<ScratchPreferences>) => updateSettings({
    ...(patch.colour ? { scratchpadColour: patch.colour } : {}),
    ...(patch.size ? { scratchpadSize: patch.size } : {}),
    ...(patch.stylusOnly === undefined ? {} : { scratchpadStylusOnly: patch.stylusOnly }),
  }), [updateSettings]);


  if (!hydrated || !authReady) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">EA</div>
        <div>
          <strong>Preparing ESAT Atlas</strong>
          <span>Loading the validated question bank…</span>
        </div>
      </main>
    );
  }

  if (!user) return <LoginScreen busy={authBusy} error={authError} online={offline.online} onSignIn={handleSignIn} />;

  if (bankError) {
    return (
      <main className="loading-screen loading-screen-error">
        <div className="brand-mark">EA</div>
        <div>
          <strong>ESAT Atlas could not start</strong>
          <span>{bankError}</span>
        </div>
        <button className="button button-light" onClick={() => window.location.reload()}><RotateCcw size={16} /> Reload</button>
      </main>
    );
  }

  if (!bank || !mockBank) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">EA</div>
        <div><strong>Preparing ESAT Atlas</strong><span>Loading the validated question bank…</span></div>
      </main>
    );
  }

  if (active) {
    return (
      <ExamPlayer
        attempt={active}
        questionMap={questionMap}
        now={tick}
        reviewOpen={reviewOpen}
        setReviewOpen={openOrCloseReview}
        onSelect={selectOption}
        onClear={clearOption}
        onNavigate={navigateQuestion}
        onFlag={toggleFlag}
        onConfidence={(confidence) => updateActive((attempt) => {
          const id = attempt.questionIds[attempt.currentIndex];
          if (!attempt.responses[id]) return attempt;
          return { ...attempt, responses: { ...attempt.responses, [id]: { ...attempt.responses[id], confidence } } };
        })}
        onFinish={() => {
          const unanswered = active.questionIds.length - Object.values(active.responses).filter((item) => item.selectedAnswer).length;
          const warning = unanswered ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered. ` : "";
          if (window.confirm(`${warning}Submit this module now? You will not be able to change these answers.`)) finishAttempt(false);
        }}
        onExit={() => {
          if (window.confirm("Exit and discard this attempt? Your answers and timing for this session will not be saved.")) discardActiveAttempt();
        }}
        onPause={() =>
          updateActive((attempt) => {
            if (attempt.strictTimed) return attempt;
            if (attempt.pausedAt) {
              const pauseDuration = Date.now() - attempt.pausedAt;
              return { ...attempt, pausedAt: null, totalPausedDuration: attempt.totalPausedDuration + pauseDuration, endsAt: attempt.endsAt ? attempt.endsAt + pauseDuration : null, lastVisitStartedAt: Date.now() };
            }
            const settled = settleCurrentVisit(attempt);
            return { ...settled, pausedAt: Date.now() };
          })
        }
        pacingAid={state.settings.pacingAid}
        multiTabWarning={multiTabWarning}
        dismissMultiTab={() => setMultiTabWarning(false)}
        writingEnabled={state.settings.scratchpadEnabled}
        onWritingChange={toggleWriting}
        questionZoom={state.settings.questionZoom}
        questionHideOptions={state.settings.questionHideOptions}
        questionOptionTrim={state.settings.questionOptionTrim}
        onQuestionViewChange={updateSettings}
        writingReady={scratchLoadedFor === active.attemptId}
        scratchPageFor={scratchPageFor}
        onScratchChange={recordScratchPage}
        scratchPreferences={scratchPreferences}
        onScratchPreferencesChange={updateScratchPreferences}
        onNotice={setToast}
      />
    );
  }

  if (result) {
    return (
      <ResultScreen
        attempt={result}
        questionMap={questionMap}
        showScoreEstimate={state.settings.showScoreEstimate}
        returnLabel={result.planSessionId ? "Continue today’s plan" : "Back to dashboard"}
        previous={previousComparableAttempt(state.attempts, result)}
        scratchPages={reviewPages}
        onClose={() => { setResult(null); setView(result.planSessionId ? "plan" : "dashboard"); }}
        onContinue={() => continueSequence(result)}
        onRetryMissed={() => {
          const missed = Object.values(result.responses)
            .filter((response) => !response.correct)
            .map((response) => questionMap[response.questionId])
            .filter((question): question is Question => Boolean(question));
          if (!missed.length) { setToast("Nothing was missed in that set."); return; }
          setResult(null);
          beginQuestionList(missed, result.module, "retry", null, false);
        }}
        onTag={(questionId, tag) => {
          const update = (attempt: Attempt): Attempt => ({
            ...attempt,
            responses: {
              ...attempt.responses,
              [questionId]: {
                ...attempt.responses[questionId],
                errorClassifications: attempt.responses[questionId].errorClassifications.includes(tag)
                  ? attempt.responses[questionId].errorClassifications.filter((item) => item !== tag)
                  : [...attempt.responses[questionId].errorClassifications, tag],
              },
            },
          });
          setResult(update(result));
          setState((current) => ({ ...current, attempts: current.attempts.map((attempt) => attempt.attemptId === result.attemptId ? update(attempt) : attempt) }));
        }}
      />
    );
  }

  const openAttempt = openAttemptId ? state.attempts.find((attempt) => attempt.attemptId === openAttemptId) ?? null : null;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {sidebarOpen ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">EA</div>
          <div><strong>ESAT Atlas</strong><span>Cambridge Engineering</span></div>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "nav-active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setOpenAttemptId(null); setSidebarOpen(false); }}>
                <Icon size={18} /><span>{item.label}</span>
                {item.id === "mistakes" && dueCount > 0 ? <em>{dueCount}</em> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-source">
          <FileCheck2 size={18} />
          <div><strong>{bank.questions.length} archive + {mockBank.questions.length} original</strong><span>Validated bank {bank.version.replace("esat-archive-", "")}</span></div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="topbar-context">
            <span>2026 preparation cycle</span>
            <Pill tone="good"><CheckCircle2 size={13} /> Source bank validated</Pill>
          </div>
          <div className="topbar-actions">
            <ConnectionStatus state={syncState} />
            <button className="icon-button" onClick={() => updateSettings({ theme: state.settings.theme === "light" ? "dark" : "light" })} aria-label={`Switch to ${state.settings.theme === "light" ? "dark" : "light"} theme`}>
              {state.settings.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="account-button" onClick={handleSignOut} title="Sign out" disabled={authBusy}>
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : <UserRound size={18} />}
              <span>{user?.displayName ?? user?.email ?? "Signed in"}</span><LogOut size={15} />
            </button>
          </div>
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          <div className="view-stage" key={openAttempt ? `attempt-${openAttempt.attemptId}` : view}>
            {openAttempt ? (
            <AttemptDetailView
              attempt={openAttempt}
              questionMap={questionMap}
              attempts={state.attempts}
              showScoreEstimate={state.settings.showScoreEstimate}
              scratchPages={reviewPages}
              onBack={() => setOpenAttemptId(null)}
              onDelete={() => {
                if (window.confirm("Remove this result from your history? Question progress and the retrieval queue are not affected.")) deleteAttempt(openAttempt.attemptId);
              }}
              onResit={() => {
                const key = attemptPaperKey(openAttempt);
                const set = key ? paperSets.find((item) => item.key === key) : null;
                if (set) beginPaper(set);
                else if (openAttempt.mode === "original") beginOriginal(openAttempt.module);
                else setToast("This set was generated from the archive, so it cannot be re-sat identically. Build a fresh session instead.");
              }}
            />
            ) : (
              <>
              {view === "dashboard" ? (
                <Dashboard
                  state={state}
                  bank={bank}
                  approvedCounts={approvedCounts}
                  daysRemaining={daysRemaining}
                  dueCount={dueCount}
                  studyMs={studyMs}
                  questionMap={questionMap}
                  plan={adaptivePlan}
                  onPractice={() => setView("practice")}
                  onViewPlan={() => setView("plan")}
                  onStartPlanSession={beginPlanSession}
                  onOpenAttempt={setOpenAttemptId}
                />
              ) : null}
              {view === "plan" ? (
                <AdaptiveStudyPlanView
                  plan={adaptivePlan}
                  settings={state.settings}
                  onStart={beginPlanSession}
                  onPractice={() => setView("practice")}
                  onSettings={() => setView("settings")}
                  onPlanMinutesChange={(minutes) => updateSettings({ adaptivePlanMinutes: minutes })}
                />
              ) : null}
              {view === "practice" ? (
                <PracticeView
                  state={state}
                  now={tick}
                  approvedCounts={approvedCounts}
                  paperSets={paperSets}
                  module={builderModule}
                  setModule={setBuilderModule}
                  count={builderCount}
                  setCount={setBuilderCount}
                  filter={builderFilter}
                  setFilter={setBuilderFilter}
                  timing={builderTiming}
                  setTiming={setBuilderTiming}
                  topic={builderTopic}
                  setTopic={setBuilderTopic}
                  topics={bank ? listTopics(bank.questions, builderModule) : []}
                  paperModule={paperModule}
                  setPaperModule={setPaperModule}
                  paperExam={paperExam}
                  setPaperExam={setPaperExam}
                  paperYear={paperYear}
                  setPaperYear={setPaperYear}
                  onStartPaper={beginPaper}
                  onStart={() => beginSession({
                    module: builderModule,
                    count: builderCount,
                    mode: "practice",
                    filter: builderFilter,
                    topic: builderTopic,
                    durationMinutes: builderTiming === "untimed" ? null : builderTiming === "module" ? 40 : (builderCount * 40) / 27,
                    strictTimed: false,
                  })}
                  onExam={(module) => beginSession({ module, count: 27, mode: "exam", filter: "all", durationMinutes: 40, strictTimed: true, requireExactCount: true })}
                  onFullMock={beginFullMock}
                />
              ) : null}
              {view === "tricks" ? (
                <QuickTricksView
                  attempts={state.attempts}
                  questionMap={questionMap}
                  onPractiseTopic={(module, topic) => {
                    setBuilderModule(module);
                    setBuilderTopic(topic);
                    setBuilderFilter("all");
                    setView("practice");
                  }}
                />
              ) : null}
              {view === "originals" ? (
                <OriginalMocksView
                  payload={mockBank}
                  attempts={state.attempts}
                  showScoreEstimate={state.settings.showScoreEstimate}
                  onStart={beginOriginal}
                  onFull={() => beginOriginal("maths1", ["physics", "maths2"])}
                  onOpenAttempt={setOpenAttemptId}
                />
              ) : null}
              {view === "analytics" ? <AnalyticsView attempts={state.attempts} questionMap={questionMap} showScoreEstimate={state.settings.showScoreEstimate} now={tick} /> : null}
              {view === "mistakes" ? (
                <MistakesView
                  state={state}
                  now={tick}
                  questionMap={questionMap}
                  onRetry={(question) => beginQuestionList([question], question.targetModule, "retry", null, false)}
                  scope={retryScope}
                  setScope={setRetryScope}
                  module={retryModule}
                  setModule={setRetryModule}
                  timed={retryTimed}
                  setTimed={setRetryTimed}
                  onRedo={() => {
                    const pool = Object.values(state.mistakes)
                      .filter((item) => retryScope === "all" || item.dueDate <= tick)
                      .sort((left, right) => left.dueDate - right.dueDate)
                      .map((item) => questionMap[item.questionId])
                      .filter((question): question is Question => Boolean(question) && question.targetModule === retryModule);
                    if (!pool.length) { setToast("Nothing matches that selection."); return; }
                    beginQuestionList(
                      pool,
                      retryModule,
                      "retry",
                      retryTimed ? esatPacedDurationMs(pool.length) / 60_000 : null,
                      retryTimed,
                    );
                  }}
                  onNote={updateNote}
                />
              ) : null}
              {view === "papers" ? (
                <PaperHistoryView
                  state={state}
                  paperSets={paperSets}
                  filter={historyFilter}
                  setFilter={setHistoryFilter}
                  showScoreEstimate={state.settings.showScoreEstimate}
                  onStart={beginPaper}
                  onOpenAttempt={setOpenAttemptId}
                />
              ) : null}
              {view === "settings" ? (
                <SettingsView
                  state={state}
                  busy={authBusy}
                  offline={offline}
                  onToast={setToast}
                  onSettingsChange={updateSettings}
                  onTargetChange={updateTarget}
                  onEraseCloudData={handleEraseCloudData}
                  onDeleteAccount={handleDeleteAccount}
                  onExportJson={() => download("esat-atlas-export.json", JSON.stringify(state, null, 2), "application/json")}
                  onExportCsv={() => {
                    const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
                    const rows = ["attemptId,kind,module,mode,sourceSet,sourceExams,sourceYears,startedAt,endedAt,rawScore,questionCount,accuracyPercent,estimatedScore,estimateEligibility,freshQuestionCount,durationMs,planSessionId,planSessionKind,planSessionTitle,planSessionEstimatedMinutes"];
                    for (const attempt of state.attempts) {
                      const report = scoreReportForAttempt(attempt);
                      rows.push([
                        attempt.attemptId,
                        KIND_LABELS[attemptKind(attempt)],
                        attempt.module,
                        attempt.mode,
                        attempt.sourceSetLabel,
                        (attempt.sourceExams ?? []).join(" | "),
                        (attempt.sourceYears ?? []).join(" | "),
                        new Date(attempt.startedAt).toISOString(),
                        attempt.endedAt ? new Date(attempt.endedAt).toISOString() : "",
                        attempt.rawScore ?? "",
                        attempt.questionIds.length,
                        attempt.rawScore === null ? "" : Math.round(report.accuracy * 100),
                        report.estimate ? report.estimate.scaledScore.toFixed(1) : "",
                        report.label,
                        attempt.freshQuestionCount,
                        attempt.durationMs ?? "",
                        attempt.planSessionId ?? "",
                        attempt.planSessionKind ?? "",
                        attempt.planSessionTitle ?? "",
                        attempt.planSessionEstimatedMinutes ?? "",
                      ].map(csvCell).join(","));
                    }
                    download("esat-atlas-attempts.csv", rows.join("\n"), "text/csv");
                  }}
                  onReset={clearLocalProgress}
                />
              ) : null}
              </>
            )}
          </div>
        </main>
      </div>
      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          <TriangleAlert size={17} />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={15} /></button>
        </div>
      ) : null}
      {offline.updateReady && !updateDismissed ? (
        <UpdateBanner onApply={offline.applyUpdate} onDismiss={() => setUpdateDismissed(true)} />
      ) : null}
    </div>
  );
}

export function Dashboard({
  state,
  bank,
  approvedCounts,
  daysRemaining,
  dueCount,
  studyMs,
  questionMap,
  plan,
  onPractice,
  onViewPlan,
  onStartPlanSession,
  onOpenAttempt,
}: {
  state: StoredState;
  bank: BankPayload;
  approvedCounts: Record<ModuleId, number>;
  daysRemaining: number | null;
  dueCount: number;
  studyMs: number;
  questionMap: Record<string, Question>;
  plan: AdaptiveStudyPlan;
  onPractice: () => void;
  onViewPlan: () => void;
  onStartPlanSession: (session: StudyPlanSession) => void;
  onOpenAttempt: (attemptId: string) => void;
}) {
  const stats = Object.fromEntries(MODULE_ORDER.map((module) => [module, moduleStats(state.attempts, module)])) as Record<ModuleId, ReturnType<typeof moduleStats>>;
  const archiveIds = new Set(bank.questions.map((question) => question.id));
  const attempted = Object.keys(state.progress).filter((questionId) => archiveIds.has(questionId)).length;
  const totalApproved = Object.values(approvedCounts).reduce((sum, value) => sum + value, 0);
  const coverage = totalApproved ? attempted / totalApproved : 0;
  const recentCompleted = state.attempts.filter((attempt) => attempt.rawScore !== null).slice(0, 5);
  // Readiness evidence means fresh, strictly-timed content. A timed retry of past
  // mistakes is strictly timed but contains no first-exposure questions, so it is
  // deliberately excluded here to keep the "retakes excluded" promise honest.
  const strictAttempts = state.attempts.filter((attempt) => scoreReportForAttempt(attempt).eligible);
  const overall = combinedScoreEstimate(
    MODULE_ORDER
      .map((module) => stats[module])
      .filter((item) => item.recentRawAverage !== null && item.recentQuestionAverage !== null)
      .map((item) => ({ rawScore: item.recentRawAverage ?? 0, questionCount: item.recentQuestionAverage ?? 1 })),
  );
  const weeklyTargetMs = plan.weeklyTargetMinutes * 60_000;
  const recordedHours = Math.floor(plan.completedMinutesThisWeek / 6) / 10;
  const nextPlanSession = plan.sessions[0] ?? null;

  return (
    <>
      <section className="page-heading">
        <div>
          <Pill tone="blue"><Sparkles size={13} /> Evidence-led preparation</Pill>
          <h1>Your readiness, measured honestly.</h1>
          <p>Fresh performance predicts. Retakes teach. Exact raw marks are always shown; score estimates appear only when the evidence is representative.</p>
        </div>
        <button className="button button-primary" onClick={onViewPlan}><CalendarCheck2 size={17} /> Today’s study plan</button>
      </section>

      <DashboardPlanPreview plan={plan} onView={onViewPlan} onStart={onStartPlanSession} />

      <section className="readiness-grid">
        {MODULE_ORDER.map((module) => {
          const item = stats[module];
          const approvedIds = bank.questions
            .filter((question) => question.targetModule === module && !question.excluded && !question.reviewRequired)
            .map((question) => question.id);
          const unseen = approvedIds.filter((id) => !state.progress[id] || state.progress[id].neverSeen).length;
          const estimate = item.recentRawAverage === null || item.recentQuestionAverage === null
            ? null
            : scoreEstimate(item.recentRawAverage, item.recentQuestionAverage, module);
          return (
            <article className="module-card" key={module}>
              <div className={`module-accent ${module}`} />
              <div className="module-card-top"><span>{MODULE_LABELS[module]}</span><Pill tone={item.trend === "improving" ? "good" : item.trend === "declining" ? "warn" : "neutral"}>{item.trend}</Pill></div>
              {item.recentRawAverage === null || item.recentQuestionAverage === null
                ? <strong className="module-score empty-score">—</strong>
                : <strong className="module-score">{item.recentRawAverage.toFixed(1)}<small>/{item.recentQuestionAverage.toFixed(item.recentQuestionAverage % 1 === 0 ? 0 : 1)} raw</small></strong>}
              {estimate && state.settings.showScoreEstimate
                ? <p className="module-estimate"><strong>{estimate.scaledScore.toFixed(1)}</strong> estimated · {estimate.standing}</p>
                : <p>{item.recentFloorAccuracy !== null ? `Recent fresh floor ${Math.round(item.recentFloorAccuracy * 100)}%` : "No fresh timed module yet"}</p>}
              <div className="module-meta">
                <span><Target size={14} /> Personal target {state.targets[module].toFixed(1)}</span>
                <span>{approvedCounts[module]} approved · {Math.max(0, unseen)} unseen</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="metric-strip">
        <div><CalendarDays size={18} /><span>Exam countdown<strong>{daysRemaining === null ? "Not set" : `${daysRemaining} days`}</strong></span></div>
        <div><RotateCcw size={18} /><span>Due for retrieval<strong>{dueCount} questions</strong></span></div>
        <div><Clock3 size={18} /><span>Study this week<strong>{recordedHours.toFixed(1)} / {(plan.weeklyTargetMinutes / 60).toFixed(plan.weeklyTargetMinutes % 60 ? 1 : 0)} h</strong></span></div>
        <div><Activity size={18} /><span>Archive coverage<strong>{attempted ? `${Math.min(100, Math.round(coverage * 100))}%` : "Not started"}</strong></span></div>
      </section>
      <div className="week-progress" aria-hidden="true"><i><b style={{ width: `${Math.min(100, weeklyTargetMs ? (studyMs / weeklyTargetMs) * 100 : 0)}%` }} /></i></div>

      <section className="dashboard-columns">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><span className="eyebrow">Exam readiness trend</span><h2>Fresh, timed performance only</h2></div><Pill tone="neutral">Retakes excluded</Pill></div>
          {strictAttempts.length ? (
            <div className="mini-trend">
              {strictAttempts.slice(0, 12).reverse().map((attempt) => {
                // A bar carries no text, so its label is the only thing announced; the
                // title alone would leave it as an unnamed control on some readers.
                const label = `${MODULE_LABELS[attempt.module]} ${attempt.rawScore}/${attempt.questionIds.length} · ${formatDate(attempt.endedAt)}`;
                return (
                  <button
                    key={attempt.attemptId}
                    type="button"
                    className={`trend-bar ${attempt.module}`}
                    style={{ height: `${Math.max(8, attemptAccuracyPercent(attempt))}%` }}
                    title={label}
                    aria-label={`Open breakdown: ${label}`}
                    onClick={() => onOpenAttempt(attempt.attemptId)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No fresh trend yet" body="Sit a past paper or a strict 27-question module to establish your first honest baseline." action={<button className="button button-secondary" onClick={onPractice}>Choose a paper</button>} />
          )}
        </article>
        <article className="panel action-panel plan-rationale-card">
          <span className="eyebrow">Why this comes next</span>
          <div className="action-icon"><Brain size={22} /></div>
          <h2>{nextPlanSession?.title ?? "Your core work is complete"}</h2>
          <p>{nextPlanSession?.rationale[0] ?? plan.summary}</p>
          {nextPlanSession
            ? <button className="text-button" onClick={() => onStartPlanSession(nextPlanSession)}>Start this session <ChevronRight size={16} /></button>
            : <button className="text-button" onClick={onViewPlan}>Review today’s plan <ChevronRight size={16} /></button>}
        </article>
      </section>

      {overall && state.settings.showScoreEstimate ? (
        <section className="panel overall-estimate">
          <div className="panel-heading"><div><span className="eyebrow">Estimated standing</span><h2>Across your recent strict modules</h2></div><Pill tone="warn">Estimate, not an official score</Pill></div>
          <ScoreEstimateBlock estimate={overall} />
        </section>
      ) : null}

      {recentCompleted.length ? (
        <section className="panel recent-results">
          <div className="panel-heading"><div><span className="eyebrow">Recent results</span><h2>Open any attempt for the full breakdown</h2></div></div>
          <div className="recent-list">
            {recentCompleted.map((attempt) => {
              const report = scoreReportForAttempt(attempt);
              const topics = sectionBreakdown(Object.values(attempt.responses), questionMap);
              return (
                <button key={attempt.attemptId} className="recent-item" onClick={() => onOpenAttempt(attempt.attemptId)}>
                  <span className={`module-dot ${attempt.module}`} />
                  <span className="recent-item-copy">
                    <strong>{attemptTitle(attempt)}</strong>
                    <small>{MODULE_LABELS[attempt.module]} · {formatDate(attempt.endedAt)}{topics.length ? ` · weakest: ${topics[0].label}` : ""}</small>
                  </span>
                  <span className="recent-item-score">
                    <strong>{attempt.rawScore}/{attempt.questionIds.length}</strong>
                    {state.settings.showScoreEstimate && report.estimate
                      ? <small>≈ {report.estimate.scaledScore.toFixed(1)}</small>
                      : <small>{Math.round(report.accuracy * 100)}%</small>}
                  </span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="source-ribbon">
        <div><ShieldCheck size={20} /><span><strong>{bank.questions.length} verified in-scope questions</strong>{approvedCounts.maths1} Mathematics 1 · {approvedCounts.physics} Physics · {approvedCounts.maths2} Mathematics 2</span></div>
        <div><strong>Raw marks are exact</strong><span>The optional 1.0–9.0 proxy is restricted to representative fresh strict sets and is not a UAT-UK conversion.</span></div>
      </section>
    </>
  );
}

const PLAN_PHASE_DETAILS: Record<AdaptiveStudyPlan["phase"], { label: string; note: string; tone: "neutral" | "good" | "warn" | "bad" | "blue" }> = {
  foundation: { label: "Foundation phase", note: "Build representative coverage and establish honest baselines.", tone: "good" },
  consolidation: { label: "Consolidation phase", note: "Close reliable topic gaps while refreshing timed evidence.", tone: "blue" },
  simulation: { label: "Simulation phase", note: "Practise complete module rhythm while protecting retrieval work.", tone: "blue" },
  taper: { label: "Taper phase", note: "Keep recall sharp and avoid unnecessary cognitive load.", tone: "warn" },
  "date-needed": { label: "Exam date needed", note: "Confirm the exam date before time-sensitive planning is applied.", tone: "bad" },
};

const PLAN_KIND_LABELS: Record<StudyPlanSession["kind"], string> = {
  retrieval: "Due retrieval",
  maintenance: "Maintenance review",
  baseline: "Paced baseline",
  focus: "Priority focus",
  coverage: "Fresh coverage",
  simulation: "Strict simulation",
};

const PLAN_MINUTE_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120] as const;

function planProgress(plan: AdaptiveStudyPlan): number {
  return plan.weeklyTargetMinutes
    ? Math.min(100, Math.floor((plan.completedMinutesThisWeek / plan.weeklyTargetMinutes) * 100))
    : 0;
}

function DashboardPlanPreview({ plan, onView, onStart }: {
  plan: AdaptiveStudyPlan;
  onView: () => void;
  onStart: (session: StudyPlanSession) => void;
}) {
  const phase = PLAN_PHASE_DETAILS[plan.phase];
  const first = plan.sessions[0] ?? null;
  const progress = planProgress(plan);
  return (
    <section className={`dashboard-plan-preview plan-phase-${plan.phase}`} aria-labelledby="dashboard-plan-title">
      <div className="plan-preview-copy">
        <div className="plan-preview-kicker">
          <Pill tone={phase.tone}><CalendarCheck2 size={13} /> {phase.label}</Pill>
          <span>{plan.confidence} confidence</span>
        </div>
        <h2 id="dashboard-plan-title">{plan.headline}</h2>
        <p>{plan.summary}</p>
        <div className="plan-preview-meta" aria-label="Today’s plan summary">
          <span><strong>{plan.totalEstimatedMinutes}</strong> planned min</span>
          <span><strong>{plan.totalQuestions}</strong> questions</span>
          <span><strong>{plan.sessions.length}</strong> session{plan.sessions.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className={`plan-preview-action${first ? "" : " plan-preview-action-empty"}`}>
        <div className="plan-mini-progress">
          <span><strong>{progress}%</strong> of weekly target recorded</span>
          <div role="progressbar" aria-label="Weekly study target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
        </div>
        {first ? <button type="button" className="button button-light" onClick={() => onStart(first)}><Play size={17} /> Start first session</button> : null}
        <button type="button" className={first ? "plan-link-light" : "button button-light"} onClick={onView}>{first ? "Review the full plan" : "Open study plan"}<ChevronRight size={16} /></button>
      </div>
    </section>
  );
}

function PlanPhaseRail({ active }: { active: AdaptiveStudyPlan["phase"] }) {
  const phases: Array<Exclude<AdaptiveStudyPlan["phase"], "date-needed">> = ["foundation", "consolidation", "simulation", "taper"];
  return (
    <div className={`plan-phase-rail plan-phase-${active}`} role="list" aria-label={`Current preparation phase: ${PLAN_PHASE_DETAILS[active].label}`}>
      {phases.map((phase, index) => (
        <div key={phase} role="listitem" aria-current={active === phase ? "step" : undefined} className={active === phase ? "active" : ""}>
          <i aria-hidden="true">{index + 1}</i>
          <span>{PLAN_PHASE_DETAILS[phase].label.replace(" phase", "")}</span>
        </div>
      ))}
    </div>
  );
}

function PlanSessionCard({ session, index, onStart }: { session: StudyPlanSession; index: number; onStart: (session: StudyPlanSession) => void }) {
  return (
    <li className={`plan-session-card plan-kind-${session.kind}`}>
      <span className="plan-step"><span className="plan-step-label">Step </span>{String(index + 1).padStart(2, "0")}</span>
      <div className="plan-session-copy">
        <div className="plan-session-kicker">
          <Pill tone={session.kind === "retrieval" ? "warn" : session.kind === "simulation" ? "blue" : "good"}>{PLAN_KIND_LABELS[session.kind]}</Pill>
          <span><i className={`module-dot ${session.module}`} />{MODULE_LABELS[session.module]}</span>
        </div>
        <h3>{session.title}</h3>
        <p>{session.summary}</p>
        <div className="plan-session-meta">
          <span><Clock3 size={14} /> About {session.estimatedMinutes} min</span>
          <span><LibraryBig size={14} /> {session.questionIds.length} question{session.questionIds.length === 1 ? "" : "s"}</span>
          <span><ShieldCheck size={14} /> {session.strictTimed ? "Strict timing" : "Pause enabled"}</span>
          <span><Activity size={14} /> {session.evidenceConfidence} evidence</span>
        </div>
        <details className="plan-session-reason">
          <summary>Why this session?<ChevronRight size={15} /></summary>
          <ul>{session.rationale.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </details>
      </div>
      <div className="plan-session-action">
        <button type="button" className="button button-primary" onClick={() => onStart(session)}><Play size={16} /> Start session</button>
        {session.topic ? <span>Focus: {session.topic}</span> : <span>{session.durationMinutes === null ? "Untimed" : `${Math.round(session.durationMinutes)} min cap`}</span>}
      </div>
    </li>
  );
}

export function AdaptiveStudyPlanView({ plan, settings, onStart, onPractice, onSettings, onPlanMinutesChange }: {
  plan: AdaptiveStudyPlan;
  settings: Settings;
  onStart: (session: StudyPlanSession) => void;
  onPractice: () => void;
  onSettings: () => void;
  onPlanMinutesChange: (minutes: number) => void;
}) {
  const phase = PLAN_PHASE_DETAILS[plan.phase];
  const progress = planProgress(plan);
  const first = plan.sessions[0] ?? null;
  return (
    <>
      <section className="page-heading plan-page-heading">
        <div>
          <Pill tone={phase.tone}><CalendarCheck2 size={13} /> {phase.label}</Pill>
          <h1 id="adaptive-plan-title">A focused plan for today.</h1>
          <p>Built from due retrieval, first-exposure accuracy, topic coverage, recent strict evidence, your exam date, and the time you have chosen.</p>
        </div>
        {first ? <button type="button" className="button button-primary" onClick={() => onStart(first)}><Play size={17} /> Start first session</button> : null}
      </section>

      <section className={`plan-hero plan-phase-${plan.phase}`} aria-labelledby="plan-hero-title">
        <div className="plan-hero-copy">
          <div className="plan-hero-kicker"><span>Your adaptive plan</span><Pill tone="neutral">{plan.confidence} confidence</Pill></div>
          <h2 id="plan-hero-title">{plan.headline}</h2>
          <p>{plan.summary}</p>
          <div className="plan-hero-stats">
            <div><span>Remaining plan</span><strong>{plan.totalEstimatedMinutes} min</strong></div>
            <div><span>Questions</span><strong>{plan.totalQuestions}</strong></div>
            <div><span>Core sessions</span><strong>{plan.sessions.length}</strong></div>
            <div><span>ESAT countdown</span><strong>{plan.daysRemaining === null ? "Confirm date" : `${plan.daysRemaining} days`}</strong></div>
          </div>
        </div>
        <div className="plan-week-card">
          <div><span>This week</span><strong>{plan.completedMinutesThisWeek} / {plan.weeklyTargetMinutes} min</strong></div>
          <div className="plan-week-track" role="progressbar" aria-label="Weekly recorded question time" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
          <p>{progress >= 100 ? "Your weekly target is complete. Only genuinely due retrieval will be prioritised." : `${Math.max(0, plan.weeklyTargetMinutes - plan.completedMinutesThisWeek)} recorded minutes remain against this week’s target.`}</p>
        </div>
      </section>

      {plan.phase !== "date-needed" ? <PlanPhaseRail active={plan.phase} /> : (
        <section className="integrity-banner plan-date-alert"><TriangleAlert size={18} /><div><strong>Confirm your ESAT date</strong><span>The planner can still protect retrieval and coverage, but it will not schedule time-sensitive simulation or taper work until the date is valid.</span></div><button type="button" className="button button-secondary compact" onClick={onSettings}>Open settings</button></section>
      )}

      <section className="plan-layout">
        <div className="plan-main-column">
          <article className="panel plan-sessions-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Today’s core work</span><h2>{plan.sessions.length ? "Complete these in order" : "Nothing essential remains"}</h2></div>
              {plan.dueCount ? <Pill tone="warn">{plan.dueCount} due now</Pill> : <Pill tone="good"><CheckCircle2 size={13} /> Queue protected</Pill>}
            </div>
            {plan.sessions.length ? (
              <ol className="plan-session-list">
                {plan.sessions.map((session, index) => <PlanSessionCard key={session.id} session={session} index={index} onStart={onStart} />)}
              </ol>
            ) : plan.status === "complete" ? (
              <div className="plan-complete-state">
                <span><CheckCircle2 size={26} /></span>
                <h3>Today’s core plan is complete.</h3>
                <p>{plan.summary} The planner will update after your next recorded result or when retrieval becomes due.</p>
                <button type="button" className="button button-secondary" onClick={onPractice}>Optional extra practice</button>
              </div>
            ) : (
              <EmptyState icon={TriangleAlert} title="No safe session is available" body={plan.summary} action={<button type="button" className="button button-secondary" onClick={onPractice}>Open practice builder</button>} />
            )}
          </article>

          <article className="panel plan-adjust-panel">
            <div><span className="eyebrow">Adjust today</span><h2>How much focused time do you have?</h2><p>The plan rebuilds immediately. It never fills a short session with repeated questions while calling them fresh.</p></div>
            <div className="plan-minute-options" role="group" aria-label="Adaptive plan length">
              {PLAN_MINUTE_OPTIONS.map((minutes) => <button type="button" key={minutes} aria-pressed={settings.adaptivePlanMinutes === minutes} className={settings.adaptivePlanMinutes === minutes ? "selected" : ""} onClick={() => onPlanMinutesChange(minutes)}>{minutes}<small>min</small></button>)}
            </div>
            <p className="plan-update-status" role="status" aria-live="polite" aria-atomic="true">Today’s plan now has {plan.totalEstimatedMinutes} minutes across {plan.sessions.length} core session{plan.sessions.length === 1 ? "" : "s"}.</p>
          </article>
        </div>

        <aside className="plan-side-column">
          <article className="panel plan-why-panel">
            <div className="panel-heading"><div><span className="eyebrow">Planning rationale</span><h2>Why today looks like this</h2></div><Brain size={19} /></div>
            <ul>{plan.rationale.map((reason) => <li key={reason}><Check size={15} /> <span>{reason}</span></li>)}</ul>
            {plan.unavailableDueCount ? <div className="plan-data-note"><TriangleAlert size={15} /><span>The current validated bank no longer contains {plan.unavailableDueCount} question{plan.unavailableDueCount === 1 ? "" : "s"} referenced by due records.</span></div> : null}
          </article>
          <article className="panel plan-integrity-panel">
            <ShieldCheck size={20} />
            <div><span className="eyebrow">Evidence integrity</span><h2>Retakes teach; they do not predict.</h2><p>Weakness priorities use first exposure. Retrieval results update mastery, but they never inflate the readiness signal shown elsewhere.</p></div>
          </article>
          <article className="panel plan-phase-note">
            <span className="eyebrow">Current strategy</span>
            <h2>{phase.label}</h2>
            <p>{phase.note}</p>
            <button type="button" className="text-button" onClick={onSettings}>Review planning settings <ChevronRight size={16} /></button>
          </article>
        </aside>
      </section>
    </>
  );
}

function GuideWorkedExample({ guide }: { guide: TechniqueGuide }) {
  return (
    <div className="guide-example">
      <span>Worked example</span>
      <p><MathText>{guide.example.prompt}</MathText></p>
      <ol>{guide.example.steps.map((step) => <li key={step}><MathText>{step}</MathText></li>)}</ol>
      <strong>Answer: <MathText>{guide.example.answer}</MathText></strong>
    </div>
  );
}

/** Highlights the searched-for text inside a plain prose field. */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  const haystack = text.toLowerCase();
  let cursor = 0;
  for (let at = haystack.indexOf(query); at !== -1; at = haystack.indexOf(query, cursor)) {
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(<mark key={at}>{text.slice(at, at + query.length)}</mark>);
    cursor = at + query.length;
  }
  if (!parts.length) return <>{text}</>;
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

type TrickSort = "recommended" | "module" | "alphabetical";

/**
 * Everything a candidate might search for in one guide, already rendered out of maths
 * markup. Searching the source would match `frac` and `text` and would never match what
 * the guide visibly says, so "km/h" or "1/2" would find nothing.
 */
const GUIDE_SEARCH_TEXT = new Map(TECHNIQUE_GUIDES.map((guide) => [
  guide.id,
  mathToPlainText([
    guide.title, guide.topic, MODULE_LABELS[guide.module], guide.principle, guide.validity,
    ...guide.bestMethod, ...guide.fastMethod, ...guide.traps, ...guide.keywords,
    guide.example.prompt, ...guide.example.steps, guide.example.answer,
  ].join(" ")).toLowerCase(),
]));

const TACTIC_SEARCH_TEXT = new Map(EXAM_TACTICS.map((tactic) => [
  tactic.id,
  mathToPlainText([tactic.title, tactic.summary, tactic.useWhen, tactic.caution, ...tactic.method].join(" ")).toLowerCase(),
]));

/** What this candidate's own attempts say about the topic a guide covers. */
interface GuideEvidence {
  attempted: number;
  accuracy: number;
  tone: "good" | "warn" | "bad";
  label: string;
}

function guideEvidence(rows: SectionRow[]): Map<string, GuideEvidence> {
  const evidence = new Map<string, GuideEvidence>();
  for (const row of rows) {
    if (!row.total) continue;
    const tone = row.accuracy >= .8 ? "good" : row.accuracy >= .6 ? "warn" : "bad";
    evidence.set(row.key, {
      attempted: row.total,
      accuracy: row.accuracy,
      tone,
      label: `${Math.round(row.accuracy * 100)}% over ${row.total} question${row.total === 1 ? "" : "s"}`,
    });
  }
  return evidence;
}

export function QuickTricksView({
  attempts, questionMap, onPractiseTopic,
}: {
  attempts: Attempt[];
  questionMap: Record<string, Question>;
  onPractiseTopic: (module: ModuleId, topic: string) => void;
}) {
  const [module, setModule] = useState<"all" | ModuleId>("all");
  const [sort, setSort] = useState<TrickSort>("recommended");
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  // First exposure only, matching the rule the rest of the app uses for weakness: a
  // retried question that is now correct must not hide the gap that produced it.
  const evidence = useMemo(() => {
    const seen = new Set<string>();
    const responses: ResponseRecord[] = [];
    for (const attempt of [...attempts].sort((left, right) => left.startedAt - right.startedAt)) {
      for (const response of Object.values(attempt.responses)) {
        if (seen.has(response.questionId)) continue;
        seen.add(response.questionId);
        responses.push(response);
      }
    }
    return guideEvidence(sectionBreakdown(responses, questionMap, (question) => `${question.targetModule}|${question.esatTopic}`));
  }, [attempts, questionMap]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (id: string, source: Map<string, string>) => (
    !normalizedQuery || (source.get(id) ?? "").includes(normalizedQuery)
  );

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const guide of TECHNIQUE_GUIDES) {
      if (!matchesQuery(guide.id, GUIDE_SEARCH_TEXT)) continue;
      counts.all += 1;
      counts[guide.module] = (counts[guide.module] ?? 0) + 1;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery]);

  const guides = useMemo(() => {
    const filtered = TECHNIQUE_GUIDES.filter((guide) => (
      (module === "all" || guide.module === module) && matchesQuery(guide.id, GUIDE_SEARCH_TEXT)
    ));
    const moduleRank = (guide: TechniqueGuide) => MODULE_ORDER.indexOf(guide.module);
    if (sort === "alphabetical") return [...filtered].sort((left, right) => left.title.localeCompare(right.title));
    if (sort === "module") return [...filtered].sort((left, right) => moduleRank(left) - moduleRank(right) || left.topic.localeCompare(right.topic));
    // Weakest evidence first; untested topics sit after everything already measured,
    // because a guide with no attempts behind it is not evidence of a weakness.
    return [...filtered].sort((left, right) => {
      const leftEvidence = evidence.get(`${left.module}|${left.topic}`);
      const rightEvidence = evidence.get(`${right.module}|${right.topic}`);
      if (leftEvidence && rightEvidence) return leftEvidence.accuracy - rightEvidence.accuracy || rightEvidence.attempted - leftEvidence.attempted;
      if (leftEvidence) return -1;
      if (rightEvidence) return 1;
      return moduleRank(left) - moduleRank(right) || left.topic.localeCompare(right.topic);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, sort, normalizedQuery, evidence]);

  const tactics = EXAM_TACTICS.filter((tactic) => matchesQuery(tactic.id, TACTIC_SEARCH_TEXT));
  const nothingMatches = !guides.length && !tactics.length;
  const allIds = [...tactics.map((tactic) => tactic.id), ...guides.map((guide) => guide.id)];
  const allOpen = allIds.length > 0 && allIds.every((id) => openIds.has(id));
  const toggle = (id: string, open: boolean) => setOpenIds((current) => {
    const next = new Set(current);
    if (open) next.add(id); else next.delete(id);
    return next;
  });

  const weakest = sort === "recommended"
    ? guides.find((guide) => evidence.get(`${guide.module}|${guide.topic}`))
    : undefined;
  const measured = TECHNIQUE_GUIDES.filter((guide) => evidence.has(`${guide.module}|${guide.topic}`)).length;

  return (
    <>
      <section className="page-heading tricks-heading">
        <div>
          <Pill tone="blue"><Zap size={13} /> ESAT speed lab</Pill>
          <h1>Quick tricks that save real working time.</h1>
          <p>Learn reliable shortcuts, the conditions that make them valid, and the traps that make careless shortcuts fail. Every technique carries a worked example, a safer full method, and the case in which the shortcut stops being safe.</p>
        </div>
        <div className="tricks-count">
          <strong>{TECHNIQUE_GUIDES.length}</strong><span>topic playbooks</span>
          <em>{measured ? `${measured} matched to your results` : "No results recorded yet"}</em>
        </div>
      </section>

      <section className="tricks-playbook" aria-labelledby="decision-loop-title">
        <div className="tricks-playbook-icon"><Zap size={24} /></div>
        <div>
          <span className="eyebrow">The repeatable decision loop</span>
          <h2 id="decision-loop-title">Target → structure → shortcut → check</h2>
          <p>Read what is required, name the governing idea, use the shortest valid route, then spend a few seconds checking sign, units, scale and restrictions. The official pace averages about <strong>89 seconds per question</strong>, so recognition matters as much as calculation.</p>
        </div>
        <Pill tone="neutral">Practice framework · not official advice</Pill>
      </section>

      {weakest ? (
        <section className="tricks-priority">
          <Target size={19} />
          <div>
            <span className="eyebrow">Start here</span>
            <p>
              Your lowest first-attempt accuracy is <strong>{MODULE_LABELS[weakest.module]} · {weakest.topic}</strong>
              {" "}at {evidence.get(`${weakest.module}|${weakest.topic}`)?.label}. Its playbook is first in the list below.
            </p>
          </div>
          <button type="button" className="button button-secondary compact" onClick={() => onPractiseTopic(weakest.module, weakest.topic)}>
            Practise this topic <ChevronRight size={15} />
          </button>
        </section>
      ) : null}

      <section className="tricks-controls" aria-label="Filter quick tricks">
        <div className="segmented">
          <button type="button" className={module === "all" ? "selected" : ""} onClick={() => setModule("all")}>
            All modules <em>{moduleCounts.all ?? 0}</em>
          </button>
          {MODULE_ORDER.map((item) => (
            <button type="button" className={module === item ? "selected" : ""} key={item} onClick={() => setModule(item)}>
              {MODULE_LABELS[item].replace("Mathematics ", "Maths ")} <em>{moduleCounts[item] ?? 0}</em>
            </button>
          ))}
        </div>
        <div className="tricks-tools">
          <label className="tricks-search">
            <Search size={17} />
            <span className="sr-only">Search quick tricks</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
              placeholder="Search methods, examples and traps"
            />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button> : null}
          </label>
          <label className="tricks-sort">
            <span className="sr-only">Order playbooks</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as TrickSort)}>
              <option value="recommended">Weakest topics first</option>
              <option value="module">Module order</option>
              <option value="alphabetical">A to Z</option>
            </select>
          </label>
          <button
            type="button"
            className="button button-secondary compact"
            onClick={() => setOpenIds(allOpen ? new Set() : new Set(allIds))}
            disabled={!allIds.length}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </section>

      {nothingMatches ? (
        <EmptyState
          icon={Search}
          title="Nothing matches that search"
          body="No playbook, method step, worked example or trap contains those words. Try a shorter phrase, or clear the search to browse all techniques."
          action={<button type="button" className="button button-secondary compact" onClick={() => { setQuery(""); setModule("all"); }}>Clear search and filters</button>}
        />
      ) : null}

      {tactics.length ? (
        <section className="tricks-section" aria-labelledby="universal-tricks-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Use across all three modules</span><h2 id="universal-tricks-title">Universal exam moves</h2></div>
            <Pill tone="good"><ShieldCheck size={13} /> Includes limits and cautions</Pill>
          </div>
          <div className="tactic-grid">
            {tactics.map((tactic, index) => (
              <details className="tactic-card" key={tactic.id} open={openIds.has(tactic.id)} onToggle={(event) => toggle(tactic.id, event.currentTarget.open)}>
                <summary>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong><Highlighted text={tactic.title} query={normalizedQuery} /></strong>
                    <small><Highlighted text={tactic.summary} query={normalizedQuery} /></small>
                  </div>
                  <ChevronRight size={17} />
                </summary>
                <div className="tactic-body">
                  <p><strong>Use when:</strong> {tactic.useWhen}</p>
                  <ol>{tactic.method.map((step) => <li key={step}><MathText>{step}</MathText></li>)}</ol>
                  <p className="tactic-caution"><TriangleAlert size={15} /><span>{tactic.caution}</span></p>
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {guides.length ? (
        <section className="tricks-section" aria-labelledby="topic-playbooks-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Best method, fastest route and its limits</span><h2 id="topic-playbooks-title">Topic playbooks</h2></div>
            <span className="tricks-results">{guides.length} of {TECHNIQUE_GUIDES.length} shown</span>
          </div>
          <div className="technique-grid">
            {guides.map((guide) => {
              const record = evidence.get(`${guide.module}|${guide.topic}`);
              return (
                <details
                  className={`technique-card module-${guide.module}`}
                  key={guide.id}
                  open={openIds.has(guide.id)}
                  onToggle={(event) => toggle(guide.id, event.currentTarget.open)}
                >
                  <summary>
                    <div className="technique-card-top">
                      <span className={`module-dot ${guide.module}`} />
                      <small>{MODULE_LABELS[guide.module]} · <Highlighted text={guide.topic} query={normalizedQuery} /></small>
                      {record
                        ? (
                          <span className={`technique-evidence tone-${record.tone}`} title="Your first-attempt accuracy on this topic">
                            {Math.round(record.accuracy * 100)}%<i>/{record.attempted}</i>
                            <span className="sr-only"> first-attempt accuracy across {record.attempted} question{record.attempted === 1 ? "" : "s"}</span>
                          </span>
                        )
                        : <span className="technique-evidence tone-none">Untested</span>}
                    </div>
                    <h3><Highlighted text={guide.title} query={normalizedQuery} /></h3>
                    <p><Highlighted text={guide.principle} query={normalizedQuery} /></p>
                    <span className="technique-open">Open playbook <ChevronRight size={16} /></span>
                  </summary>
                  <div className="technique-body">
                    <div className="technique-methods">
                      <div><span><ShieldCheck size={15} /> Best method</span><ol>{guide.bestMethod.map((step) => <li key={step}><MathText>{step}</MathText></li>)}</ol></div>
                      <div><span><Zap size={15} /> Fastest valid route</span><ul>{guide.fastMethod.map((step) => <li key={step}><MathText>{step}</MathText></li>)}</ul></div>
                    </div>
                    <div className="guide-validity">
                      <strong><ShieldCheck size={15} /> When the fast route is valid</strong>
                      <p><MathText>{guide.validity}</MathText></p>
                    </div>
                    <GuideWorkedExample guide={guide} />
                    <div className="guide-traps"><strong>Common traps</strong>{guide.traps.map((trap) => <span key={trap}>{trap}</span>)}</div>
                    <div className="guide-actions">
                      {record
                        ? <small>Your first attempts on {guide.topic}: {record.label}.</small>
                        : <small>No {guide.topic} question attempted yet.</small>}
                      <button type="button" className="button button-secondary compact" onClick={() => onPractiseTopic(guide.module, guide.topic)}>
                        Practise {guide.topic} <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="integrity-banner tricks-integrity">
        <ShieldCheck size={18} />
        <div><strong>Shortcuts are taught with their validity checks.</strong><span>The live ESAT is calculator-free and has no negative marking. These methods are original ESAT Atlas teaching material reviewed against the published content specification; they are not official UAT-UK advice.</span></div>
      </section>
    </>
  );
}

export function PracticeView({
  state, now, approvedCounts, paperSets, module, setModule, count, setCount, filter, setFilter, timing, setTiming,
  topic, setTopic, topics, paperModule, setPaperModule, paperExam, setPaperExam, paperYear, setPaperYear, onStartPaper, onStart, onExam, onFullMock,
}: {
  state: StoredState;
  now: number;
  approvedCounts: Record<ModuleId, number>;
  paperSets: PaperSet[];
  module: ModuleId;
  setModule: (module: ModuleId) => void;
  count: number;
  setCount: (count: number) => void;
  filter: QuestionFilter;
  setFilter: (filter: QuestionFilter) => void;
  timing: "untimed" | "pace" | "module";
  setTiming: (timing: "untimed" | "pace" | "module") => void;
  topic: string;
  setTopic: (topic: string) => void;
  topics: Array<{ topic: string; count: number }>;
  paperModule: ModuleId;
  setPaperModule: (module: ModuleId) => void;
  paperExam: string;
  setPaperExam: (exam: string) => void;
  paperYear: number | null;
  setPaperYear: (year: number | null) => void;
  onStartPaper: (set: PaperSet) => void;
  onStart: () => void;
  onExam: (module: ModuleId) => void;
  onFullMock: () => void;
}) {
  const modulePapers = paperSets.filter((set) => set.module === paperModule);
  const exams = [...new Set(modulePapers.map((set) => set.sourceExam))].sort();
  const activeExam = exams.includes(paperExam) ? paperExam : exams[0] ?? "";
  const yearSets = modulePapers.filter((set) => set.sourceExam === activeExam).sort((left, right) => right.year - left.year);
  const selected = yearSets.find((set) => set.year === paperYear) ?? yearSets[0] ?? null;
  const previous = selected
    ? state.attempts.filter((attempt) => attemptPaperKey(attempt) === selected.key && attempt.rawScore !== null)
    : [];
  const best = previous.reduce<Attempt | null>((top, attempt) => (!top || (attempt.rawScore ?? 0) > (top.rawScore ?? 0) ? attempt : top), null);
  const bestReport = best ? scoreReportForAttempt(best) : null;

  return (
    <>
      <section className="page-heading">
        <div><span className="eyebrow">Practice and simulation</span><h1>Train with a clear purpose.</h1><p>Sit a complete past paper by year, run a strict simulation, or build a targeted set. Every route records the same evidence.</p></div>
      </section>

      <section className="panel paper-picker">
        <div className="panel-heading">
          <div><span className="eyebrow">Past-paper archive</span><h2>Choose a validated source set</h2></div>
          <Pill tone="blue"><Timer size={13} /> Questions in original order</Pill>
        </div>
        <p className="panel-copy">Nothing is shuffled: each validated source set stays in printed order at the ESAT pace of 40 minutes per 27 questions. Shorter legacy subsets are clearly treated as practice evidence, not complete ESAT modules.</p>
        <div className="picker-grid">
          <fieldset>
            <legend>Module</legend>
            <div className="segmented">
              {MODULE_ORDER.map((item) => (
                <button key={item} className={paperModule === item ? "selected" : ""} onClick={() => { setPaperModule(item); setPaperYear(null); }}>{MODULE_LABELS[item]}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Source</legend>
            <div className="segmented">
              {exams.length
                ? exams.map((exam) => <button key={exam} className={activeExam === exam ? "selected" : ""} onClick={() => { setPaperExam(exam); setPaperYear(null); }}>{exam}</button>)
                : <span className="picker-empty">No papers available</span>}
            </div>
          </fieldset>
          <fieldset className="year-field">
            <legend>Year</legend>
            <div className="year-grid">
              {yearSets.map((set) => {
                const attempts = state.attempts.filter((attempt) => attemptPaperKey(attempt) === set.key && attempt.rawScore !== null).length;
                return (
                  <button key={set.key} className={selected?.key === set.key ? "selected" : ""} onClick={() => setPaperYear(set.year)}>
                    <strong>{set.year}</strong>
                    <small>{set.questionCount} Q</small>
                    {attempts ? <em title={`${attempts} recorded attempt${attempts === 1 ? "" : "s"}`}>{attempts}</em> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        {selected ? (
          <div className="picker-summary">
            <div>
              <strong>{selected.label}</strong>
              <span>{MODULE_LABELS[selected.module]} · {selected.questionCount} questions · {formatDuration(selected.durationMs)} strict</span>
              <small>
                {previous.length
                  ? `${previous.length} recorded attempt${previous.length === 1 ? "" : "s"} · best ${best?.rawScore}/${best?.questionIds.length}${bestReport?.estimate && state.settings.showScoreEstimate ? ` (≈ ${bestReport.estimate.scaledScore.toFixed(1)})` : ""}`
                  : "Not attempted yet — this will be first-exposure evidence."}
              </small>
            </div>
            <button className="button button-primary" onClick={() => onStartPaper(selected)}><Play size={17} /> Sit this paper</button>
          </div>
        ) : null}
      </section>

      <section className="exam-launch-grid">
        <article className="exam-launch primary-launch">
          <div className="launch-copy"><Pill tone="blue"><Timer size={13} /> Strict simulation</Pill><h2>Full Cambridge Engineering mock</h2><p>Mathematics 1 → Physics → Mathematics 2, drawn fresh from the archive. Three separately timed 40-minute modules; unused time never transfers.</p></div>
          <div className="launch-meta"><span>81 questions</span><span>120 minutes</span><span>No pause</span></div>
          <button className="button button-light" onClick={onFullMock}><Play size={17} /> Begin full mock</button>
          {approvedCounts.maths2 < 27 ? <div className="launch-warning"><TriangleAlert size={15} /> Locked until {27 - approvedCounts.maths2} Mathematics 2 candidates are reviewed.</div> : null}
        </article>
        <article className="panel single-module-launch">
          <span className="eyebrow">Single strict module</span><h2>27 questions · 40 minutes</h2>
          <div className="module-launch-buttons">
            {MODULE_ORDER.map((item) => (
              <button key={item} disabled={approvedCounts[item] < 27} onClick={() => onExam(item)}><span className={`module-dot ${item}`} />{MODULE_LABELS[item]}<ChevronRight size={16} /></button>
            ))}
          </div>
        </article>
      </section>

      <section className="panel builder-panel">
        <div className="panel-heading"><div><span className="eyebrow">Custom practice builder</span><h2>Shape a focused session</h2></div><Pill tone="good"><Check size={13} /> Pause and confidence enabled</Pill></div>
        <div className="builder-grid">
          <fieldset><legend>Module</legend><div className="segmented">{MODULE_ORDER.map((item) => <button className={module === item ? "selected" : ""} key={item} onClick={() => { setModule(item); setTopic(""); }}>{MODULE_LABELS[item]}</button>)}</div></fieldset>
          <fieldset><legend>Topic</legend><select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">Every topic</option>{topics.map((item) => <option key={item.topic} value={item.topic}>{item.topic} ({item.count})</option>)}</select></fieldset>
          <fieldset><legend>Question count</legend><div className="segmented compact-segments">{[5, 10, 15, 20, 27].map((item) => <button className={count === item ? "selected" : ""} key={item} onClick={() => setCount(item)}>{item}</button>)}</div></fieldset>
          <fieldset><legend>Question state</legend><select value={filter} onChange={(event) => setFilter(event.target.value as QuestionFilter)}><option value="unseen">Fresh / unseen</option><option value="incorrect">Incorrect, not mastered</option><option value="due">Due for retrieval</option><option value="all">All approved</option></select></fieldset>
          <fieldset><legend>Timing</legend><select value={timing} onChange={(event) => setTiming(event.target.value as typeof timing)}><option value="untimed">Untimed</option><option value="pace">ESAT pace (~89 sec/question)</option><option value="module">40-minute cap</option></select></fieldset>
        </div>
        <div className="builder-summary"><div><Filter size={18} /><span><strong>{MODULE_LABELS[module]}{topic ? ` · ${topic}` : ""}</strong>{count} questions · {filter} · {timing}</span></div><button className="button button-primary" onClick={onStart}><Play size={17} /> Build session</button></div>
      </section>

      <section className="mode-comparison">
        <div><ShieldCheck size={18} /><span><strong>Exam readiness</strong>First exposure, strict timing, no feedback during the test.</span></div>
        <div><Brain size={18} /><span><strong>Mastery</strong>Retries, confidence, notes and spaced retrieval. Never blended into readiness.</span></div>
        <div><Clock3 size={18} /><span><strong>Your current queue</strong>{Object.values(state.mistakes).filter((item) => item.dueDate <= now).length} due today.</span></div>
      </section>
    </>
  );
}

export function OriginalMocksView({ payload, attempts, showScoreEstimate, onStart, onFull, onOpenAttempt }: {
  payload: MockPayload;
  attempts: Attempt[];
  showScoreEstimate: boolean;
  onStart: (module: ModuleId) => void;
  onFull: () => void;
  onOpenAttempt: (attemptId: string) => void;
}) {
  const completed = attempts.filter((attempt) => attempt.mode === "original" && attempt.rawScore !== null);
  return (
    <>
      <section className="page-heading">
        <div>
          <Pill tone="blue"><Sparkles size={13} /> Original challenge material</Pill>
          <h1>A harder buffer, in the real module rhythm.</h1>
          <p>Three original 27-question modules follow the 2026 specification and 40-minute structure. They provide a deliberate stretch buffer and are never presented as official UAT-UK questions or used to infer cohort standing.</p>
        </div>
        <button className="button button-primary" onClick={onFull}><Play size={17} /> Start full 120-minute mock</button>
      </section>
      <div className="integrity-banner original-integrity">
        <ShieldCheck size={18} />
        <div>
          <strong>81 distinct designs, checked answers, zero number-swapped copies</strong>
          <span>{payload.summary.distinctArchetypes} different reasoning archetypes cover every top-level specification area and passed structural, option and answer-key checks. Results report exact raw marks and topic evidence, without an uncalibrated percentile claim.</span>
        </div>
      </div>
      <section className="original-grid">
        {MODULE_ORDER.map((module) => {
          const moduleAttempts = completed.filter((attempt) => attempt.module === module);
          const latest = moduleAttempts[0];
          const best = moduleAttempts.reduce<Attempt | null>((top, attempt) => (!top || (attempt.rawScore ?? 0) > (top.rawScore ?? 0) ? attempt : top), null);
          return (
            <article className={`original-card ${module}`} key={module}>
              <div className="original-card-head"><span className={`module-dot ${module}`} /><Pill tone="neutral">Challenge Mock A</Pill></div>
              <h2>{MODULE_LABELS[module]}</h2>
              <p>27 structurally distinct questions · 40 minutes · no calculator · no negative marking.</p>
              <div className="original-score">
                <span>Latest / best</span>
                <strong>{latest ? `${latest.rawScore}/27` : "Not attempted"}{best && latest && best.attemptId !== latest.attemptId ? ` · best ${best.rawScore}/27` : ""}</strong>
                {best && showScoreEstimate ? <small>Challenge evidence · no cohort estimate</small> : null}
              </div>
              <div className="original-actions">
                <button className="button button-secondary" onClick={() => onStart(module)}>Start strict module <ChevronRight size={16} /></button>
                {latest ? <button className="text-button" onClick={() => onOpenAttempt(latest.attemptId)}>View breakdown</button> : null}
              </div>
            </article>
          );
        })}
      </section>
      <section className="panel challenge-method">
        <div><span className="eyebrow">How to use it</span><h2>Treat the difficulty as a training buffer, not a forecast.</h2></div>
        <div className="method-steps"><span><strong>1</strong> Sit it fresh and strict</span><span><strong>2</strong> Diagnose every lost mark</span><span><strong>3</strong> Confirm on archive papers</span></div>
      </section>
    </>
  );
}

const TAG_TREND_COPY: Record<ErrorTagRow["trend"], { label: string; tone: "neutral" | "good" | "warn" | "bad" | "blue" }> = {
  rising: { label: "Rising", tone: "bad" },
  falling: { label: "Easing", tone: "good" },
  steady: { label: "Steady", tone: "neutral" },
  new: { label: "New", tone: "warn" },
  "insufficient data": { label: "Too few", tone: "neutral" },
};

/**
 * The causes a candidate has recorded against their own mistakes. This is the one view
 * built from self-reported data, so it is labelled as a diagnosis rather than a
 * measurement, and it says plainly how much of the evidence is still untagged.
 */
export function ErrorCausesPanel({ attempts, questionMap }: { attempts: Attempt[]; questionMap: Record<string, Question> }) {
  const summary = useMemo(() => errorTagSummary(attempts, questionMap), [attempts, questionMap]);
  const diagnosed = summary.taggedResponses + summary.untaggedResponses;
  const coverage = diagnosed ? summary.taggedResponses / diagnosed : 0;

  return (
    <article className="panel wide-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Mistake causes</span><h2>What actually costs you marks</h2></div>
        <Pill tone="neutral">Your own diagnosis</Pill>
      </div>
      {summary.rows.length ? (
        <>
          <p className="panel-copy">
            You have diagnosed <strong>{summary.taggedResponses}</strong> of your <strong>{diagnosed}</strong> missed
            question{diagnosed === 1 ? "" : "s"}{summary.leading ? <> — most often <strong>{summary.leading.tag}</strong></> : null}.
            One mistake can have several causes, so the shares below overlap.
          </p>
          <div className="cause-list">
            {summary.rows.map((row) => {
              const trend = TAG_TREND_COPY[row.trend];
              const modules = MODULE_ORDER.filter((module) => row.modules[module] > 0);
              return (
                <div className="cause-row" key={row.tag}>
                  <span className="cause-name">
                    <strong>{row.tag}</strong>
                    <small>{row.topTopics.length ? row.topTopics.map((item) => item.topic).join(" · ") : "No topic recorded"}</small>
                  </span>
                  <span className="cause-bar">
                    <i><b style={{ width: `${Math.max(2, Math.round(row.share * 100))}%` }} /></i>
                  </span>
                  <span className="cause-count">
                    <strong>{row.count}</strong>
                    <small>{Math.round(row.share * 100)}%</small>
                  </span>
                  <span className="cause-modules" aria-label={modules.length ? `Seen in ${modules.map((module) => MODULE_LABELS[module]).join(", ")}` : "No module recorded"}>
                    {modules.map((module) => <i className={`module-dot ${module}`} key={module} title={`${MODULE_LABELS[module]}: ${row.modules[module]}`} />)}
                  </span>
                  <Pill tone={trend.tone}>{trend.label}</Pill>
                </div>
              );
            })}
          </div>
          {summary.untaggedResponses ? (
            <p className="panel-footnote">
              {summary.untaggedResponses} missed question{summary.untaggedResponses === 1 ? " has" : "s have"} no cause
              recorded ({Math.round(coverage * 100)}% diagnosed). Tag them on a result screen to sharpen this picture.
            </p>
          ) : (
            <p className="panel-footnote">Every missed question has a recorded cause. Causes are self-reported, so they guide revision rather than measure attainment.</p>
          )}
        </>
      ) : (
        <EmptyState
          icon={Brain}
          title={diagnosed ? "No causes recorded yet" : "No missed questions yet"}
          body={diagnosed
            ? `You have ${diagnosed} missed question${diagnosed === 1 ? "" : "s"} with no diagnosis. After a session, open "Confirm why each mark was lost" and tag each one — this panel then shows which causes actually repeat.`
            : "Once a session records a missed question, tag why the mark was lost and the recurring causes will be summarised here."}
        />
      )}
    </article>
  );
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Only alternate rows are labelled; seven labels in that space are unreadable. */
const LABELLED_WEEKDAYS = new Set([0, 2, 4]);

function heatmapCellLabel(day: StudyDay): string {
  const date = LONG_DATE_FORMAT.format(day.dayStart);
  if (!day.sessions) return `${date}: no recorded study`;
  return `${date}: ${formatLongDuration(day.studyMs)} across ${day.sessions} session${day.sessions === 1 ? "" : "s"} and ${day.questions} question${day.questions === 1 ? "" : "s"}`;
}

/** Study habit, kept visually and conceptually separate from attainment. */
export function StudyConsistencyPanel({ activity }: { activity: StudyActivity }) {
  const streakNote = activity.currentStreak === 0
    ? "Record any completed session today to start a streak."
    : activity.studiedToday
      ? "Today is already recorded."
      : "Yesterday is recorded — study today to keep the streak alive.";

  return (
    <section className="panel study-consistency">
      <div className="panel-heading">
        <div><span className="eyebrow">Study consistency</span><h2>Every day you completed a session</h2></div>
        <Pill tone="neutral">Habit, not attainment</Pill>
      </div>
      <div className="streak-strip">
        <div><span>Current streak</span><strong>{activity.currentStreak}<small>day{activity.currentStreak === 1 ? "" : "s"}</small></strong></div>
        <div><span>Longest streak</span><strong>{activity.longestStreak}<small>day{activity.longestStreak === 1 ? "" : "s"}</small></strong></div>
        <div><span>Days studied</span><strong>{activity.activeDays}</strong></div>
        <div><span>Recorded time</span><strong>{formatLongDuration(activity.totalStudyMs)}</strong></div>
      </div>
      <p className="panel-copy streak-note">{streakNote}{activity.busiestDay ? ` Your heaviest day was ${formatLongDuration(activity.busiestDay.studyMs)}.` : ""}</p>

      <div className="heatmap-frame">
        <div className="heatmap-scroll">
          <div className="heatmap-months" aria-hidden="true">
            {activity.weeks.map((week) => <span key={week.key}>{week.monthLabel ?? ""}</span>)}
          </div>
          <div className="heatmap-body">
            <div className="heatmap-weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => <span key={label}>{LABELLED_WEEKDAYS.has(index) ? label : ""}</span>)}
            </div>
            <div className="heatmap-grid" role="img" aria-label={`Study calendar for the last ${Math.round(activity.windowDays / 7)} weeks: ${activity.activeDaysInWindow} active days, current streak ${activity.currentStreak} days`}>
              {activity.weeks.map((week) => (
                <div className="heatmap-week" key={week.key}>
                  {week.days.map((day, index) => (
                    day
                      ? <i key={day.dayKey} className={`heatmap-cell level-${day.level}`} title={heatmapCellLabel(day)} />
                      : <i key={`${week.key}-gap-${index}`} className="heatmap-cell heatmap-cell-empty" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span>{activity.activeDaysInWindow} active day{activity.activeDaysInWindow === 1 ? "" : "s"} shown</span>
        <div aria-hidden="true">
          <small>Less</small>
          {[0, 1, 2, 3, 4].map((level) => <i className={`heatmap-cell level-${level}`} key={level} />)}
          <small>More</small>
        </div>
      </div>
      <p className="panel-footnote">A day counts once a session is submitted with recorded time. Shading steps at 15, 30 and 60 minutes, so a light week never looks like a heavy one.</p>
    </section>
  );
}

/**
 * Per-question time for the session just submitted. Bars are scaled against the ESAT
 * reference pace so the marker means the same thing on every result, and each bar is
 * coloured by outcome: time only matters alongside whether the mark was won.
 */
export function QuestionTimingPanel({ attempt, questionMap }: { attempt: Attempt; questionMap: Record<string, Question> }) {
  const rows = attempt.questionIds
    .map((id, index) => ({ id, index, response: attempt.responses[id], question: questionMap[id] }))
    .filter((row) => Boolean(row.response));
  if (!rows.length) return null;

  const target = esatPacedDurationMs(1);
  const slowest = Math.max(...rows.map((row) => row.response.timeSpentMs));
  // Keep the reference marker inside the track even when every question was quick.
  const scale = Math.max(slowest, target * 1.25);
  const overTarget = rows.filter((row) => row.response.timeSpentMs > target).length;
  const fastest = rows.reduce((best, row) => (row.response.timeSpentMs < best.response.timeSpentMs ? row : best), rows[0]);
  const longest = rows.reduce((worst, row) => (row.response.timeSpentMs > worst.response.timeSpentMs ? row : worst), rows[0]);

  return (
    <section className="panel question-timing">
      <div className="panel-heading">
        <div><span className="eyebrow">Time per question</span><h2>Where your {formatLongDuration(attempt.durationMs ?? 0)} went</h2></div>
        <Pill tone="neutral">Reference {formatSeconds(target)}</Pill>
      </div>
      <p className="panel-copy">
        {rows.length === 1 ? (
          // Naming a quickest and a longest question is meaningless for a set of one,
          // which is exactly what a single-question retry from the mistakes queue is.
          <>
            You spent <strong>{formatSeconds(rows[0].response.timeSpentMs)}</strong> on this question, against the
            {" "}{formatSeconds(target)} the real ESAT allows on average.
          </>
        ) : (
          <>
            {overTarget} of {rows.length} questions ran past the {formatSeconds(target)} ESAT reference.
            Quickest was Q{fastest.index + 1} at {formatSeconds(fastest.response.timeSpentMs)}; longest was
            Q{longest.index + 1} at {formatSeconds(longest.response.timeSpentMs)}.
          </>
        )}
      </p>
      <ol className="timing-list" style={{ ["--pace-marker" as string]: `${(target / scale) * 100}%` }}>
        {rows.map((row) => {
          const { response, question } = row;
          const tone = response.correct ? "good" : response.unanswered ? "neutral" : "bad";
          const outcome = response.correct ? "Correct" : response.unanswered ? "Blank" : "Wrong";
          return (
            <li className="timing-row" key={row.id}>
              <span className="timing-index">{row.index + 1}</span>
              <span className="timing-track">
                <i
                  className={`timing-bar bar-${tone}`}
                  style={{ width: `${Math.max(1.5, (response.timeSpentMs / scale) * 100)}%` }}
                />
              </span>
              <span className="timing-value">{formatSeconds(response.timeSpentMs)}</span>
              <span className="timing-outcome">
                <Pill tone={tone}>{outcome}</Pill>
                <small>{question?.esatTopic ?? "—"}</small>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="panel-footnote">
        The dashed line marks the {formatSeconds(target)} average the real ESAT allows (40 minutes for 27 questions).
        Individual questions are meant to vary around it; a run of long, wrong answers is the signal worth acting on.
      </p>
    </section>
  );
}

export function AnalyticsView({ attempts, questionMap, showScoreEstimate, now }: { attempts: Attempt[]; questionMap: Record<string, Question>; showScoreEstimate: boolean; now: number }) {
  const completed = attempts.filter((attempt) => attempt.rawScore !== null);
  const allResponses = completed.flatMap((attempt) => Object.values(attempt.responses));
  const fresh = allResponses.filter((response) => response.firstExposure);
  const retakes = allResponses.filter((response) => !response.firstExposure);
  // "Readiness evidence" has to mean the same thing here as it does on the dashboard and
  // on every result screen, so this uses the shared predicate rather than a looser local
  // one that would admit repeated or non-representative strict sets.
  const strict = completed.filter(isReadinessEvidence);
  const topicRows = sectionBreakdown(allResponses, questionMap);
  const changed = allResponses.filter((response) => response.firstSelectedAnswer && response.finalAnswer && response.firstSelectedAnswer !== response.finalAnswer);
  const changedToCorrect = changed.filter((response) => response.correct).length;
  const confidenceRows = (["High", "Medium", "Low", "Guess"] as const).map((level) => {
    const items = allResponses.filter((response) => response.confidence === level);
    return { level, total: items.length, accuracy: items.length ? items.filter((item) => item.correct).length / items.length : null };
  }).filter((row) => row.total > 0);
  const timeBuckets = [
    { label: "<30s", min: 0, max: 30_000 },
    { label: "30–60s", min: 30_000, max: 60_000 },
    { label: "60–90s", min: 60_000, max: 90_000 },
    { label: "90–120s", min: 90_000, max: 120_000 },
    { label: "2–3m", min: 120_000, max: 180_000 },
    { label: "3m+", min: 180_000, max: Infinity },
  ].map((bucket) => ({ ...bucket, responses: allResponses.filter((response) => response.timeSpentMs >= bucket.min && response.timeSpentMs < bucket.max) }));
  const activity = useMemo(() => studyActivity(attempts, now), [attempts, now]);

  return (
    <>
      <section className="page-heading"><div><span className="eyebrow">Performance analytics</span><h1>Evidence before interpretation.</h1><p>Every figure below is built only from your recorded attempts. Nothing is simulated or filled in.</p></div></section>
      {!completed.length ? <EmptyState icon={BarChart3} title="Not enough data yet" body="Analytics will appear after your first completed session. No placeholder or fabricated chart is shown." /> : (
        <>
          <section className="analytics-summary">
            <article><span>Fresh accuracy</span><strong>{percent(fresh.length ? fresh.filter((item) => item.correct).length / fresh.length : null)}</strong><small>{fresh.length} first exposures</small></article>
            <article><span>Retake accuracy</span><strong>{percent(retakes.length ? retakes.filter((item) => item.correct).length / retakes.length : null)}</strong><small>{retakes.length} repeated attempts</small></article>
            <article><span>Study volume</span><strong>{allResponses.length}</strong><small>question responses</small></article>
            <article><span>Strict modules</span><strong>{strict.length}</strong><small>readiness evidence</small></article>
          </section>
          <StudyConsistencyPanel activity={activity} />
          <section className="analytics-grid">
            <article className="panel wide-panel">
              <div className="panel-heading"><div><span className="eyebrow">Fresh score trend</span><h2>Strict modules</h2></div>{showScoreEstimate ? <Pill tone="neutral">Bars show raw marks</Pill> : null}</div>
              {strict.length ? (
                <div className="large-trend">
                  {strict.slice(0, 16).reverse().map((attempt) => (
                    <div key={attempt.attemptId} className="trend-column">
                      <div className={`trend-bar ${attempt.module}`} style={{ height: `${attemptAccuracyPercent(attempt)}%` }} title={`${attemptTitle(attempt)} · ${formatDate(attempt.endedAt)}`} />
                      <span>{attempt.rawScore}</span>
                      <small>{MODULE_LABELS[attempt.module].replace("Mathematics ", "M")}</small>
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon={Activity} title="No strict modules" body="Practice results are deliberately excluded from this readiness chart." />}
            </article>
            <ErrorCausesPanel attempts={completed} questionMap={questionMap} />
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">Fresh vs repeated</span><h2>Learning separation</h2></div></div>
              <div className="comparison-bars">
                <div><span>Fresh</span><i><b style={{ width: `${fresh.length ? fresh.filter((item) => item.correct).length / fresh.length * 100 : 0}%` }} /></i><strong>{percent(fresh.length ? fresh.filter((item) => item.correct).length / fresh.length : null)}</strong></div>
                <div><span>Retake</span><i><b style={{ width: `${retakes.length ? retakes.filter((item) => item.correct).length / retakes.length * 100 : 0}%` }} /></i><strong>{percent(retakes.length ? retakes.filter((item) => item.correct).length / retakes.length : null)}</strong></div>
              </div>
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">Time distribution</span><h2>Accuracy by pace</h2></div></div>
              <div className="bucket-list">{timeBuckets.map((bucket) => <div key={bucket.label}><span>{bucket.label}</span><i><b style={{ width: `${allResponses.length ? bucket.responses.length / allResponses.length * 100 : 0}%` }} /></i><strong>{bucket.responses.length ? `${Math.round(bucket.responses.filter((item) => item.correct).length / bucket.responses.length * 100)}%` : "—"}</strong></div>)}</div>
            </article>
            {changed.length ? (
              <article className="panel">
                <div className="panel-heading"><div><span className="eyebrow">Second thoughts</span><h2>When you change an answer</h2></div></div>
                <p className="panel-copy">You changed your first answer on <strong>{changed.length}</strong> question{changed.length === 1 ? "" : "s"}. Those changes ended up correct <strong>{Math.round(changedToCorrect / changed.length * 100)}%</strong> of the time.</p>
                <p className="panel-footnote">{changedToCorrect / changed.length >= 0.5 ? "Your revisions are net positive — keep trusting a checked second look." : "Your revisions are net negative — only change an answer when you can name the error in the first one."}</p>
              </article>
            ) : null}
            {confidenceRows.length ? (
              <article className="panel">
                <div className="panel-heading"><div><span className="eyebrow">Calibration</span><h2>Confidence against outcome</h2></div></div>
                <div className="bucket-list">{confidenceRows.map((row) => <div key={row.level}><span>{row.level}</span><i><b style={{ width: `${(row.accuracy ?? 0) * 100}%` }} /></i><strong>{percent(row.accuracy)}</strong></div>)}</div>
              </article>
            ) : null}
            <article className="panel wide-panel">
              <div className="panel-heading"><div><span className="eyebrow">Specification heatmap</span><h2>Topic evidence, weakest first</h2></div></div>
              <SectionTable rows={topicRows} />
            </article>
          </section>
        </>
      )}
    </>
  );
}

export function MistakesView({ state, now, questionMap, onRetry, onRedo, onNote, scope, setScope, module, setModule, timed, setTimed }: {
  state: StoredState;
  now: number;
  questionMap: Record<string, Question>;
  onRetry: (question: Question) => void;
  onRedo: () => void;
  onNote: (id: string, note: string) => void;
  scope: "all" | "due";
  setScope: (scope: "all" | "due") => void;
  module: ModuleId;
  setModule: (module: ModuleId) => void;
  timed: boolean;
  setTimed: (timed: boolean) => void;
}) {
  // A queued item whose question has left the bank cannot be shown or retried, so it must
  // not be counted either; otherwise the headline totals promise work the list never offers.
  const queued = Object.values(state.mistakes).sort((left, right) => left.dueDate - right.dueDate);
  const items = queued.filter((item) => questionMap[item.questionId]);
  const unavailable = queued.length - items.length;
  // A correct answer clears the question out of the queue entirely, so everything left
  // is unresolved: either ready to redo now, or waiting for its overnight delay.
  const dueItems = items.filter((item) => item.dueDate <= now);
  const scheduledItems = items.filter((item) => item.dueDate > now);
  const outstanding = items.length;
  const nextDue = items[0] ?? null;
  const cleared = Object.values(state.progress).filter((item) => item.mastered).length;
  const countFor = (target: ModuleId, targetScope: "all" | "due") => items.filter((item) => {
    const question = questionMap[item.questionId];
    if (!question || question.targetModule !== target) return false;
    return targetScope === "all" || item.dueDate <= now;
  }).length;
  const selectedCount = countFor(module, scope);

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">Spaced retrieval</span>
          <h1>Mistakes become scheduled work.</h1>
          <p>Every question you get wrong comes back once, the next day. Answer it correctly and it clears for good; get it wrong again and it returns tomorrow, so nothing unresolved is quietly dropped.</p>
        </div>
      </section>

      <section className="metric-strip">
        <div><Brain size={18} /><span>Still to resolve<strong>{outstanding} question{outstanding === 1 ? "" : "s"}</strong></span></div>
        <div><RotateCcw size={18} /><span>Ready to redo<strong>{dueItems.length}</strong></span></div>
        <div><CheckCircle2 size={18} /><span>Cleared<strong>{cleared}</strong></span></div>
        <div><Clock3 size={18} /><span>Next return<strong>{nextDue ? formatDate(nextDue.dueDate) : "—"}</strong></span></div>
      </section>

      {unavailable ? (
        <div className="integrity-banner">
          <TriangleAlert size={18} />
          <div>
            <strong>{unavailable} queued question{unavailable === 1 ? " is" : "s are"} no longer in the validated bank.</strong>
            <span>They are excluded from the counts above and cannot be retried. They will be dropped automatically if the archive restores them under a new identifier.</span>
          </div>
        </div>
      ) : null}

      {items.length ? (
        <section className="panel redo-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Redo session</span><h2>Work through your mistakes again</h2></div>
            <Pill tone="neutral">Never counted as readiness evidence</Pill>
          </div>
          <div className="redo-grid">
            <fieldset>
              <legend>Which mistakes</legend>
              <div className="segmented">
                <button className={scope === "all" ? "selected" : ""} onClick={() => setScope("all")}>Everything unresolved</button>
                <button className={scope === "due" ? "selected" : ""} onClick={() => setScope("due")}>Ready to redo only</button>
              </div>
            </fieldset>
            <fieldset>
              <legend>Module</legend>
              <div className="segmented">
                {MODULE_ORDER.map((item) => (
                  <button key={item} className={module === item ? "selected" : ""} onClick={() => setModule(item)}>
                    {MODULE_LABELS[item].replace("Mathematics ", "Maths ")}
                    <em>{countFor(item, scope)}</em>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Conditions</legend>
              <div className="segmented">
                <button className={!timed ? "selected" : ""} onClick={() => setTimed(false)}>Untimed, with pause</button>
                <button className={timed ? "selected" : ""} onClick={() => setTimed(true)}>Timed at ESAT pace</button>
              </div>
            </fieldset>
          </div>
          <div className="redo-summary">
            <div>
              <strong>{selectedCount} question{selectedCount === 1 ? "" : "s"} · {MODULE_LABELS[module]}</strong>
              <span>
                {scope === "all" ? "Everything still unresolved, whether or not it has come back yet" : "Only what has come back so far"}
                {timed ? ` · ${formatDuration(esatPacedDurationMs(selectedCount))} strict, no pause` : " · untimed, pause allowed"}
              </span>
            </div>
            <button className="button button-primary" onClick={onRedo} disabled={!selectedCount}>
              <RotateCcw size={17} /> Redo {selectedCount || "these"}
            </button>
          </div>
        </section>
      ) : null}
      {!items.length ? <EmptyState icon={Brain} title="No mistakes in the queue" body="Anything you answer incorrectly returns here the next day. One correct answer clears it." /> : (
        <>
          <MistakeGroup
            title="Due now"
            caption="Ready to redo. Answer one correctly and it clears for good."
            tone="bad"
            items={dueItems}
            state={state}
            now={now}
            questionMap={questionMap}
            onRetry={onRetry}
            onNote={onNote}
            emptyBody={outstanding ? "Nothing is ready yet. Everything still to resolve returns tomorrow." : undefined}
          />
          <MistakeGroup
            title="Returns tomorrow"
            caption="Missed today, so they wait overnight before coming back — a redo straight away would test memory rather than recall."
            tone="neutral"
            items={scheduledItems}
            state={state}
            now={now}
            questionMap={questionMap}
            onRetry={onRetry}
            onNote={onNote}
          />
        </>
      )}
    </>
  );
}

/** One state of the retrieval queue: ready to redo now, or waiting overnight. */
function MistakeGroup({ title, caption, tone, items, state, now, questionMap, onRetry, onNote, emptyBody }: {
  title: string;
  caption: string;
  tone: "bad" | "neutral" | "good";
  items: MistakeItem[];
  state: StoredState;
  now: number;
  questionMap: Record<string, Question>;
  onRetry: (question: Question) => void;
  onNote: (id: string, note: string) => void;
  emptyBody?: string;
}) {
  if (!items.length && !emptyBody) return null;
  return (
    <section className="mistake-group">
      <div className="mistake-group-head">
        <h2>{title}<Pill tone={tone}>{items.length}</Pill></h2>
        <p>{caption}</p>
      </div>
      {items.length ? (
        <div className="mistake-list">
          {items.map((item) => {
            const question = questionMap[item.questionId];
            const due = item.dueDate <= now;
            return (
              <article className="mistake-card" key={item.questionId}>
                {question.questionImage
                  ? <img src={publicAsset(question.questionImage)} alt={`${question.sourceExam} ${question.year} question ${question.originalQuestionNumber}`} loading="lazy" />
                  : <div className="mistake-text-preview"><div><MathText>{question.questionText}</MathText><QuestionFigure question={question} /></div></div>}
                <div className="mistake-copy">
                  <div>
                    <Pill tone={due ? "bad" : "neutral"}>{due ? "Ready to redo" : `Returns ${formatDate(item.dueDate)}`}</Pill>
                    <Pill tone="blue">{MODULE_LABELS[question.targetModule]}</Pill>
                  </div>
                  <h3>{question.esatTopic} · {sourceLabel(question)}</h3>
                  <p>
                    Answer this correctly once and it clears for good.
                    {due ? "" : ` It returns on ${formatDate(item.dueDate)}, or redo it now.`}
                  </p>
                  <textarea value={state.notes[item.questionId] ?? ""} onChange={(event) => onNote(item.questionId, event.target.value)} placeholder="Personal note, e.g. remember the sign convention…" aria-label={`Note for ${sourceLabel(question)}`} />
                  <button className="button button-secondary compact" onClick={() => onRetry(question)}><RotateCcw size={15} /> Retry question</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mistake-group-empty">{emptyBody}</p>
      )}
    </section>
  );
}

export function PaperHistoryView({ state, paperSets, filter, setFilter, showScoreEstimate, onStart, onOpenAttempt }: {
  state: StoredState;
  paperSets: PaperSet[];
  filter: HistoryFilter;
  setFilter: (filter: HistoryFilter) => void;
  showScoreEstimate: boolean;
  onStart: (set: PaperSet) => void;
  onOpenAttempt: (attemptId: string) => void;
}) {
  const completed = state.attempts.filter((attempt) => attempt.rawScore !== null);
  const visible = completed.filter((attempt) => filter === "all" || attemptKind(attempt) === filter);
  const paperAttempts = completed.filter((attempt) => attempt.mode === "historic");
  const bestByPaper = new Map<string, Attempt>();
  for (const attempt of paperAttempts) {
    const key = attemptPaperKey(attempt);
    if (!key) continue;
    const current = bestByPaper.get(key);
    if (!current || (attempt.rawScore ?? 0) > (current.rawScore ?? 0)) bestByPaper.set(key, attempt);
  }
  const filters: Array<{ id: HistoryFilter; label: string }> = [
    { id: "all", label: `All (${completed.length})` },
    { id: "paper", label: `Past papers (${completed.filter((attempt) => attemptKind(attempt) === "paper").length})` },
    { id: "original", label: `Original mocks (${completed.filter((attempt) => attemptKind(attempt) === "original").length})` },
    { id: "strict", label: `Strict modules (${completed.filter((attempt) => attemptKind(attempt) === "strict").length})` },
    { id: "practice", label: `Practice (${completed.filter((attempt) => attemptKind(attempt) === "practice").length})` },
    { id: "retrieval", label: `Retrieval (${completed.filter((attempt) => attemptKind(attempt) === "retrieval").length})` },
  ];

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">Result history</span>
          <h1>Every completion keeps its paper, score and breakdown.</h1>
          <p>You have completed {completed.length} recorded session{completed.length === 1 ? "" : "s"}, including {paperAttempts.length} timed archive paper{paperAttempts.length === 1 ? "" : "s"}. Open any result for section-level analysis.</p>
        </div>
        <Pill tone="good"><Timer size={13} /> 40 min / 27-question ESAT pace</Pill>
      </section>

      {completed.length ? (
        <>
          {/* Toggle buttons, not tabs: there is no tabpanel to own, and the list below
              is filtered in place rather than swapped for another panel. */}
          <div className="history-filters" role="group" aria-label="Filter results">
            {filters.map((item) => (
              <button key={item.id} type="button" aria-pressed={filter === item.id} className={filter === item.id ? "selected" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>
            ))}
          </div>
          {visible.length ? (
            <section className="panel history-list">
              <div className="history-row header-row">
                <span>Set</span><span>Module</span><span>Completed</span><span>Raw</span><span>Accuracy</span><span>{showScoreEstimate ? "Estimate" : "Time"}</span><span>Evidence</span><span />
              </div>
              {visible.map((attempt) => {
                const report = scoreReportForAttempt(attempt);
                return (
                  <div className="history-row" key={attempt.attemptId}>
                    <span className="history-set"><strong>{attemptTitle(attempt)}</strong><small>{KIND_LABELS[attemptKind(attempt)]}{attempt.completionStatus === "timed-out" ? " · timed out" : ""}</small></span>
                    <span><span className={`module-dot ${attempt.module}`} />{MODULE_LABELS[attempt.module]}</span>
                    <span>{formatDate(attempt.endedAt)}</span>
                    <strong>{attempt.rawScore}/{attempt.questionIds.length}</strong>
                    <span>{Math.round(report.accuracy * 100)}%</span>
                    <span>{showScoreEstimate ? (report.estimate?.scaledScore.toFixed(1) ?? "—") : formatLongDuration(attempt.durationMs ?? 0)}</span>
                    <Pill tone={report.estimate?.tone ?? "neutral"}>{showScoreEstimate ? (report.estimate?.standing ?? "Raw only") : report.label}</Pill>
                    <button onClick={() => onOpenAttempt(attempt.attemptId)}>Breakdown <ChevronRight size={15} /></button>
                  </div>
                );
              })}
            </section>
          ) : (
            <EmptyState icon={LibraryBig} title="Nothing in this filter yet" body="Switch filters, or sit a paper from the library below." />
          )}
        </>
      ) : (
        <EmptyState icon={LibraryBig} title="No completed sessions yet" body="Complete a source set to see its exact mark and breakdown. Representative fresh strict sets also receive a clearly labelled proxy estimate." />
      )}

      <div className="integrity-banner">
        <TriangleAlert size={18} />
        <div>
          <strong>Raw marks are exact; small sets, retries and repeated material are never converted.</strong>
          <span>UAT-UK equates live forms and does not publish raw conversion tables. The optional proxy is therefore restricted to at least 18 fully fresh questions under strict timing.</span>
        </div>
      </div>

      <section className="panel paper-library">
        <div className="panel-heading"><div><span className="eyebrow">Source-set library</span><h2>Every paper you can sit</h2></div></div>
        <div className="paper-library-row header-row"><span>Source</span><span>Year / set</span><span>Module</span><span>Questions / cap</span><span>Attempts</span><span>Your best</span><span /></div>
        {paperSets.map((set) => {
          const attempts = paperAttempts.filter((attempt) => attemptPaperKey(attempt) === set.key);
          const best = bestByPaper.get(set.key);
          const report = best ? scoreReportForAttempt(best) : null;
          return (
            <div className="paper-library-row" key={set.key}>
              <strong>{set.sourceExam}</strong>
              <span>{set.year}<small>{set.sectionLabel}</small></span>
              <span>{MODULE_LABELS[set.module]}</span>
              <span>{set.questionCount}<small>{formatDuration(set.durationMs)} strict</small></span>
              <strong>{attempts.length}</strong>
              <strong>{best ? `${best.rawScore}/${best.questionIds.length}` : "—"}{report?.estimate && showScoreEstimate ? <small>≈ {report.estimate.scaledScore.toFixed(1)}</small> : null}</strong>
              <button onClick={() => onStart(set)}>{attempts.length ? "Re-sit" : "Open timed set"} <ChevronRight size={15} /></button>
            </div>
          );
        })}
      </section>

      <section className="panel benchmark-panel">
        <div className="panel-heading"><div><span className="eyebrow">Cambridge Engineering · 2025 cycle</span><h2>Published cohort averages—not cutoffs</h2></div><Pill tone="warn">Do not infer offer probability</Pill></div>
        <div className="benchmark-table">
          <div className="benchmark-row header-row"><span>Cohort</span><span>Maths 1</span><span>Physics</span><span>Maths 2</span></div>
          {CAMBRIDGE_BENCHMARKS.map((row) => <div className="benchmark-row" key={row.cohort}><strong>{row.cohort}</strong><span>{row.maths1.toFixed(2)}</span><span>{row.physics.toFixed(2)}</span><span>{row.maths2.toFixed(2)}</span></div>)}
        </div>
        <p className="source-footnote">Cambridge FOI 2025-1097, Engineering H100, 2025 admissions cycle. These are cohort means, not thresholds; Cambridge colleges consider ESAT alongside the rest of an application. UAT-UK reports a typical candidate around 4.5 and approximately 10% above 7.0.</p>
        <div className="source-links"><a href="https://www.whatdotheyknow.com/request/esat_statistics_2025_cycle" target="_blank" rel="noreferrer">Cambridge data request</a><a href="https://esat-tmua.ac.uk/test-results/" target="_blank" rel="noreferrer">Official scoring method</a></div>
      </section>
    </>
  );
}

function QuestionLearningSupport({ question }: { question: Question }) {
  const guide = techniqueForQuestion(question);
  const [showOfficialImage, setShowOfficialImage] = useState(false);

  const hasWorkedSolution = Boolean(question.explanation);
  const hasOfficialSolution = Boolean(question.workedSolutionImage);
  const hasFastMethod = Boolean(question.methodFast);
  const hasKeyConcept = Boolean(question.keyConcept);

  return (
    <div className="question-learning">
      <div className="question-learning-head">
        <div>
          <Lightbulb size={18} />
          <span>
            <strong>Worked Solution & Fastest Method</strong>
            <small>{question.esatTopic} · {question.esatSubtopic || guide?.title || "Step-by-step breakdown"}</small>
          </span>
        </div>
        <Pill tone={hasOfficialSolution ? "good" : hasWorkedSolution ? "blue" : "neutral"}>
          {hasOfficialSolution ? "Official worked solution" : hasWorkedSolution ? "Checked worked solution" : "Verified answer key"}
        </Pill>
      </div>

      {hasKeyConcept ? (
        <div className="solution-concept-card">
          <BookOpen size={16} />
          <div>
            <strong>Key Principle & Governing Formula</strong>
            <p><MathText>{question.keyConcept}</MathText></p>
          </div>
        </div>
      ) : null}

      {hasWorkedSolution ? (
        <div className="exact-solution worked-solution-rich">
          <div className="solution-label">
            <ShieldCheck size={15} />
            <span>
              <strong>Worked solution for this question · Verified answer: option {question.correctAnswer}</strong>
              <small>Step-by-step derivation</small>
            </span>
          </div>
          <div className="solution-text-body">
            <MathText>{question.explanation}</MathText>
          </div>
        </div>
      ) : hasOfficialSolution ? null : (
        <div className="answer-key-note">
          <ShieldCheck size={16} />
          <span><strong>Verified answer: option {question.correctAnswer}</strong>The source publishes an answer key rather than a worked derivation.</span>
        </div>
      )}

      {hasFastMethod ? (
        <div className="solution-fast-card">
          <div className="fast-header">
            <Zap size={15} />
            <strong>Fast Multiple-Choice Route / Alternative Method</strong>
          </div>
          <div className="fast-text-body">
            <MathText>{question.methodFast}</MathText>
          </div>
        </div>
      ) : null}

      {hasOfficialSolution ? (
        <div className="official-solution-toggle-block">
          <button
            type="button"
            className="text-button official-toggle-btn"
            onClick={() => setShowOfficialImage(!showOfficialImage)}
          >
            {showOfficialImage ? <EyeOff size={15} /> : <Eye size={15} />}
            {showOfficialImage ? "Hide official publisher PDF page" : `View official publisher PDF page (${question.workedSolutionSource || "TMUA"})`}
          </button>
          {showOfficialImage ? (
            <div className="exact-solution official-img-block">
              <img
                src={publicAsset(question.workedSolutionImage ?? "")}
                alt={`${question.workedSolutionSource}, question ${question.originalQuestionNumber}`}
                loading="lazy"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {guide ? (
        <>
          <div className="review-method-grid">
            <div>
              <span className="review-method-title"><ShieldCheck size={15} /> Topic Best Method</span>
              <ol>{guide.bestMethod.map((step) => <li key={step}><MathText>{step}</MathText></li>)}</ol>
            </div>
            <div>
              <span className="review-method-title"><Zap size={15} /> Topic Fastest Valid Route</span>
              <ul>{guide.fastMethod.map((step) => <li key={step}><MathText>{step}</MathText></li>)}</ul>
            </div>
          </div>
          <p className="review-trap">
            <TriangleAlert size={14} />
            <span><strong>Watch for:</strong> {(question.commonTraps && question.commonTraps.length ? question.commonTraps : guide.traps).join(" · ")}</span>
          </p>
        </>
      ) : null}
    </div>
  );
}

export function AttemptDetailView({ attempt, questionMap, attempts, showScoreEstimate, scratchPages = {}, onBack, onDelete, onResit }: {
  attempt: Attempt;
  questionMap: Record<string, Question>;
  attempts: Attempt[];
  showScoreEstimate: boolean;
  /** The working written during this attempt, keyed by question. */
  scratchPages?: Record<string, ScratchPage>;
  onBack: () => void;
  onDelete: () => void;
  onResit: () => void;
}) {
  const [logFilter, setLogFilter] = useState<"all" | "correct" | "missed" | "flagged">("all");
  const responses = attempt.questionIds.map((id) => attempt.responses[id]).filter(Boolean);
  const report = scoreReportForAttempt(attempt);
  const estimate = report.estimate;
  const topics = sectionBreakdown(responses, questionMap);
  const pacing = pacingSummary(responses, attempt.questionIds.length, attempt.durationMs ?? 0);
  const times = responses.map((response) => response.timeSpentMs).sort((left, right) => left - right);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;
  const correct = responses.filter((response) => response.correct).length;
  const unanswered = responses.filter((response) => response.unanswered).length;
  const flagged = responses.filter((response) => response.flagged).length;
  const changed = responses.filter((response) => response.firstSelectedAnswer && response.finalAnswer && response.firstSelectedAnswer !== response.finalAnswer);
  const changedGained = changed.filter((response) => response.correct).length;
  const paperKey = attemptPaperKey(attempt);
  const sameSet = attempts
    .filter((item) => item.rawScore !== null && item.attemptId !== attempt.attemptId && (paperKey ? attemptPaperKey(item) === paperKey : item.mode === attempt.mode && item.module === attempt.module))
    .slice(0, 5);
  const previous = sameSet.find((item) => (item.endedAt ?? 0) < (attempt.endedAt ?? 0)) ?? null;
  const delta = accuracyDelta(attempt, previous);

  return (
    <>
      <section className="page-heading detail-heading">
        <div>
          <button className="text-button back-button" onClick={onBack}><ArrowLeft size={16} /> Back to history</button>
          <span className="eyebrow">{KIND_LABELS[attemptKind(attempt)]} · {formatDateTime(attempt.endedAt)}</span>
          <h1>{attemptTitle(attempt)}</h1>
          <p>{MODULE_LABELS[attempt.module]} · {attempt.questionIds.length} questions · {attempt.strictTimed ? "strict timing" : "practice timing"} · {attempt.freshQuestionCount} first-exposure question{attempt.freshQuestionCount === 1 ? "" : "s"}</p>
        </div>
        <div className="detail-actions">
          <button className="button button-secondary" onClick={onResit}><RotateCcw size={16} /> Sit again</button>
          <button className="button button-ghost" onClick={onDelete}><X size={16} /> Remove result</button>
        </div>
      </section>

      <section className="detail-hero">
        <div className="detail-raw">
          <strong>{attempt.rawScore}</strong>
          <span>/ {attempt.questionIds.length} raw</span>
          <small>{Math.round(report.accuracy * 100)}% accuracy{delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta} pts vs previous attempt` : ""}</small>
        </div>
        {showScoreEstimate && estimate ? <ScoreEstimateBlock estimate={estimate} /> : showScoreEstimate ? <ScoreEvidenceNotice report={report} /> : null}
      </section>

      <section className="result-metrics">
        <div><span>Correct</span><strong>{correct}</strong></div>
        <div><span>Incorrect</span><strong>{responses.length - correct - unanswered}</strong></div>
        <div><span>Unanswered</span><strong>{unanswered}</strong></div>
        <div><span>Flagged</span><strong>{flagged}</strong></div>
        <div><span>Time used</span><strong>{formatLongDuration(attempt.durationMs ?? 0)}</strong></div>
        <div><span>Median / question</span><strong>{formatDuration(median)}</strong></div>
      </section>

      <section className="detail-columns">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Section performance</span><h2>How each area went</h2></div></div>
          <SectionTable rows={topics} caption="Sections are the specification topics covered by this set, weakest first." />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Pacing</span><h2>Time against the ESAT reference</h2></div><Gauge size={18} /></div>
          <div className="pacing-rows">
            <div><span>Your average</span><strong>{formatDuration(pacing.actualMsPerQuestion)}</strong></div>
            <div><span>ESAT reference</span><strong>{formatDuration(pacing.targetMsPerQuestion)}</strong></div>
            <div><span>Over 2¼ minutes</span><strong>{pacing.overtimeQuestions} question{pacing.overtimeQuestions === 1 ? "" : "s"}</strong></div>
            <div><span>Wrong and rushed</span><strong>{pacing.rushedIncorrect}</strong></div>
            <div><span>Wrong and slow</span><strong>{pacing.slowIncorrect}</strong></div>
          </div>
          <p className="panel-footnote">{pacing.verdict}</p>
          {changed.length ? <p className="panel-footnote">You changed {changed.length} answer{changed.length === 1 ? "" : "s"}; {changedGained} of those ended correct.</p> : null}
        </article>
      </section>

      {sameSet.length ? (
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Same set, earlier attempts</span><h2>Progress on this material</h2></div></div>
          <div className="compare-list">
            {[attempt, ...sameSet].map((item) => {
              const itemEstimate = showScoreEstimate ? scoreReportForAttempt(item).estimate : null;
              return (
                <div key={item.attemptId} className={item.attemptId === attempt.attemptId ? "compare-row current" : "compare-row"}>
                  <span>{formatDate(item.endedAt)}</span>
                  <i><b style={{ width: `${attemptAccuracyPercent(item)}%` }} /></i>
                  <strong>{item.rawScore}/{item.questionIds.length}</strong>
                  {itemEstimate
                    ? <small>≈ {itemEstimate.scaledScore.toFixed(1)}</small>
                    : showScoreEstimate ? <small>raw only</small> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <QuestionTimingPanel attempt={attempt} questionMap={questionMap} />

      <section className="panel question-log">
        <div className="panel-heading">
          <div><span className="eyebrow">Question by question</span><h2>Open any question to see it again</h2></div>
          <div className="log-filters">
            {([["all", "All"], ["correct", "Correct only"], ["missed", "Missed only"], ["flagged", "Flagged"]] as const).map(([id, label]) => (
              <button key={id} className={logFilter === id ? "selected" : ""} onClick={() => setLogFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="log-row header-row"><span>#</span><span>Source</span><span>Topic</span><span>Yours</span><span>Correct</span><span>Time</span><span>Result</span></div>
        {attempt.questionIds.map((id, index) => {
          const response = attempt.responses[id];
          const question = questionMap[id];
          if (!response) return null;
          if (logFilter === "correct" && !response.correct) return null;
          if (logFilter === "missed" && response.correct) return null;
          if (logFilter === "flagged" && !response.flagged) return null;
          return (
            <details className="log-entry" key={id}>
              <summary className="log-row">
                <span>{index + 1}{response.flagged ? <Flag size={12} /> : null}</span>
                <span className="log-source">{sourceLabelForAttempt(question, attempt)}</span>
                <span>{question?.esatTopic ?? "—"}</span>
                <span>{response.finalAnswer ?? "—"}</span>
                <span>{question?.correctAnswer ?? "—"}</span>
                <span>{formatDuration(response.timeSpentMs)}</span>
                <Pill tone={response.correct ? "good" : response.unanswered ? "neutral" : "bad"}>{response.correct ? "Correct" : response.unanswered ? "Blank" : "Wrong"}</Pill>
              </summary>
              <div className="log-review">
                {question?.questionImage
                  ? <img src={publicAsset(question.questionImage)} alt={`${question.sourceExam} ${question.year} question ${question.originalQuestionNumber}`} loading="lazy" />
                  : question
                    ? <div className="authored-review"><p><MathText>{question.questionText}</MathText></p><QuestionFigure question={question} /></div>
                    : <p className="panel-footnote">This question is no longer in the bank.</p>}
                {question ? (
                  <div className="log-review-side">
                    <div className="log-answer-grid">
                      {question.answerOptions.map((letter) => (
                        <span
                          key={letter}
                          className={`log-answer ${letter === question.correctAnswer ? "is-correct" : ""} ${letter === response.finalAnswer && letter !== question.correctAnswer ? "is-yours" : ""}`}
                        >
                          <kbd>{letter}</kbd>
                          {question.optionText?.[letter] ? <MathText>{question.optionText[letter]}</MathText> : null}
                        </span>
                      ))}
                    </div>
                    {!pageIsEmpty(scratchPages[id])
                      ? <ScratchpadPreview page={scratchPages[id]} label="Your working on this question" />
                      : null}
                    <QuestionLearningSupport question={question} />
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </section>

      {showScoreEstimate ? <ScoreMethodology /> : null}
    </>
  );
}

function ScoreMethodology() {
  const [module, setModule] = useState<ModuleId>("maths1");
  const distribution = ESAT_SCORE_DISTRIBUTIONS[module];
  const peak = Math.max(...distribution.map((bin) => bin.percent));
  return (
    <section className="panel methodology">
      <div className="panel-heading"><div><span className="eyebrow">Methodology</span><h2>Where these numbers come from</h2></div><Pill tone="neutral">Two steps, different evidence</Pill></div>
      <div className="method-split">
        <div>
          <span className="method-step">Step 1 · estimated</span>
          <h3>Raw mark → scaled score</h3>
          <p>UAT-UK publishes no raw-to-scaled table, because every live form is Rasch-equated for question difficulty. This step is a stated assumption: {SCORE_MODEL.assumption.toLowerCase()}</p>
        </div>
        <div>
          <span className="method-step method-step-solid">Step 2 · published data</span>
          <h3>Scaled score → your standing</h3>
          <p>Your standing is read directly off the official {SCORE_MODEL.distributionSitting} score distribution for this module, published by UAT-UK. It is not modelled.</p>
        </div>
      </div>

      <div className="distribution-block">
        <div className="distribution-head">
          <strong>Official {SCORE_MODEL.distributionSitting} distribution</strong>
          <div className="segmented compact-segments">
            {MODULE_ORDER.map((item) => (
              <button key={item} className={module === item ? "selected" : ""} onClick={() => setModule(item)}>{MODULE_LABELS[item].replace("Mathematics ", "Maths ")}</button>
            ))}
          </div>
        </div>
        <div className="distribution-chart" role="img" aria-label={`Official ${SCORE_MODEL.distributionSitting} ESAT ${MODULE_LABELS[module]} score distribution`}>
          {distribution.map((bin) => (
            <div className="distribution-bar" key={bin.score} title={`${bin.score.toFixed(1)}: ${bin.percent.toFixed(1)}% of candidates`}>
              <i style={{ height: `${(bin.percent / peak) * 100}%` }} />
              <small>{bin.score % 1 === 0 ? bin.score.toFixed(0) : ""}</small>
            </div>
          ))}
        </div>
        <p className="panel-footnote">Percentage of candidates at each reported half-point. Source: {SCORE_MODEL.source}.</p>
      </div>

      <div className="curve-table">
        <div className="curve-row header-row"><span>Raw correct</span><span>Estimated score</span><span>Standing in {MODULE_LABELS[module]}</span></div>
        {SCORE_CURVE.map((point) => (
          <div className="curve-row" key={point.percentCorrect}>
            <span>{point.percentCorrect}% <em>({Math.round(point.percentCorrect * 0.27)}/27)</em></span>
            <strong>{point.scaledScore.toFixed(1)}</strong>
            <span>{scoreEstimate(point.percentCorrect, 100, module).standing}</span>
          </div>
        ))}
      </div>
      <p className="panel-footnote">
        {SCORE_MODEL.noCutOff} Archive papers (NSAA, ENGAA Part B, TMUA Paper 1) and the original challenge mocks are not identical in
        difficulty to a live ESAT form, so treat the estimate as a calibrated range rather than a prediction. Your raw mark is always exact.
      </p>
      <p className="panel-footnote">{CAMBRIDGE_CONTEXT.offerHolderSource}.</p>
    </section>
  );
}

/**
 * A numeric setting that stays editable while it is being typed. Clamping on every
 * keystroke makes the field impossible to clear and retype, because an empty string
 * parses to zero and is immediately rewritten as the minimum; the committed value is
 * therefore only normalised once the edit finishes.
 */
export function NumberSetting({ id, value, min, max, step, decimals = 0, onCommit }: {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onCommit: (value: number) => void;
}) {
  const format = (input: number): string => input.toFixed(decimals);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string): void => {
    setDraft(null);
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) return;
    const rounded = Math.round(parsed / step) * step;
    onCommit(Number(Math.min(max, Math.max(min, rounded)).toFixed(decimals)));
  };
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft ?? format(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
    />
  );
}

export function SettingsView({ state, busy, offline, onToast, onSettingsChange, onTargetChange, onExportJson, onExportCsv, onReset, onEraseCloudData, onDeleteAccount }: {
  state: StoredState;
  busy: boolean;
  offline?: OfflineRuntime;
  onToast?: (message: string) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onTargetChange: (module: ModuleId, value: number) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onReset: () => void;
  onEraseCloudData: () => void;
  onDeleteAccount: () => void;
}) {
  return (
    <>
      <section className="page-heading"><div><span className="eyebrow">Personal settings</span><h1>Targets and study constraints.</h1><p>Personal targets are planning aids, never official Cambridge thresholds.</p></div></section>
      <section className="settings-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Module targets</span><h2>Your own goals</h2></div></div>
          {MODULE_ORDER.map((module) => (
            <label className="setting-row" key={module} htmlFor={`target-${module}`}>
              <span>{MODULE_LABELS[module]}<small>1.0–9.0 personal target</small></span>
              <NumberSetting id={`target-${module}`} value={state.targets[module]} min={1} max={9} step={0.1} decimals={1} onCommit={(value) => onTargetChange(module, value)} />
            </label>
          ))}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Study planner</span><h2>Time available</h2></div></div>
          <label className="setting-row">
            <span>ESAT date<small>Used for the countdown</small></span>
            <input type="date" value={state.settings.examDate} onChange={(event) => onSettingsChange({ examDate: event.target.value })} />
          </label>
          <label className="setting-row" htmlFor="weekly-hours">
            <span>Weekly hours<small>Compared against your recorded session time</small></span>
            <NumberSetting id="weekly-hours" value={state.settings.weeklyHours} min={1} max={40} step={1} onCommit={(value) => onSettingsChange({ weeklyHours: value })} />
          </label>
          <label className="setting-row">
            <span>Typical plan length<small>Maximum question time scheduled for one day</small></span>
            <select value={state.settings.adaptivePlanMinutes} onChange={(event) => onSettingsChange({ adaptivePlanMinutes: Number(event.target.value) })}>
              {PLAN_MINUTE_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
          <p className="panel-footnote">The adaptive plan uses this as a daily cap. Weekly hours remain your wider target, so optional extra practice may still be useful on some days.</p>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Player and reporting</span><h2>Interaction</h2></div></div>
          <label className="toggle-row"><span>Keyboard shortcuts<small>A–H, 1–8, arrows, backspace, F, R and W</small></span><input type="checkbox" checked={state.settings.keyboardShortcuts} onChange={(event) => onSettingsChange({ keyboardShortcuts: event.target.checked })} /></label>
          <label className="toggle-row"><span>Strict-mode pacing aid<small>Optional; hidden by default</small></span><input type="checkbox" checked={state.settings.pacingAid} onChange={(event) => onSettingsChange({ pacingAid: event.target.checked })} /></label>
          <label className="toggle-row"><span>Show estimated 1.0–9.0 score<small>Turn off to work from raw marks only</small></span><input type="checkbox" checked={state.settings.showScoreEstimate} onChange={(event) => onSettingsChange({ showScoreEstimate: event.target.checked })} /></label>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Writing on the question</span><h2>Work on the paper itself</h2></div><NotebookPen size={18} /></div>
          <p className="panel-copy">Write your working straight onto the question, as you would on a printed paper — beside the diagram it belongs to, under the line it follows from. Each question keeps its own writing, and it is stored with the attempt so you can see it again in the review afterwards.</p>
          <label className="toggle-row">
            <span>Offer writing on the question<small>Also started and stopped during a session with the Write button, or the W key</small></span>
            <input type="checkbox" checked={state.settings.scratchpadEnabled} onChange={(event) => onSettingsChange({ scratchpadEnabled: event.target.checked })} />
          </label>
          <label className="toggle-row">
            <span>Stylus only<small>Ignore finger and mouse input. Touch is rejected by itself once a stylus is used, and moves the question instead.</small></span>
            <input
              type="checkbox"
              checked={state.settings.scratchpadStylusOnly}
              disabled={!state.settings.scratchpadEnabled}
              onChange={(event) => onSettingsChange({ scratchpadStylusOnly: event.target.checked })}
            />
          </label>
          <label className="setting-row">
            <span>Question size<small>100% fits the width; below that the whole page is visible, above it the frame scrolls</small></span>
            <select value={state.settings.questionZoom} onChange={(event) => onSettingsChange({ questionZoom: Number(event.target.value) })}>
              {QUESTION_ZOOM_STEPS.map((step) => <option key={step} value={step}>{Math.round(step * 100)}%</option>)}
            </select>
          </label>
          <label className="toggle-row">
            <span>Hide the printed options on the question<small>The answer panel lists them anyway, so the page can spend its room on the question</small></span>
            <input
              type="checkbox"
              checked={state.settings.questionHideOptions}
              onChange={(event) => onSettingsChange({ questionHideOptions: event.target.checked })}
            />
          </label>
          <label className="setting-row">
            <span>How much of the crop to hide<small>Papers place their option list differently; adjust if too much or too little is cut</small></span>
            <select
              value={state.settings.questionOptionTrim}
              disabled={!state.settings.questionHideOptions}
              onChange={(event) => onSettingsChange({ questionOptionTrim: Number(event.target.value) })}
            >
              {[0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6].map((value) => (
                <option key={value} value={value}>Bottom {Math.round(value * 100)}%</option>
              ))}
            </select>
          </label>
          <p className="panel-footnote">The real ESAT is sat with paper for working. Writing on screen is a convenience for practice on a tablet, not a simulation of exam conditions.</p>
        </article>
        {offline ? <OfflinePanel runtime={offline} onToast={onToast ?? (() => undefined)} /> : null}
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Data portability</span><h2>Own your revision record</h2></div></div>
          <p className="panel-copy">Export attempts, responses, progress, mistakes, timing, targets and notes at any time.</p>
          <div className="export-actions">
            <button className="button button-secondary" onClick={onExportJson}><Download size={16} /> Export JSON</button>
            <button className="button button-secondary" onClick={onExportCsv}><Download size={16} /> Attempts CSV</button>
          </div>
          <p className="panel-footnote">Clearing this device signs you out and removes its saved copy. Your Firebase copy is not deleted, and signing in again restores it.</p>
          <button className="button button-ghost" onClick={onReset} disabled={busy}><TriangleAlert size={16} /> Clear this device and sign out</button>
        </article>
        <article className="panel danger-panel">
          <div className="panel-heading"><div><span className="eyebrow">Permanent deletion</span><h2>Erase your data or your account</h2></div><Pill tone="bad">Cannot be undone</Pill></div>
          <p className="panel-copy">Export first if you want a copy. Erasing revision data keeps you signed in and starts you from an empty record; deleting the account also removes your ESAT Atlas identity from Firebase Authentication.</p>
          <div className="danger-actions">
            <button className="button button-ghost" onClick={onEraseCloudData} disabled={busy}><TriangleAlert size={16} /> Erase all revision data</button>
            <button className="button button-ghost" onClick={onDeleteAccount} disabled={busy}><X size={16} /> Delete account and data</button>
          </div>
          <p className="panel-footnote">Google will ask you to confirm the account before deletion. Revoking ESAT Atlas in your Google Account&apos;s third-party connections does not by itself remove data already stored here.</p>
        </article>
      </section>
      <ScoreMethodology />
    </>
  );
}

export const QUESTION_ZOOM_STEPS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2, 2.5, 3] as const;

/**
 * The width an authored question is composed at before magnification.
 *
 * Typeset items have no intrinsic size the way a scan does, so one is imposed. Without it the
 * text would reflow with the window, the page would change shape, and writing put beside a
 * line of algebra would no longer be beside it on the next device.
 */
const AUTHORED_BASE_WIDTH = 900;

/** Fallback shape for a crop whose dimensions are not known yet; roughly A5 landscape. */
const DEFAULT_QUESTION_ASPECT = 0.68;

/** The nearest offered step to an arbitrary zoom, so a stored value lands on the ramp. */
export function nearestZoomStep(zoom: number): number {
  return QUESTION_ZOOM_STEPS.reduce(
    (best, step) => (Math.abs(step - zoom) < Math.abs(best - zoom) ? step : best),
    QUESTION_ZOOM_STEPS[0],
  );
}

/**
 * The magnification at which the whole of a question of this shape fits inside the frame.
 *
 * Capped at 1, because 1 already means "as wide as the frame": a short, wide question whose
 * height would allow more would then be pushed off the sides, and "fit" has to mean the
 * whole page is visible in both directions, not one of them.
 */
export function fitPageZoom(frameWidth: number, frameHeight: number, aspect: number): number {
  if (frameWidth <= 0 || frameHeight <= 0 || aspect <= 0) return 1;
  const exact = Math.min(1, frameHeight / (frameWidth * aspect));
  return Math.min(MAX_QUESTION_ZOOM, Math.max(MIN_QUESTION_ZOOM, Math.round(exact * 20) / 20));
}

/**
 * The question, at whatever size the candidate has chosen, with the writing layer on top.
 *
 * Everything is derived from two numbers: the frame's width and the question's aspect ratio.
 * The page is rendered `frameWidth * zoom` wide, so zoom 1 always means "the full width of
 * the question", whatever the screen; below 1 the whole of a tall paper is visible at once,
 * and above it the frame scrolls. Because the ink layer is a sibling sized to the same box,
 * annotation is magnified and moved with the paper rather than floating over it.
 *
 * The trim hides the printed option list at the foot of a crop. Where that list starts is not
 * recorded anywhere — these are page scans, not structured documents — so it is a fraction
 * the candidate sets once. Nothing is destroyed: the toggle brings it straight back, and the
 * answer panel has always listed the same options in typeset form.
 */
export function QuestionSurface({
  question,
  index,
  zoom,
  trim,
  onAspectChange,
  onFrameChange,
  onZoomGesture,
  children,
}: {
  question: Question;
  index: number;
  zoom: number;
  trim: number;
  onAspectChange: (aspect: number) => void;
  onFrameChange: (size: { width: number; height: number }) => void;
  onZoomGesture?: (direction: 1 | -1) => void;
  /** The writing layer, sized by this component to the question's own box. */
  children?: React.ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const authoredRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState(0);

  const publishAspect = useCallback((value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    setAspect((current) => (Math.abs(current - value) < 0.0005 ? current : value));
    onAspectChange(value);
  }, [onAspectChange]);

  // The content box, not the border box: the page is laid out inside the frame's padding,
  // so sizing it from the outer width would leave every question a scrollbar wider than the
  // window at the magnification that is supposed to fit exactly.
  // This is an observer or event callback, never a synchronous write from an effect.
  const measureFrame = useCallback(() => {
    const node = frameRef.current;
    if (!node) return;
    const style = window.getComputedStyle(node);
    const horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const next = {
      width: Math.max(1, Math.round(node.clientWidth - horizontal)),
      height: Math.max(1, Math.round(node.clientHeight - vertical)),
    };
    setFrame((current) => (current.width === next.width && current.height === next.height ? current : next));
    onFrameChange(next);
  }, [onFrameChange]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureFrame);
      return () => window.removeEventListener("resize", measureFrame);
    }
    const observer = new ResizeObserver(measureFrame);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measureFrame]);

  // An authored item has no intrinsic size, so its shape is measured at a fixed composition
  // width and then scaled — which is also what keeps it from reflowing.
  //
  // `offsetHeight`, not the bounding rectangle: the element it measures is inside the
  // element being scaled, so its rectangle is the scaled height. Deriving the shape from
  // that would make the shape depend on the magnification, which then changes the scale —
  // a loop that settles on whatever fixed point it happens to find rather than on the
  // question's real proportions. The offset height is the untransformed layout box.
  useEffect(() => {
    const node = authoredRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (node.offsetHeight > 0) publishAspect(node.offsetHeight / AUTHORED_BASE_WIDTH);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [publishAspect]);

  const effectiveAspect = aspect > 0 ? aspect : DEFAULT_QUESTION_ASPECT;
  const pageWidth = Math.max(1, Math.round(frame.width * zoom));
  const pageHeight = Math.max(1, Math.round(pageWidth * effectiveAspect));
  const visibleHeight = trim > 0 ? Math.max(120, Math.round(pageHeight * (1 - trim))) : pageHeight;

  return (
    <div
      className={`question-frame ${question.authored ? "authored-frame" : ""}`}
      ref={frameRef}
      onWheel={(event) => {
        // Ctrl or ⌘ with the wheel is the zoom gesture every document viewer uses, and it
        // is what a trackpad pinch arrives as.
        if (!onZoomGesture || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        onZoomGesture(event.deltaY < 0 ? 1 : -1);
      }}
    >
      <div className="question-page" style={{ width: `${pageWidth}px`, height: `${visibleHeight}px` }}>
        <div className="question-page-inner" style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}>
          {question.questionImage ? (
            <img
              className="question-page-image"
              src={publicAsset(question.questionImage)}
              alt={`${question.sourceExam} ${question.year} question ${question.originalQuestionNumber}`}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth > 0) publishAspect(image.naturalHeight / image.naturalWidth);
              }}
            />
          ) : (
            <div
              className="question-page-authored"
              style={{ width: `${AUTHORED_BASE_WIDTH}px`, transform: `scale(${pageWidth / AUTHORED_BASE_WIDTH})` }}
            >
              <div className="authored-question" ref={authoredRef}>
                <span>Question {index + 1}</span>
                <p><MathText>{question.questionText}</MathText></p>
                <QuestionFigure question={question} />
                <small>Original ESAT Atlas challenge item</small>
              </div>
            </div>
          )}
          {children}
        </div>
        {trim > 0 ? <span className="question-trim-note">Printed options hidden — they are listed in the answer panel</span> : null}
      </div>
    </div>
  );
}

export function ExamPlayer({
  attempt,
  questionMap,
  now,
  reviewOpen,
  setReviewOpen,
  onSelect,
  onClear,
  onNavigate,
  onFlag,
  onConfidence,
  onFinish,
  onExit,
  onPause,
  pacingAid,
  multiTabWarning,
  dismissMultiTab,
  writingEnabled = false,
  onWritingChange,
  questionZoom = 1,
  questionHideOptions = false,
  questionOptionTrim = 0.3,
  onQuestionViewChange,
  writingReady = false,
  scratchPageFor,
  onScratchChange,
  scratchPreferences,
  onScratchPreferencesChange,
  onNotice,
}: {
  attempt: Attempt;
  questionMap: Record<string, Question>;
  now: number;
  reviewOpen: boolean;
  setReviewOpen: (value: boolean) => void;
  onSelect: (letter: string) => void;
  onClear: () => void;
  onNavigate: (index: number) => void;
  onFlag: () => void;
  onConfidence: (confidence: "Guess" | "Low" | "Medium" | "High") => void;
  onFinish: () => void;
  onExit: () => void;
  onPause: () => void;
  pacingAid: boolean;
  multiTabWarning: boolean;
  dismissMultiTab: () => void;
  /** Whether writing on the question is offered at all; false hides even the toggle. */
  writingEnabled?: boolean;
  onWritingChange?: (enabled: boolean) => void;
  /** How the question itself is shown. */
  questionZoom?: number;
  questionHideOptions?: boolean;
  questionOptionTrim?: number;
  onQuestionViewChange?: (patch: Partial<Settings>) => void;
  /** False until this attempt's stored writing has been read back. */
  writingReady?: boolean;
  scratchPageFor?: (questionId: string) => ScratchPage | null;
  onScratchChange?: (questionId: string, page: ScratchPage) => void;
  scratchPreferences?: ScratchPreferences;
  onScratchPreferencesChange?: (patch: Partial<ScratchPreferences>) => void;
  onNotice?: (message: string) => void;
}) {
  const questionId = attempt.questionIds[attempt.currentIndex];
  const question = questionMap[questionId];
  const response = attempt.responses[questionId];
  const timeLeft = remainingMs(attempt, now);
  const answered = Object.values(attempt.responses).filter((item) => item.selectedAnswer).length;
  const totalWindow = attempt.strictTimed ? esatPacedDurationMs(attempt.questionIds.length) : (attempt.endsAt ? attempt.endsAt - attempt.startedAt : 0);
  const expectedElapsed = (attempt.currentIndex / attempt.questionIds.length) * totalWindow;
  const actualElapsed = now - attempt.startedAt - attempt.totalPausedDuration;
  const paceDifference = expectedElapsed - actualElapsed;
  const displayedSource = sourceLabelForAttempt(question, attempt);
  const writingOffered = writingEnabled && Boolean(scratchPageFor) && Boolean(onScratchChange) && Boolean(scratchPreferences);
  const writingVisible = writingOffered && writingReady;
  const zoomIndex = QUESTION_ZOOM_STEPS.indexOf(nearestZoomStep(questionZoom) as typeof QUESTION_ZOOM_STEPS[number]);
  const [tool, setTool] = useState<ScratchTool>("pen");
  // Keyed by question rather than reset in an effect: a status left over from the previous
  // question would briefly enable Undo against writing that is no longer on screen.
  const [reportedStatus, setReportedStatus] = useState<{ questionId: string; status: AnnotationStatus }>(
    { questionId, status: EMPTY_ANNOTATION_STATUS },
  );
  const writingStatus = reportedStatus.questionId === questionId ? reportedStatus.status : EMPTY_ANNOTATION_STATUS;
  const handleStatusChange = useCallback(
    (status: AnnotationStatus) => setReportedStatus({ questionId, status }),
    [questionId],
  );
  const annotatorRef = useRef<AnnotatorHandle | null>(null);
  // The question's shape, reported by the surface once it knows it, and the frame it is
  // drawn into. Both are needed to work out the magnification that fits a whole page.
  const [aspect, setAspect] = useState(0);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  const handleScratchChange = useCallback(
    (page: ScratchPage) => onScratchChange?.(questionId, page),
    [onScratchChange, questionId],
  );

  const stepZoom = useCallback((direction: 1 | -1) => {
    const next = QUESTION_ZOOM_STEPS[Math.min(QUESTION_ZOOM_STEPS.length - 1, Math.max(0, zoomIndex + direction))];
    if (next !== questionZoom) onQuestionViewChange?.({ questionZoom: next });
  }, [onQuestionViewChange, questionZoom, zoomIndex]);

  // Read once per question. The layer is uncontrolled and keyed by the question, so a later
  // identity change would be ignored anyway — but a stable value keeps the memoised layer
  // from re-rendering on every tick of the exam clock.
  const initialPage = useMemo(
    () => (writingVisible && scratchPageFor ? scratchPageFor(questionId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questionId, writingVisible],
  );

  if (!question || !response) {
    return (
      <main className="loading-screen loading-screen-error">
        <div className="brand-mark">EA</div>
        <div><strong>This question could not be loaded</strong><span>The question bank changed while the session was open.</span></div>
        <button className="button button-light" onClick={onExit}>Exit session</button>
      </main>
    );
  }

  return (
    <div className="exam-shell">
      <header className="exam-header" inert={Boolean(attempt.pausedAt)}>
        <div className="exam-brand"><div className="brand-mark">EA</div><span><strong>{MODULE_LABELS[attempt.module]}</strong>{attempt.mode === "historic" ? attempt.sourceSetLabel : attempt.mode === "original" ? "Original challenge mock" : attempt.strictTimed ? "Strict exam simulation" : "Practice session"}</span></div>
        <div className="exam-progress"><span>Question {attempt.currentIndex + 1} of {attempt.questionIds.length}</span><div><i style={{ width: `${(attempt.currentIndex + 1) / attempt.questionIds.length * 100}%` }} /></div></div>
        <div className="exam-header-actions">
          <button className="exam-exit" onClick={onExit}><Home size={16} /><span>Exit</span></button>
          <div className={`exam-timer ${timeLeft !== null && timeLeft < 300_000 ? "timer-low" : ""}`} role="timer" aria-live="off"><Clock3 size={19} /><span><small>Time remaining</small><strong>{timeLeft === null ? "Untimed" : formatDuration(timeLeft)}</strong></span></div>
        </div>
      </header>
      {multiTabWarning ? <div className="multi-tab"><TriangleAlert size={18} /><span><strong>This attempt is open in another tab.</strong>Continue in one tab only to prevent competing saves.</span><button aria-label="Dismiss multi-tab warning" onClick={dismissMultiTab}><X size={16} /></button></div> : null}
      {attempt.pausedAt ? <div className="pause-overlay"><Pause size={28} /><h2>Practice paused</h2><p>Your timer and question visit are paused.</p><button className="button button-primary" onClick={onPause}><Play size={17} /> Resume session</button></div> : null}
      {reviewOpen ? (
        <main className="review-screen" inert={Boolean(attempt.pausedAt)}>
          <div className="review-heading">
            <div><span className="eyebrow">Module review</span><h1>Check before submitting</h1><p>{answered} answered · {attempt.questionIds.length - answered} unanswered · {Object.values(attempt.responses).filter((item) => item.flagged).length} flagged</p></div>
            <button className="button button-secondary" onClick={() => setReviewOpen(false)}>Return to question</button>
          </div>
          <div className="review-grid">
            {attempt.questionIds.map((id, index) => {
              const item = attempt.responses[id];
              if (!item) return null;
              return (
                <button key={id} className={`${item.selectedAnswer ? "answered" : "unanswered"} ${item.flagged ? "flagged" : ""}`} onClick={() => onNavigate(index)}>
                  <strong>{index + 1}</strong>
                  <span>{item.selectedAnswer ? `Answer ${item.selectedAnswer}` : "Unanswered"}</span>
                  {item.flagged ? <Flag size={14} /> : null}
                </button>
              );
            })}
          </div>
          <div className="review-submit">
            <div><TriangleAlert size={18} /><span>Unanswered questions receive no mark. There is no negative marking, so never leave a blank.</span></div>
            <button className="button button-primary" onClick={onFinish}>Submit module</button>
          </div>
        </main>
      ) : (
        <main className="exam-content" inert={Boolean(attempt.pausedAt)}>
          <section className="question-stage">
            <div className="question-toolbar">
              <div><Pill tone="neutral">{displayedSource}</Pill>{!attempt.strictTimed ? <Pill tone="blue">{question.esatTopic}</Pill> : null}</div>
              <div>
                {pacingAid && attempt.strictTimed ? <span className={paceDifference >= 0 ? "pace-ahead" : "pace-behind"}>{formatDuration(Math.abs(paceDifference))} {paceDifference >= 0 ? "ahead" : "behind"}</span> : null}
                {onQuestionViewChange ? (
                  <>
                    <span className="question-zoom" role="group" aria-label="Question size">
                      <button
                        type="button"
                        aria-label="Show the question smaller"
                        title="Show the question smaller"
                        disabled={zoomIndex <= 0}
                        onClick={() => stepZoom(-1)}
                      >
                        <ZoomOut size={15} />
                      </button>
                      <b>{Math.round(questionZoom * 100)}%</b>
                      <button
                        type="button"
                        aria-label="Show the question larger"
                        title="Show the question larger"
                        disabled={zoomIndex >= QUESTION_ZOOM_STEPS.length - 1}
                        onClick={() => stepZoom(1)}
                      >
                        <ZoomIn size={15} />
                      </button>
                      <button
                        type="button"
                        className="question-zoom-fit"
                        aria-label="Fit the whole question on screen"
                        title="Fit the whole question on screen"
                        onClick={() => onQuestionViewChange({ questionZoom: fitPageZoom(frame.width, frame.height, aspect) })}
                      >
                        <Maximize2 size={14} /> Fit
                      </button>
                    </span>
                    {question.questionImage ? (
                      <button
                        type="button"
                        className={questionHideOptions ? "board-button active" : "board-button"}
                        aria-pressed={questionHideOptions}
                        title={questionHideOptions
                          ? "Show the printed option list on the question again"
                          : "Hide the printed option list; the options stay in the answer panel"}
                        onClick={() => onQuestionViewChange({ questionHideOptions: !questionHideOptions })}
                      >
                        {questionHideOptions ? <EyeOff size={16} /> : <Eye size={16} />} Options
                      </button>
                    ) : null}
                  </>
                ) : null}
                {onWritingChange ? (
                  <button
                    type="button"
                    className={writingEnabled ? "board-button active" : "board-button"}
                    aria-pressed={writingEnabled}
                    title={writingEnabled ? "Stop writing on the question (W)" : "Write on the question (W)"}
                    onClick={() => onWritingChange(!writingEnabled)}
                  >
                    <PencilRuler size={16} /> {writingEnabled ? "Writing on" : "Write"}
                  </button>
                ) : null}
                <button className={response.flagged ? "flag-button flagged" : "flag-button"} onClick={onFlag} aria-pressed={response.flagged}><Flag size={16} /> {response.flagged ? "Flagged" : "Flag for review"}</button>
              </div>
            </div>

            {writingVisible && scratchPreferences ? (
              <AnnotationToolbar
                tool={tool}
                onToolChange={setTool}
                preferences={scratchPreferences}
                onPreferencesChange={onScratchPreferencesChange ?? (() => undefined)}
                status={writingStatus}
                onUndo={() => annotatorRef.current?.undo()}
                onRedo={() => annotatorRef.current?.redo()}
                onClear={() => annotatorRef.current?.clear()}
                onClose={onWritingChange ? () => onWritingChange(false) : undefined}
              />
            ) : null}
            {writingOffered && !writingVisible ? (
              <p className="annotation-restoring" role="status">Restoring what you wrote on this question…</p>
            ) : null}

            <QuestionSurface
              question={question}
              index={attempt.currentIndex}
              zoom={questionZoom}
              trim={questionHideOptions && question.questionImage ? questionOptionTrim : 0}
              onAspectChange={setAspect}
              onFrameChange={setFrame}
              onZoomGesture={onQuestionViewChange ? stepZoom : undefined}
            >
              {writingVisible && scratchPreferences ? (
                <QuestionAnnotator
                  key={`${attempt.attemptId}:${questionId}`}
                  ref={annotatorRef}
                  initialPage={initialPage}
                  onChange={handleScratchChange}
                  pageHeight={BOARD_WIDTH * (aspect > 0 ? aspect : 1)}
                  tool={tool}
                  preferences={scratchPreferences}
                  onStatusChange={handleStatusChange}
                  onNotice={onNotice}
                />
              ) : null}
            </QuestionSurface>
            {writingStatus.fill >= 0.8 ? (
              <p className="annotation-full-warning" role="status">
                This question is {Math.min(100, Math.round(writingStatus.fill * 100))}% full of writing. Erase what you no longer need.
              </p>
            ) : null}
          </section>
          <aside className="answer-panel">
            <span className="eyebrow">Select one answer</span>
            <div className="answer-options" role="radiogroup" aria-label="Answer options">
              {question.answerOptions.map((letter, index) => (
                <button key={letter} role="radio" aria-checked={response.selectedAnswer === letter} className={response.selectedAnswer === letter ? "selected" : ""} onClick={() => onSelect(letter)}>
                  <kbd>{letter}</kbd>
                  <span>{question.optionText?.[letter] ? <MathText>{question.optionText[letter]}</MathText> : `Option ${letter}`}</span>
                  <small>{index + 1}</small>
                </button>
              ))}
            </div>
            {response.selectedAnswer ? <button className="text-button clear-answer" onClick={onClear}>Clear selection</button> : null}
            {!attempt.strictTimed ? (
              <div className="confidence-picker">
                <span>Confidence (optional)</span>
                <div>{(["Guess", "Low", "Medium", "High"] as const).map((confidence) => <button className={response.confidence === confidence ? "selected" : ""} key={confidence} onClick={() => onConfidence(confidence)}>{confidence}</button>)}</div>
              </div>
            ) : null}
          </aside>
        </main>
      )}
      {!reviewOpen ? (
        <footer className="exam-footer" inert={Boolean(attempt.pausedAt)}>
          <div>{!attempt.strictTimed ? <button className="button button-secondary compact" onClick={onPause}><Pause size={15} /> Pause</button> : <span className="strict-note"><ShieldCheck size={15} /> Strict timing continues if this tab loses focus.</span>}</div>
          <div className="exam-nav">
            <button className="button button-secondary" onClick={() => onNavigate(attempt.currentIndex - 1)} disabled={attempt.currentIndex === 0}><ChevronLeft size={17} /> Previous</button>
            <button className="button button-secondary" onClick={() => setReviewOpen(true)}>Review ({answered}/{attempt.questionIds.length})</button>
            {attempt.currentIndex === attempt.questionIds.length - 1
              ? <button className="button button-primary" onClick={() => setReviewOpen(true)}>Final review</button>
              : <button className="button button-primary" onClick={() => onNavigate(attempt.currentIndex + 1)}>Next <ChevronRight size={17} /></button>}
          </div>
        </footer>
      ) : null}
    </div>
  );
}

export function ResultScreen({ attempt, questionMap, showScoreEstimate, returnLabel, previous, scratchPages = {}, onClose, onContinue, onRetryMissed, onTag }: {
  attempt: Attempt;
  questionMap: Record<string, Question>;
  showScoreEstimate: boolean;
  returnLabel: string;
  previous: Attempt | null;
  /** The working written during this attempt, keyed by question. */
  scratchPages?: Record<string, ScratchPage>;
  onClose: () => void;
  onContinue: () => void;
  onRetryMissed: () => void;
  onTag: (questionId: string, tag: string) => void;
}) {
  const responses = attempt.questionIds.map((id) => attempt.responses[id]).filter(Boolean) as ResponseRecord[];
  const correct = responses.filter((response) => response.correct).length;
  const unanswered = responses.filter((response) => response.unanswered).length;
  const times = responses.map((response) => response.timeSpentMs).sort((left, right) => left - right);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;
  const incorrect = responses.filter((response) => response.correct === false && !response.unanswered);
  const missed = [...incorrect, ...responses.filter((response) => response.unanswered)];
  const report = scoreReportForAttempt(attempt);
  const estimate = report.estimate;
  const topics = sectionBreakdown(responses, questionMap);
  const pacing = pacingSummary(responses, attempt.questionIds.length, attempt.durationMs ?? 0);
  const delta = accuracyDelta(attempt, previous);

  const [reviewFilter, setReviewFilter] = useState<"all" | "correct" | "missed" | "flagged">("all");
  const flaggedCount = responses.filter((r) => r.flagged).length;
  const filteredResponses = responses.filter((response) => {
    if (reviewFilter === "correct") return response.correct;
    if (reviewFilter === "missed") return !response.correct || response.unanswered;
    if (reviewFilter === "flagged") return response.flagged;
    return true;
  });

  return (
    <main className="result-screen">
      <header className="result-header">
        <div className="sidebar-brand"><div className="brand-mark">EA</div><div><strong>ESAT Atlas</strong><span>Session result</span></div></div>
        <button className="button button-secondary" onClick={onClose}>{returnLabel}</button>
      </header>
      <section className="result-hero">
        <div>
          <Pill tone={attempt.completionStatus === "timed-out" ? "warn" : "good"}>{attempt.completionStatus === "timed-out" ? "Time expired · automatically submitted" : "Module submitted"}</Pill>
          <h1>{MODULE_LABELS[attempt.module]}</h1>
          <p>{attempt.planSessionTitle ? `${attempt.planSessionTitle} · adaptive plan` : attemptTitle(attempt)} · {report.label.toLowerCase()} · {attempt.freshQuestionCount} fresh</p>
        </div>
        <div className="raw-score">
          <strong>{attempt.rawScore}</strong>
          <span>/ {attempt.questionIds.length} raw</span>
          <small>{Math.round(report.accuracy * 100)}% accuracy{delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta} pts vs last` : ""}</small>
        </div>
      </section>
      {showScoreEstimate ? (
        <section className="panel result-estimate">
          {estimate ? <ScoreEstimateBlock estimate={estimate} /> : <ScoreEvidenceNotice report={report} />}
        </section>
      ) : null}
      <section className="result-metrics">
        <div><span>Correct</span><strong>{correct}</strong></div>
        <div><span>Incorrect</span><strong>{incorrect.length}</strong></div>
        <div><span>Unanswered</span><strong>{unanswered}</strong></div>
        <div><span>Time used</span><strong>{formatLongDuration(attempt.durationMs ?? 0)}</strong></div>
        <div><span>Average / question</span><strong>{formatDuration(pacing.actualMsPerQuestion)}</strong></div>
        <div><span>Median / question</span><strong>{formatDuration(median)}</strong></div>
      </section>
      <section className="result-insights">
        <article className="panel">
          <span className="eyebrow">Strongest sections</span>
          <h2>{topics.length ? topics[topics.length - 1].label : "Baseline captured"}</h2>
          <p>{topics.length ? `${topics[topics.length - 1].correct}/${topics[topics.length - 1].total} correct there. ${responses.filter((response) => response.correct && response.timeSpentMs < 90_000).length} answers were both fast and correct.` : "Complete a set to see section-level strengths."}</p>
        </article>
        <article className="panel">
          <span className="eyebrow">Where marks went</span>
          <h2>{pacing.rushedIncorrect} rushed · {pacing.slowIncorrect} slow</h2>
          <p>{unanswered ? `${unanswered} unanswered — never leave a blank, there is no negative marking. ` : ""}{pacing.verdict}</p>
        </article>
        <article className="panel">
          <span className="eyebrow">Next best action</span>
          <h2>{missed.length ? `Review and schedule ${missed.length} missed question${missed.length === 1 ? "" : "s"}` : "Expand fresh coverage"}</h2>
          <p>{missed.length ? "Incorrect and unanswered questions are now in the retrieval queue." : "A fresh unseen set adds more readiness evidence."}</p>
          {missed.length ? <button className="text-button" onClick={onRetryMissed}>Retry the missed questions now <ChevronRight size={16} /></button> : null}
        </article>
      </section>

      {topics.length ? (
        <section className="panel result-sections">
          <div className="panel-heading"><div><span className="eyebrow">Section breakdown</span><h2>How each area went</h2></div><TrendingUp size={18} /></div>
          <SectionTable rows={topics} />
        </section>
      ) : null}

      <QuestionTimingPanel attempt={attempt} questionMap={questionMap} />

      <section className="panel review-errors">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Question review & solutions</span>
            <h2>Review questions, worked solutions, and methods</h2>
          </div>
          <div className="log-filters">
            {([
              ["all", `All (${responses.length})`],
              ["correct", `Correct (${correct})`],
              ["missed", `Missed (${missed.length})`],
              ["flagged", `Flagged (${flaggedCount})`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                className={reviewFilter === id ? "selected" : ""}
                onClick={() => setReviewFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {filteredResponses.length === 0 ? (
          <p className="panel-footnote">No questions match the current filter.</p>
        ) : (
          filteredResponses.map((response) => {
            const question = questionMap[response.questionId];
            const isCorrect = Boolean(response.correct);
            return (
              <details key={response.questionId} className="result-question-detail">
                <summary className="result-question-summary">
                  <span>
                    <strong>#{attempt.questionIds.indexOf(response.questionId) + 1}</strong> · {sourceLabelForAttempt(question, attempt)} · {question?.esatTopic ?? "—"}
                  </span>
                  <div className="result-summary-right">
                    <span className="result-summary-answers">
                      {response.unanswered ? "Unanswered" : `Yours: ${response.finalAnswer}`} · Correct: <strong>{question?.correctAnswer ?? "—"}</strong>
                    </span>
                    <Pill tone={isCorrect ? "good" : response.unanswered ? "neutral" : "bad"}>
                      {isCorrect ? "Correct" : response.unanswered ? "Blank" : "Wrong"}
                    </Pill>
                    <ChevronRight size={16} />
                  </div>
                </summary>
                <div className="error-review-body">
                  {question?.questionImage
                    ? <img src={publicAsset(question.questionImage)} alt={`Review question ${question.id}`} loading="lazy" />
                    : <div className="authored-review"><p><MathText>{question?.questionText}</MathText></p><QuestionFigure question={question} /></div>}
                  <div>
                    {!isCorrect ? (
                      <>
                        <p><strong>Mistake diagnosis:</strong> Select every cause that genuinely applied.</p>
                        <div className="tag-picker">{ERROR_TAGS.map((tag) => <button className={response.errorClassifications.includes(tag) ? "selected" : ""} key={tag} onClick={() => onTag(response.questionId, tag)}>{tag}</button>)}</div>
                      </>
                    ) : null}
                    {!pageIsEmpty(scratchPages[response.questionId])
                      ? <ScratchpadPreview page={scratchPages[response.questionId]} label="Your working on this question" />
                      : null}
                  </div>
                  {question ? <div className="error-learning"><QuestionLearningSupport question={question} /></div> : null}
                </div>
              </details>
            );
          })
        )}
      </section>

      <footer className="result-actions">
        {attempt.sequenceRemaining?.length
          ? <button className="button button-primary" onClick={onContinue}>Continue to {MODULE_LABELS[attempt.sequenceRemaining[0]]} <ChevronRight size={17} /></button>
          : <button className="button button-primary" onClick={onClose}>{attempt.planSessionId ? "Continue today’s plan" : "Finish review"}</button>}
      </footer>
    </main>
  );
}
