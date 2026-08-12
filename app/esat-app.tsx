"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  Filter,
  Flag,
  Gauge,
  Home,
  LibraryBig,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  RotateCcw,
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
  daysUntil,
  defaultState,
  eligibleQuestions,
  esatPacedDurationMs,
  finalizeAttempt,
  formatDuration,
  formatLongDuration,
  listPaperSets,
  listTopics,
  mergeState,
  moduleStats,
  paperQuestions,
  remainingMs,
  settleCurrentVisit,
  type Attempt,
  type AttemptMode,
  type BankPayload,
  type ModuleId,
  type MockPayload,
  type PaperSet,
  type Question,
  type ResponseRecord,
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
  scoreEstimate,
  sectionBreakdown,
  type ScoreEstimate,
  type SectionRow,
} from "./lib/scoring";
import { MathText } from "./math-text";
import {
  deleteAttemptCloud,
  firebaseConfigured,
  loadUserStateCloud,
  observeUser,
  saveAttemptCloud,
  saveUserStateCloud,
  signInWithGoogle,
  signOutUser,
} from "./lib/firebase";

type ViewId = "dashboard" | "practice" | "originals" | "analytics" | "mistakes" | "papers" | "settings";
type QuestionFilter = "all" | "unseen" | "incorrect" | "due";
type HistoryFilter = "all" | "paper" | "original" | "strict" | "practice";
type AttemptKind = "paper" | "original" | "strict" | "practice";

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Overview", icon: Home },
  { id: "practice", label: "Practice", icon: BookOpen },
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

let cachedAssetBase: string | null = null;

function publicAsset(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  if (cachedAssetBase === null) {
    const configured = typeof document === "undefined"
      ? "/"
      : document.querySelector<HTMLMetaElement>('meta[name="esat-asset-base"]')?.content ?? "/";
    cachedAssetBase = configured.endsWith("/") ? configured : `${configured}/`;
  }
  return `${cachedAssetBase}${path.replace(/^\/+/, "")}`;
}

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
  return mergeState({
    ...local,
    attempts: mergeAttempts(remote.attempts, local.attempts),
    progress,
    mistakes,
    targets: { ...local.targets, ...(remoteValue.targets ?? {}) },
    settings: { ...local.settings, ...(remoteValue.settings ?? {}) },
    notes: { ...local.notes, ...(remoteValue.notes ?? {}) },
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
};

function attemptTitle(attempt: Attempt): string {
  if (attempt.mode === "historic") return attempt.sourceSetLabel || "Archive paper";
  if (attempt.mode === "original") return "Challenge Mock A";
  if (attempt.strictTimed) return "Strict 27-question module";
  if (attempt.mode === "retry") return "Targeted retry";
  return "Custom practice set";
}

function percent(value: number | null): string {
  return value === null ? "Not enough data" : `${Math.round(value * 100)}%`;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(timestamp);
}

function formatDateTime(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(timestamp);
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
            Your standing is read from the official {SCORE_MODEL.distributionSitting} ESAT score distribution published by UAT-UK, not from a model.
            The raw-to-scaled step is an estimate, because live forms are Rasch-equated per sitting.
          </p>
        </>
      ) : null}
    </div>
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

function LoginScreen({ busy, error, onSignIn }: { busy: boolean; error: string | null; onSignIn: () => void }) {
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
            <div><BarChart3 size={18} /><span><strong>Section-level analysis</strong><small>Estimated score, standing and topic breakdown for every attempt.</small></span></div>
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
          {error ? <div className="auth-error" role="alert"><TriangleAlert size={17} /><span>{error}</span></div> : null}
          <button className="google-button" onClick={onSignIn} disabled={busy || !firebaseConfigured()}>
            <span className="google-g" aria-hidden="true">G</span>
            <span>{busy ? "Connecting securely…" : "Continue with Google"}</span>
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
  const timedOutRef = useRef(false);
  const syncedUserRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const activeAttemptRef = useRef<Attempt | null>(null);
  const storageWarnedRef = useRef(false);
  const deepLinkReadRef = useRef(false);
  const tabIdRef = useRef("");
  const active = state.activeAttempt;
  const activeAttemptId = active?.attemptId;
  const activeQuestionIds = active?.questionIds;
  const activeQuestionIndex = active?.currentIndex;
  const activeEndsAt = active?.endsAt ?? null;
  const activePausedAt = active?.pausedAt ?? null;
  const resultAttemptId = result?.attemptId;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Hydration intentionally restores the persisted attempt after the first
      // client render; server rendering cannot access this device-local state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(mergeState(stored ? (JSON.parse(stored) as Partial<StoredState>) : null));
    } catch {
      setToast("Local progress could not be read; a clean local state was opened.");
    } finally {
      setHydrated(true);
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
      setUser(nextUser);
      setAuthReady(true);
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

  useEffect(() => {
    if (!hydrated || !user || syncedUserRef.current === user.uid) return;
    syncedUserRef.current = user.uid;
    setAuthBusy(true);
    loadUserStateCloud(user.uid)
      .then(async (remoteState) => {
        const merged = mergeCloudState(stateRef.current, remoteState);
        stateRef.current = merged;
        setState(merged);
        await saveUserStateCloud(user.uid, merged);
        setToast("Signed in. Your private Firebase progress is up to date.");
      })
      .catch((error: unknown) => {
        syncedUserRef.current = null;
        setToast(error instanceof Error ? `Signed in, but cloud progress could not load: ${error.message}` : "Signed in, but cloud progress could not load.");
      })
      .finally(() => setAuthBusy(false));
  }, [hydrated, user]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  // Persisting the whole record is cheap but not free, so writes are coalesced and
  // flushed if the page is hidden or closed before the timer fires.
  useEffect(() => {
    if (!hydrated) return;
    const write = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      } catch {
        if (!storageWarnedRef.current) {
          storageWarnedRef.current = true;
          setToast("This browser refused to save progress locally. Sign-in keeps your cloud copy safe.");
        }
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
  }, [state, hydrated]);

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
      if (attempt) saveAttemptCloud(user.uid, attempt).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [user, activeAttemptId]);

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
  const questionMap = useMemo(
    () => Object.fromEntries(effectiveQuestions.map((question) => [question.id, question])),
    [effectiveQuestions],
  );
  const approvedCounts = useMemo(
    () => Object.fromEntries(MODULE_ORDER.map((module) => [module, eligibleQuestions(bank?.questions ?? [], module).length])) as Record<ModuleId, number>,
    [bank],
  );
  const paperSets = useMemo(() => listPaperSets(bank?.questions ?? []), [bank]);

  const finishAttempt = useCallback(
    (timedOut = false) => {
      const current = stateRef.current;
      if (!current.activeAttempt) return;
      const finalized = finalizeAttempt(current.activeAttempt, questionMap, timedOut);
      const next = applyCompletedAttempt(current, finalized);
      stateRef.current = next;
      setState(next);
      setResult(finalized);
      setReviewOpen(false);
      timedOutRef.current = false;
      if (user) {
        Promise.all([saveAttemptCloud(user.uid, finalized), saveUserStateCloud(user.uid, next)]).catch(() =>
          setToast("Saved locally; cloud sync will be retried later."),
        );
      }
    },
    [questionMap, user],
  );

  // An attempt restored from a previous session may already have run out of time. This
  // runs once, before the live countdown below is allowed to submit anything, so a stale
  // empty session is discarded rather than recorded as a zero.
  const expiryCheckedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !bank || expiryCheckedRef.current) return;
    expiryCheckedRef.current = true;
    const attempt = stateRef.current.activeAttempt;
    if (!attempt || attempt.endsAt === null || attempt.endsAt > Date.now()) return;
    const answered = Object.values(attempt.responses).some((response) => response.selectedAnswer);
    if (answered) {
      finishAttempt(true);
      setToast("The timer on your saved session had already expired, so it was submitted with the answers you had given.");
    } else {
      setState((current) => ({ ...current, activeAttempt: null }));
      setToast("An expired empty session was discarded rather than recorded as a zero.");
    }
  }, [hydrated, bank, finishAttempt]);

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
      setReviewOpen(false);
    },
    [updateActive],
  );

  const toggleFlag = useCallback(() => {
    updateActive((attempt) => {
      const id = attempt.questionIds[attempt.currentIndex];
      if (!attempt.responses[id]) return attempt;
      return { ...attempt, responses: { ...attempt.responses, [id]: { ...attempt.responses[id], flagged: !attempt.responses[id].flagged } } };
    });
  }, [updateActive]);

  useEffect(() => {
    if (!active || !state.settings.keyboardShortcuts) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const currentQuestion = questionMap[active.questionIds[active.currentIndex]];
      if (!currentQuestion) return;
      const key = event.key.toUpperCase();
      const numberIndex = Number(event.key) - 1;
      if (Number.isInteger(numberIndex) && numberIndex >= 0 && numberIndex < currentQuestion.answerOptions.length) selectOption(currentQuestion.answerOptions[numberIndex]);
      else if (currentQuestion.answerOptions.includes(key)) selectOption(key);
      else if (event.key === "ArrowLeft") navigateQuestion(active.currentIndex - 1);
      else if (event.key === "ArrowRight") navigateQuestion(active.currentIndex + 1);
      else if (event.key === "Backspace" || event.key === "Delete") clearOption();
      else if (event.key === "Escape") setReviewOpen(false);
      else if (key === "F") toggleFlag();
      else if (key === "R") setReviewOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, clearOption, navigateQuestion, questionMap, selectOption, state.settings.keyboardShortcuts, toggleFlag]);

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
  ): void {
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
      progress: state.progress,
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
    setResult(null);
    setOpenAttemptId(null);
    setMultiTabWarning(false);
    timedOutRef.current = false;
    setState((current) => ({ ...current, activeAttempt: attempt }));
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
    setReviewOpen(false);
    setResult(null);
    setView("dashboard");
    timedOutRef.current = false;
    if (user) {
      deleteAttemptCloud(user.uid, discarded.attemptId).catch(() =>
        setToast("The session was discarded locally, but its cloud autosave could not be removed."),
      );
    }
  }

  function deleteAttempt(attemptId: string): void {
    setState((current) => ({ ...current, attempts: current.attempts.filter((attempt) => attempt.attemptId !== attemptId) }));
    setOpenAttemptId(null);
    setToast("That result was removed from your history. Question progress and the retrieval queue were left untouched.");
    if (user) deleteAttemptCloud(user.uid, attemptId).catch(() => undefined);
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
      setToast("Signed out securely. Your cloud progress remains in Firebase.");
    } catch {
      setToast("Sign-out did not complete. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  const daysRemaining = daysUntil(state.settings.examDate);
  const dueCount = Object.values(state.mistakes).filter((item) => item.dueDate <= tick).length;
  const weekStart = tick - 7 * 86_400_000;
  const studyMs = state.attempts
    .filter((attempt) => (attempt.endedAt ?? 0) >= weekStart)
    .reduce((sum, attempt) => sum + (attempt.durationMs ?? 0), 0);

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

  if (!user) return <LoginScreen busy={authBusy} error={authError} onSignIn={handleSignIn} />;

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
        setReviewOpen={setReviewOpen}
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
      />
    );
  }

  if (result) {
    return (
      <ResultScreen
        attempt={result}
        questionMap={questionMap}
        showScoreEstimate={state.settings.showScoreEstimate}
        previous={state.attempts.find((attempt) => attempt.attemptId !== result.attemptId && attempt.module === result.module && attemptKind(attempt) === attemptKind(result) && attempt.rawScore !== null) ?? null}
        onClose={() => { setResult(null); setView("dashboard"); }}
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
            <button className="icon-button" onClick={() => setState((current) => ({ ...current, settings: { ...current.settings, theme: current.settings.theme === "light" ? "dark" : "light" } }))} aria-label={`Switch to ${state.settings.theme === "light" ? "dark" : "light"} theme`}>
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
                  onPractice={() => setView("practice")}
                  onOpenAttempt={setOpenAttemptId}
                  onRecommended={() => {
                    const dueQuestions = Object.values(state.mistakes)
                      .filter((item) => item.dueDate <= tick)
                      .map((item) => questionMap[item.questionId])
                      .filter((question): question is Question => Boolean(question));
                    if (dueQuestions.length) {
                      const focusModule = dueQuestions[0].targetModule;
                      const focus = dueQuestions.filter((question) => question.targetModule === focusModule).slice(0, 10);
                      beginQuestionList(focus, focusModule, "retry", null, false);
                    } else {
                      const weakest = [...MODULE_ORDER].sort((left, right) => {
                        const leftStats = moduleStats(state.attempts, left).freshAccuracy ?? 1;
                        const rightStats = moduleStats(state.attempts, right).freshAccuracy ?? 1;
                        return leftStats - rightStats;
                      })[0];
                      beginSession({ module: weakest, count: 10, mode: "practice", filter: "unseen", durationMinutes: null, strictTimed: false });
                    }
                  }}
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
              {view === "analytics" ? <AnalyticsView attempts={state.attempts} questionMap={questionMap} showScoreEstimate={state.settings.showScoreEstimate} /> : null}
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
                  onNote={(questionId, note) => setState((current) => ({ ...current, notes: { ...current.notes, [questionId]: note } }))}
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
                  setState={setState}
                  onExportJson={() => download("esat-atlas-export.json", JSON.stringify(state, null, 2), "application/json")}
                  onExportCsv={() => {
                    const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
                    const rows = ["attemptId,kind,module,mode,sourceSet,sourceExams,sourceYears,startedAt,endedAt,rawScore,questionCount,accuracyPercent,estimatedScore,freshQuestionCount,durationMs"];
                    for (const attempt of state.attempts) {
                      const estimate = attempt.rawScore === null ? null : scoreEstimate(attempt.rawScore, attempt.questionIds.length, attempt.module);
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
                        estimate ? Math.round(estimate.accuracy * 100) : "",
                        estimate ? estimate.scaledScore.toFixed(1) : "",
                        attempt.freshQuestionCount,
                        attempt.durationMs ?? "",
                      ].map(csvCell).join(","));
                    }
                    download("esat-atlas-attempts.csv", rows.join("\n"), "text/csv");
                  }}
                  onReset={() => {
                    if (!window.confirm("Erase all local progress on this device? Cloud progress is not deleted and will sync back on the next sign-in.")) return;
                    localStorage.removeItem(STORAGE_KEY);
                    setState(defaultState());
                    setToast("Local progress cleared on this device.");
                  }}
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
    </div>
  );
}

function Dashboard({
  state,
  bank,
  approvedCounts,
  daysRemaining,
  dueCount,
  studyMs,
  questionMap,
  onPractice,
  onRecommended,
  onOpenAttempt,
}: {
  state: StoredState;
  bank: BankPayload;
  approvedCounts: Record<ModuleId, number>;
  daysRemaining: number | null;
  dueCount: number;
  studyMs: number;
  questionMap: Record<string, Question>;
  onPractice: () => void;
  onRecommended: () => void;
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
  const strictAttempts = state.attempts.filter((attempt) => attempt.strictTimed && attempt.rawScore !== null && attempt.freshQuestionCount > 0);
  const overall = combinedScoreEstimate(
    MODULE_ORDER
      .map((module) => stats[module])
      .filter((item) => item.recentRawAverage !== null && item.recentQuestionAverage !== null)
      .map((item) => ({ rawScore: item.recentRawAverage ?? 0, questionCount: item.recentQuestionAverage ?? 1 })),
  );
  const weeklyTargetMs = state.settings.weeklyHours * 3_600_000;
  const weakest = [...MODULE_ORDER]
    .filter((module) => stats[module].freshAccuracy !== null)
    .sort((left, right) => (stats[left].freshAccuracy ?? 1) - (stats[right].freshAccuracy ?? 1))[0];

  return (
    <>
      <section className="page-heading">
        <div>
          <Pill tone="blue"><Sparkles size={13} /> Evidence-led preparation</Pill>
          <h1>Your readiness, measured honestly.</h1>
          <p>Fresh performance predicts. Retakes teach. ESAT Atlas keeps them separate and shows an estimated score alongside every exact raw mark.</p>
        </div>
        <button className="button button-primary" onClick={onRecommended}><Play size={17} /> Recommended session</button>
      </section>

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
        <div><Clock3 size={18} /><span>Study this week<strong>{(studyMs / 3_600_000).toFixed(1)} / {state.settings.weeklyHours} h</strong></span></div>
        <div><Activity size={18} /><span>Archive coverage<strong>{attempted ? `${Math.min(100, Math.round(coverage * 100))}%` : "Not started"}</strong></span></div>
      </section>
      <div className="week-progress" aria-hidden="true"><i><b style={{ width: `${Math.min(100, weeklyTargetMs ? (studyMs / weeklyTargetMs) * 100 : 0)}%` }} /></i></div>

      <section className="dashboard-columns">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><span className="eyebrow">Exam readiness trend</span><h2>Fresh, timed performance only</h2></div><Pill tone="neutral">Retakes excluded</Pill></div>
          {strictAttempts.length ? (
            <div className="mini-trend">
              {strictAttempts.slice(0, 12).reverse().map((attempt) => (
                <button
                  key={attempt.attemptId}
                  className={`trend-bar ${attempt.module}`}
                  style={{ height: `${Math.max(8, ((attempt.rawScore ?? 0) / attempt.questionIds.length) * 100)}%` }}
                  title={`${MODULE_LABELS[attempt.module]} ${attempt.rawScore}/${attempt.questionIds.length} · ${formatDate(attempt.endedAt)}`}
                  onClick={() => onOpenAttempt(attempt.attemptId)}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No fresh trend yet" body="Sit a past paper or a strict 27-question module to establish your first honest baseline." action={<button className="button button-secondary" onClick={onPractice}>Choose a paper</button>} />
          )}
        </article>
        <article className="panel action-panel">
          <span className="eyebrow">Next best action</span>
          <div className="action-icon"><Brain size={22} /></div>
          <h2>{dueCount ? `Clear ${dueCount} retrieval question${dueCount === 1 ? "" : "s"}` : weakest ? `Strengthen ${MODULE_LABELS[weakest]}` : "Build a fresh baseline"}</h2>
          <p>{dueCount
            ? "These questions are due under the 1–3–7–14–30 day retrieval schedule."
            : weakest
              ? `${MODULE_LABELS[weakest]} has your lowest first-exposure accuracy, so unseen questions there add the most information.`
              : "No mistake items are due, so an unseen session expands coverage without inflating readiness."}</p>
          <button className="text-button" onClick={onRecommended}>Start recommended session <ChevronRight size={16} /></button>
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
              const estimate = scoreEstimate(attempt.rawScore ?? 0, attempt.questionIds.length, attempt.module);
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
                    {state.settings.showScoreEstimate ? <small>≈ {estimate.scaledScore.toFixed(1)}</small> : <small>{Math.round(estimate.accuracy * 100)}%</small>}
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
        <div><strong>Raw marks are exact</strong><span>The 1.0–9.0 figure is an ESAT Atlas estimate from published anchors, not a UAT-UK conversion.</span></div>
      </section>
    </>
  );
}

function PracticeView({
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
  const bestEstimate = best ? scoreEstimate(best.rawScore ?? 0, best.questionIds.length, best.module) : null;

  return (
    <>
      <section className="page-heading">
        <div><span className="eyebrow">Practice and simulation</span><h1>Train with a clear purpose.</h1><p>Sit a complete past paper by year, run a strict simulation, or build a targeted set. Every route records the same evidence.</p></div>
      </section>

      <section className="panel paper-picker">
        <div className="panel-heading">
          <div><span className="eyebrow">Past papers</span><h2>Choose a paper and sit it end to end</h2></div>
          <Pill tone="blue"><Timer size={13} /> Questions in original order</Pill>
        </div>
        <p className="panel-copy">Nothing is shuffled and nothing is sampled: you get that paper&apos;s questions, in the printed order, at the ESAT pace of 40 minutes per 27 questions.</p>
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
                  ? `${previous.length} recorded attempt${previous.length === 1 ? "" : "s"} · best ${best?.rawScore}/${best?.questionIds.length}${bestEstimate && state.settings.showScoreEstimate ? ` (≈ ${bestEstimate.scaledScore.toFixed(1)})` : ""}`
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

function OriginalMocksView({ payload, attempts, showScoreEstimate, onStart, onFull, onOpenAttempt }: {
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
          <p>Three original 27-question modules follow the 2026 specification and 40-minute structure. They are deliberately harder than the published archive, because recent candidate reports describe the live ESAT as harder than legacy NSAA papers. They are never presented as official UAT-UK questions.</p>
        </div>
        <button className="button button-primary" onClick={onFull}><Play size={17} /> Start full 120-minute mock</button>
      </section>
      <div className="integrity-banner original-integrity">
        <ShieldCheck size={18} />
        <div>
          <strong>81 distinct designs, checked answers, zero number-swapped copies</strong>
          <span>{payload.summary.distinctArchetypes} different reasoning archetypes cover every top-level specification area and passed structural, option and answer-key checks. Because these items sit above live difficulty, treat any estimated score here as a floor rather than a forecast.</span>
        </div>
      </div>
      <section className="original-grid">
        {MODULE_ORDER.map((module) => {
          const moduleAttempts = completed.filter((attempt) => attempt.module === module);
          const latest = moduleAttempts[0];
          const best = moduleAttempts.reduce<Attempt | null>((top, attempt) => (!top || (attempt.rawScore ?? 0) > (top.rawScore ?? 0) ? attempt : top), null);
          const estimate = best ? scoreEstimate(best.rawScore ?? 0, best.questionIds.length, best.module) : null;
          return (
            <article className={`original-card ${module}`} key={module}>
              <div className="original-card-head"><span className={`module-dot ${module}`} /><Pill tone="neutral">Challenge Mock A</Pill></div>
              <h2>{MODULE_LABELS[module]}</h2>
              <p>27 structurally distinct questions · 40 minutes · no calculator · no negative marking.</p>
              <div className="original-score">
                <span>Latest / best</span>
                <strong>{latest ? `${latest.rawScore}/27` : "Not attempted"}{best && latest && best.attemptId !== latest.attemptId ? ` · best ${best.rawScore}/27` : ""}</strong>
                {estimate && showScoreEstimate ? <small>≈ {estimate.scaledScore.toFixed(1)} estimated</small> : null}
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

function AnalyticsView({ attempts, questionMap, showScoreEstimate }: { attempts: Attempt[]; questionMap: Record<string, Question>; showScoreEstimate: boolean }) {
  const completed = attempts.filter((attempt) => attempt.rawScore !== null);
  const allResponses = completed.flatMap((attempt) => Object.values(attempt.responses));
  const fresh = allResponses.filter((response) => response.firstExposure);
  const retakes = allResponses.filter((response) => !response.firstExposure);
  const strict = completed.filter((attempt) => attempt.strictTimed && attempt.freshQuestionCount > 0);
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
          <section className="analytics-grid">
            <article className="panel wide-panel">
              <div className="panel-heading"><div><span className="eyebrow">Fresh score trend</span><h2>Strict modules</h2></div>{showScoreEstimate ? <Pill tone="neutral">Bars show raw marks</Pill> : null}</div>
              {strict.length ? (
                <div className="large-trend">
                  {strict.slice(0, 16).reverse().map((attempt) => (
                    <div key={attempt.attemptId} className="trend-column">
                      <div className={`trend-bar ${attempt.module}`} style={{ height: `${((attempt.rawScore ?? 0) / attempt.questionIds.length) * 100}%` }} title={`${attemptTitle(attempt)} · ${formatDate(attempt.endedAt)}`} />
                      <span>{attempt.rawScore}</span>
                      <small>{MODULE_LABELS[attempt.module].replace("Mathematics ", "M")}</small>
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon={Activity} title="No strict modules" body="Practice results are deliberately excluded from this readiness chart." />}
            </article>
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

function MistakesView({ state, now, questionMap, onRetry, onRedo, onNote, scope, setScope, module, setModule, timed, setTimed }: {
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
  const items = Object.values(state.mistakes).sort((left, right) => left.dueDate - right.dueDate);
  const dueNow = items.filter((item) => item.dueDate <= now).length;
  const countFor = (target: ModuleId, targetScope: "all" | "due") => items.filter((item) => {
    const question = questionMap[item.questionId];
    if (!question || question.targetModule !== target) return false;
    return targetScope === "all" || item.dueDate <= now;
  }).length;
  const selectedCount = countFor(module, scope);
  const mastered = Object.values(state.progress).filter((item) => item.mastered).length;

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">Spaced retrieval</span>
          <h1>Mistakes become scheduled work.</h1>
          <p>A correct retry is progress, not instant mastery. Three delayed successes are required before an item leaves the queue.</p>
        </div>
      </section>

      <section className="metric-strip">
        <div><Brain size={18} /><span>In the queue<strong>{items.length} question{items.length === 1 ? "" : "s"}</strong></span></div>
        <div><RotateCcw size={18} /><span>Due now<strong>{dueNow}</strong></span></div>
        <div><CheckCircle2 size={18} /><span>Mastered<strong>{mastered}</strong></span></div>
        <div><Clock3 size={18} /><span>Next due<strong>{items.length ? formatDate(items[0].dueDate) : "—"}</strong></span></div>
      </section>

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
                <button className={scope === "all" ? "selected" : ""} onClick={() => setScope("all")}>Every mistake</button>
                <button className={scope === "due" ? "selected" : ""} onClick={() => setScope("due")}>Due now only</button>
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
                {scope === "all" ? "Every mistake still in the queue" : "Only what the schedule has brought back today"}
                {timed ? ` · ${formatDuration(esatPacedDurationMs(selectedCount))} strict, no pause` : " · untimed, pause allowed"}
              </span>
            </div>
            <button className="button button-primary" onClick={onRedo} disabled={!selectedCount}>
              <RotateCcw size={17} /> Redo {selectedCount || "these"}
            </button>
          </div>
        </section>
      ) : null}
      {!items.length ? <EmptyState icon={Brain} title="No mistakes in the queue" body="Incorrect answers will enter a transparent 1–3–7–14–30 day retrieval schedule." /> : (
        <section className="mistake-list">
          {items.map((item) => {
            const question = questionMap[item.questionId];
            if (!question) return null;
            const due = item.dueDate <= now;
            return (
              <article className="mistake-card" key={item.questionId}>
                {question.questionImage
                  ? <img src={publicAsset(question.questionImage)} alt={`${question.sourceExam} ${question.year} question ${question.originalQuestionNumber}`} loading="lazy" />
                  : <div className="mistake-text-preview"><MathText>{question.questionText}</MathText></div>}
                <div className="mistake-copy">
                  <div><Pill tone={due ? "bad" : "neutral"}>{due ? "Due now" : `Due ${formatDate(item.dueDate)}`}</Pill><Pill tone="blue">{MODULE_LABELS[question.targetModule]}</Pill></div>
                  <h3>{question.esatTopic} · {sourceLabel(question)}</h3>
                  <p>{item.correctStreak}/3 delayed correct responses · current interval {item.intervalDays} day{item.intervalDays === 1 ? "" : "s"}</p>
                  <textarea value={state.notes[item.questionId] ?? ""} onChange={(event) => onNote(item.questionId, event.target.value)} placeholder="Personal note, e.g. remember the sign convention…" aria-label={`Note for ${sourceLabel(question)}`} />
                  <button className="button button-secondary compact" onClick={() => onRetry(question)}><RotateCcw size={15} /> Retry question</button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

function PaperHistoryView({ state, paperSets, filter, setFilter, showScoreEstimate, onStart, onOpenAttempt }: {
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
          <div className="history-filters" role="tablist" aria-label="Filter results">
            {filters.map((item) => (
              <button key={item.id} role="tab" aria-selected={filter === item.id} className={filter === item.id ? "selected" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>
            ))}
          </div>
          {visible.length ? (
            <section className="panel history-list">
              <div className="history-row header-row">
                <span>Set</span><span>Module</span><span>Completed</span><span>Raw</span><span>Accuracy</span><span>{showScoreEstimate ? "Estimated" : "Time"}</span><span>Standing</span><span />
              </div>
              {visible.map((attempt) => {
                const estimate = scoreEstimate(attempt.rawScore ?? 0, attempt.questionIds.length, attempt.module);
                return (
                  <div className="history-row" key={attempt.attemptId}>
                    <span className="history-set"><strong>{attemptTitle(attempt)}</strong><small>{KIND_LABELS[attemptKind(attempt)]}{attempt.completionStatus === "timed-out" ? " · timed out" : ""}</small></span>
                    <span><span className={`module-dot ${attempt.module}`} />{MODULE_LABELS[attempt.module]}</span>
                    <span>{formatDate(attempt.endedAt)}</span>
                    <strong>{attempt.rawScore}/{attempt.questionIds.length}</strong>
                    <span>{Math.round(estimate.accuracy * 100)}%</span>
                    <span>{showScoreEstimate ? estimate.scaledScore.toFixed(1) : formatLongDuration(attempt.durationMs ?? 0)}</span>
                    <Pill tone={estimate.tone}>{showScoreEstimate ? estimate.standing : estimate.band}</Pill>
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
        <EmptyState icon={LibraryBig} title="No completed sessions yet" body="Sit a past paper from the library below and your score, section breakdown and estimated standing will appear here." />
      )}

      <div className="integrity-banner">
        <TriangleAlert size={18} />
        <div>
          <strong>Raw marks are exact; the 1.0–9.0 figure is an ESAT Atlas estimate.</strong>
          <span>UAT-UK equates each live form with a Rasch model and does not publish the conversion tables. The estimate is anchored only on the published facts that a typical score is about 4.5 and roughly 10% of candidates exceed 7.0.</span>
        </div>
      </div>

      <section className="panel paper-library">
        <div className="panel-heading"><div><span className="eyebrow">Source-set library</span><h2>Every paper you can sit</h2></div></div>
        <div className="paper-library-row header-row"><span>Source</span><span>Year / set</span><span>Module</span><span>Questions / cap</span><span>Attempts</span><span>Your best</span><span /></div>
        {paperSets.map((set) => {
          const attempts = paperAttempts.filter((attempt) => attemptPaperKey(attempt) === set.key);
          const best = bestByPaper.get(set.key);
          const estimate = best ? scoreEstimate(best.rawScore ?? 0, best.questionIds.length, best.module) : null;
          return (
            <div className="paper-library-row" key={set.key}>
              <strong>{set.sourceExam}</strong>
              <span>{set.year}<small>{set.sectionLabel}</small></span>
              <span>{MODULE_LABELS[set.module]}</span>
              <span>{set.questionCount}<small>{formatDuration(set.durationMs)} strict</small></span>
              <strong>{attempts.length}</strong>
              <strong>{best ? `${best.rawScore}/${best.questionIds.length}` : "—"}{estimate && showScoreEstimate ? <small>≈ {estimate.scaledScore.toFixed(1)}</small> : null}</strong>
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

function AttemptDetailView({ attempt, questionMap, attempts, showScoreEstimate, onBack, onDelete, onResit }: {
  attempt: Attempt;
  questionMap: Record<string, Question>;
  attempts: Attempt[];
  showScoreEstimate: boolean;
  onBack: () => void;
  onDelete: () => void;
  onResit: () => void;
}) {
  const [logFilter, setLogFilter] = useState<"all" | "missed" | "flagged">("all");
  const responses = attempt.questionIds.map((id) => attempt.responses[id]).filter(Boolean);
  const estimate = scoreEstimate(attempt.rawScore ?? 0, attempt.questionIds.length, attempt.module);
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
  // Papers differ in length, so the comparison is in percentage points, not raw marks.
  const delta = previous && previous.rawScore !== null
    ? Math.round((estimate.accuracy - previous.rawScore / previous.questionIds.length) * 100)
    : null;

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
          <small>{Math.round(estimate.accuracy * 100)}% accuracy{delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta} pts vs previous attempt` : ""}</small>
        </div>
        {showScoreEstimate ? <ScoreEstimateBlock estimate={estimate} /> : null}
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
            {[attempt, ...sameSet].map((item) => (
              <div key={item.attemptId} className={item.attemptId === attempt.attemptId ? "compare-row current" : "compare-row"}>
                <span>{formatDate(item.endedAt)}</span>
                <i><b style={{ width: `${((item.rawScore ?? 0) / item.questionIds.length) * 100}%` }} /></i>
                <strong>{item.rawScore}/{item.questionIds.length}</strong>
                {showScoreEstimate ? <small>≈ {scoreEstimate(item.rawScore ?? 0, item.questionIds.length, item.module).scaledScore.toFixed(1)}</small> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel question-log">
        <div className="panel-heading">
          <div><span className="eyebrow">Question by question</span><h2>Open any question to see it again</h2></div>
          <div className="log-filters">
            {([["all", "All"], ["missed", "Missed only"], ["flagged", "Flagged"]] as const).map(([id, label]) => (
              <button key={id} className={logFilter === id ? "selected" : ""} onClick={() => setLogFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="log-row header-row"><span>#</span><span>Source</span><span>Topic</span><span>Yours</span><span>Correct</span><span>Time</span><span>Result</span></div>
        {attempt.questionIds.map((id, index) => {
          const response = attempt.responses[id];
          const question = questionMap[id];
          if (!response) return null;
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
                    ? <div className="authored-review"><p><MathText>{question.questionText}</MathText></p></div>
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
                    {question.explanation
                      ? <div className="log-explanation"><strong>Worked solution</strong><p><MathText>{question.explanation}</MathText></p></div>
                      : <p className="panel-footnote">No worked solution is published for this archive question. The official answer is {question.correctAnswer}.</p>}
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

function SettingsView({ state, setState, onExportJson, onExportCsv, onReset }: {
  state: StoredState;
  setState: React.Dispatch<React.SetStateAction<StoredState>>;
  onExportJson: () => void;
  onExportCsv: () => void;
  onReset: () => void;
}) {
  const clampTarget = (value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(9, Math.max(1, Math.round(parsed * 10) / 10));
  };
  return (
    <>
      <section className="page-heading"><div><span className="eyebrow">Personal settings</span><h1>Targets and study constraints.</h1><p>Personal targets are planning aids, never official Cambridge thresholds.</p></div></section>
      <section className="settings-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Module targets</span><h2>Your own goals</h2></div></div>
          {MODULE_ORDER.map((module) => (
            <label className="setting-row" key={module}>
              <span>{MODULE_LABELS[module]}<small>1.0–9.0 personal target</small></span>
              <input type="number" min="1" max="9" step="0.1" value={state.targets[module]} onChange={(event) => setState((current) => ({ ...current, targets: { ...current.targets, [module]: clampTarget(event.target.value) } }))} />
            </label>
          ))}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Study planner</span><h2>Time available</h2></div></div>
          <label className="setting-row">
            <span>ESAT date<small>Used for the countdown</small></span>
            <input type="date" value={state.settings.examDate} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, examDate: event.target.value } }))} />
          </label>
          <label className="setting-row">
            <span>Weekly hours<small>Compared against your recorded session time</small></span>
            <input type="number" min="1" max="40" value={state.settings.weeklyHours} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, weeklyHours: Math.min(40, Math.max(1, Math.round(Number(event.target.value) || 1))) } }))} />
          </label>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Player and reporting</span><h2>Interaction</h2></div></div>
          <label className="toggle-row"><span>Keyboard shortcuts<small>A–H, 1–8, arrows, backspace, F and R</small></span><input type="checkbox" checked={state.settings.keyboardShortcuts} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, keyboardShortcuts: event.target.checked } }))} /></label>
          <label className="toggle-row"><span>Strict-mode pacing aid<small>Optional; hidden by default</small></span><input type="checkbox" checked={state.settings.pacingAid} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, pacingAid: event.target.checked } }))} /></label>
          <label className="toggle-row"><span>Show estimated 1.0–9.0 score<small>Turn off to work from raw marks only</small></span><input type="checkbox" checked={state.settings.showScoreEstimate} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, showScoreEstimate: event.target.checked } }))} /></label>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Data portability</span><h2>Own your revision record</h2></div></div>
          <p className="panel-copy">Export attempts, responses, progress, mistakes, timing, targets and notes at any time.</p>
          <div className="export-actions">
            <button className="button button-secondary" onClick={onExportJson}><Download size={16} /> Export JSON</button>
            <button className="button button-secondary" onClick={onExportCsv}><Download size={16} /> Attempts CSV</button>
          </div>
          <p className="panel-footnote">Clearing local data does not delete your Firebase copy; signing in again restores it.</p>
          <button className="button button-ghost" onClick={onReset}><TriangleAlert size={16} /> Clear local progress</button>
        </article>
      </section>
      <ScoreMethodology />
    </>
  );
}

function ExamPlayer({ attempt, questionMap, now, reviewOpen, setReviewOpen, onSelect, onClear, onNavigate, onFlag, onConfidence, onFinish, onExit, onPause, pacingAid, multiTabWarning, dismissMultiTab }: {
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
      <header className="exam-header">
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
        <main className="review-screen">
          <div className="review-heading">
            <div><span className="eyebrow">Module review</span><h1>Check before submitting</h1><p>{answered} answered · {attempt.questionIds.length - answered} unanswered · {Object.values(attempt.responses).filter((item) => item.flagged).length} flagged</p></div>
            <button className="button button-secondary" onClick={() => setReviewOpen(false)}>Return to question</button>
          </div>
          <div className="review-grid">
            {attempt.questionIds.map((id, index) => {
              const item = attempt.responses[id];
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
        <main className="exam-content">
          <section className="question-stage">
            <div className="question-toolbar">
              <div><Pill tone="neutral">{displayedSource}</Pill>{!attempt.strictTimed ? <Pill tone="blue">{question.esatTopic}</Pill> : null}</div>
              <div>
                {pacingAid && attempt.strictTimed ? <span className={paceDifference >= 0 ? "pace-ahead" : "pace-behind"}>{formatDuration(Math.abs(paceDifference))} {paceDifference >= 0 ? "ahead" : "behind"}</span> : null}
                <button className={response.flagged ? "flag-button flagged" : "flag-button"} onClick={onFlag} aria-pressed={response.flagged}><Flag size={16} /> {response.flagged ? "Flagged" : "Flag for review"}</button>
              </div>
            </div>
            <div className={`question-image-frame ${question.authored ? "authored-frame" : ""}`}>
              {question.questionImage
                ? <img src={publicAsset(question.questionImage)} alt={`${question.sourceExam} ${question.year} question ${question.originalQuestionNumber}`} />
                : <div className="authored-question"><span>Question {attempt.currentIndex + 1}</span><p><MathText>{question.questionText}</MathText></p><small>Original ESAT Atlas challenge item</small></div>}
            </div>
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
        <footer className="exam-footer">
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

function ResultScreen({ attempt, questionMap, showScoreEstimate, previous, onClose, onContinue, onRetryMissed, onTag }: {
  attempt: Attempt;
  questionMap: Record<string, Question>;
  showScoreEstimate: boolean;
  previous: Attempt | null;
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
  const estimate = scoreEstimate(attempt.rawScore ?? 0, attempt.questionIds.length, attempt.module);
  const topics = sectionBreakdown(responses, questionMap);
  const pacing = pacingSummary(responses, attempt.questionIds.length, attempt.durationMs ?? 0);
  const delta = previous && previous.rawScore !== null
    ? Math.round(((attempt.rawScore ?? 0) / attempt.questionIds.length - previous.rawScore / previous.questionIds.length) * 100)
    : null;

  return (
    <main className="result-screen">
      <header className="result-header">
        <div className="sidebar-brand"><div className="brand-mark">EA</div><div><strong>ESAT Atlas</strong><span>Session result</span></div></div>
        <button className="button button-secondary" onClick={onClose}>Back to dashboard</button>
      </header>
      <section className="result-hero">
        <div>
          <Pill tone={attempt.completionStatus === "timed-out" ? "warn" : "good"}>{attempt.completionStatus === "timed-out" ? "Time expired · automatically submitted" : "Module submitted"}</Pill>
          <h1>{MODULE_LABELS[attempt.module]}</h1>
          <p>{attemptTitle(attempt)} · {attempt.strictTimed ? "strict evidence" : "practice evidence"} · {attempt.freshQuestionCount} fresh</p>
        </div>
        <div className="raw-score">
          <strong>{attempt.rawScore}</strong>
          <span>/ {attempt.questionIds.length} raw</span>
          <small>{Math.round(estimate.accuracy * 100)}% accuracy{delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta} pts vs last` : ""}</small>
        </div>
      </section>
      {showScoreEstimate ? <section className="panel result-estimate"><ScoreEstimateBlock estimate={estimate} /></section> : null}
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
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Section breakdown</span><h2>How each area went</h2></div><TrendingUp size={18} /></div>
          <SectionTable rows={topics} />
        </section>
      ) : null}

      {missed.length ? (
        <section className="panel review-errors">
          <div className="panel-heading"><div><span className="eyebrow">Mistake diagnosis</span><h2>Confirm why each mark was lost</h2></div></div>
          {missed.map((response) => {
            const question = questionMap[response.questionId];
            return (
              <details key={response.questionId}>
                <summary>
                  <span>{sourceLabelForAttempt(question, attempt)} · {question?.esatTopic ?? "—"}</span>
                  <strong>{response.unanswered ? "Unanswered" : `Your answer ${response.finalAnswer}`} · Correct {question?.correctAnswer ?? "—"}</strong>
                  <ChevronRight size={16} />
                </summary>
                <div className="error-review-body">
                  {question?.questionImage
                    ? <img src={publicAsset(question.questionImage)} alt={`Review question ${question.id}`} loading="lazy" />
                    : <div className="authored-review"><p><MathText>{question?.questionText}</MathText></p><strong>Worked solution</strong><span><MathText>{question?.explanation}</MathText></span></div>}
                  <div>
                    <p>Select every cause that genuinely applied.</p>
                    <div className="tag-picker">{ERROR_TAGS.map((tag) => <button className={response.errorClassifications.includes(tag) ? "selected" : ""} key={tag} onClick={() => onTag(response.questionId, tag)}>{tag}</button>)}</div>
                  </div>
                </div>
              </details>
            );
          })}
        </section>
      ) : null}

      <footer className="result-actions">
        {attempt.sequenceRemaining?.length
          ? <button className="button button-primary" onClick={onContinue}>Continue to {MODULE_LABELS[attempt.sequenceRemaining[0]]} <ChevronRight size={17} /></button>
          : <button className="button button-primary" onClick={onClose}>Finish review</button>}
      </footer>
    </main>
  );
}
