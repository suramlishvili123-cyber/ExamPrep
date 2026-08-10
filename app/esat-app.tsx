"use client";

import {
  Activity,
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
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MODULE_LABELS,
  STORAGE_KEY,
  applyCompletedAttempt,
  chooseQuestions,
  createAttempt,
  daysUntil,
  defaultState,
  eligibleQuestions,
  esatPacedDurationMs,
  finalizeAttempt,
  formatDuration,
  mergeState,
  moduleStats,
  remainingMs,
  settleCurrentVisit,
  type Attempt,
  type AttemptMode,
  type BankPayload,
  type ModuleId,
  type MockPayload,
  type Question,
  type StoredState,
} from "./lib/core";
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

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Overview", icon: Home },
  { id: "practice", label: "Practice", icon: BookOpen },
  { id: "originals", label: "Original mocks", icon: Sparkles },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "mistakes", label: "Mistakes", icon: Brain },
  { id: "papers", label: "Paper history", icon: LibraryBig },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

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

function publicAsset(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  const configuredBase = typeof document === "undefined"
    ? "/"
    : document.querySelector<HTMLMetaElement>('meta[name="esat-asset-base"]')?.content ?? "/";
  const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
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

function sourceLabel(question: Question): string {
  if (question.authored) return `Original · ${question.sourcePaper} · Q${question.originalQuestionNumber}`;
  const section = question.sourceExam === "ENGAA" ? "Part B" : question.sourceExam === "TMUA" ? "Paper 1" : question.sourcePart === "E" ? "Part E" : "Section 1";
  return `${question.sourceExam} ${question.year} · ${section} · Q${question.originalQuestionNumber}`;
}

function sourceLabelForAttempt(question: Question, attempt: Attempt): string {
  const requestedExam = attempt.mode === "historic" ? attempt.sourceExams?.[0] : null;
  const alternate = requestedExam && requestedExam !== question.sourceExam
    ? question.alternateSources?.find((source) => source.sourceExam === requestedExam)
    : null;
  if (!alternate) return sourceLabel(question);
  return `${alternate.sourceExam} ${question.year} · Part ${alternate.sourcePart} · Q${alternate.originalQuestionNumber} · retained equivalent`;
}

function belongsToSourceSet(question: Question, sourceExam: string, year: number): boolean {
  return (question.sourceExam === sourceExam && question.year === year)
    || Boolean(question.alternateSources?.some((source) => source.sourceExam === sourceExam && question.year === year));
}

function practiceSignal(correct: number, total: number): { label: string; detail: string } {
  const accuracy = total ? correct / total : 0;
  if (accuracy >= 0.82) return { label: "Strong practice signal", detail: "High raw accuracy under this set's conditions. Confirm it across fresh strict modules." };
  if (accuracy >= 0.67) return { label: "Competitive practice signal", detail: "A useful working range, with enough missed marks to guide targeted revision." };
  if (accuracy >= 0.52) return { label: "Developing practice signal", detail: "The baseline is usable; prioritise repeated topic weaknesses and pacing." };
  return { label: "Foundation-building signal", detail: "Use this result diagnostically, then retest with fresh questions after retrieval practice." };
}

function percent(value: number | null): string {
  return value === null ? "Not enough data" : `${Math.round(value * 100)}%`;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(timestamp);
}

function download(filename: string, contents: string, type: string): void {
  const href = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
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

function LoginScreen({
  busy,
  error,
  onSignIn,
}: {
  busy: boolean;
  error: string | null;
  onSignIn: () => void;
}) {
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
          <p>Train with the validated archive, sit high-difficulty original mocks, and turn every result into a clear revision plan.</p>
          <div className="auth-benefits">
            <div><Target size={18} /><span><strong>Structured practice</strong><small>Maths 1, Physics and Maths 2 in one place.</small></span></div>
            <div><BarChart3 size={18} /><span><strong>Meaningful analytics</strong><small>Accuracy, pacing and first-exposure performance.</small></span></div>
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
  const [tick, setTick] = useState(Date.now());
  const [builderModule, setBuilderModule] = useState<ModuleId>("maths1");
  const [builderCount, setBuilderCount] = useState(10);
  const [builderFilter, setBuilderFilter] = useState<QuestionFilter>("unseen");
  const [builderTiming, setBuilderTiming] = useState<"untimed" | "pace" | "module">("pace");
  const timedOutRef = useRef(false);
  const syncedUserRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const tabIdRef = useRef(`tab-${Math.random().toString(36).slice(2)}`);
  const active = state.activeAttempt;
  const activeAttemptId = active?.attemptId;
  const activeQuestionIds = active?.questionIds;
  const activeQuestionIndex = active?.currentIndex;
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
      .catch(() => setToast("The validated question bank could not be loaded."));
    fetch(publicAsset("data/original-mocks.json"))
      .then((response) => {
        if (!response.ok) throw new Error("Original mocks unavailable");
        return response.json() as Promise<MockPayload>;
      })
      .then(setMockBank)
      .catch(() => setToast("The original challenge mocks could not be loaded."));
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
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view, activeAttemptId, resultAttemptId, reviewOpen]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user || !state.activeAttempt) return;
    const interval = window.setInterval(() => {
      saveAttemptCloud(user.uid, state.activeAttempt as Attempt).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [user, state.activeAttempt]);

  useEffect(() => {
    if (!activeAttemptId || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("esat-active-attempt");
    channel.postMessage({ type: "active", tabId: tabIdRef.current, attemptId: activeAttemptId });
    channel.onmessage = (event: MessageEvent<{ type: string; tabId: string; attemptId: string }>) => {
      if (event.data.type === "active" && event.data.tabId !== tabIdRef.current && event.data.attemptId === activeAttemptId) {
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
    () => Object.fromEntries((Object.keys(MODULE_LABELS) as ModuleId[]).map((module) => [module, eligibleQuestions(bank?.questions ?? [], module).length])) as Record<ModuleId, number>,
    [bank],
  );

  const finishAttempt = useCallback(
    (timedOut = false) => {
      if (!state.activeAttempt || !bank) return;
      const finalized = finalizeAttempt(state.activeAttempt, questionMap, timedOut);
      const next = applyCompletedAttempt(state, finalized);
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
    [bank, questionMap, state, user],
  );

  useEffect(() => {
    if (!active || active.pausedAt || active.completionStatus !== "active") return;
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
        if (prior.selectedAnswer === letter) return attempt;
        return {
          ...attempt,
          responses: {
            ...attempt.responses,
            [questionId]: {
              ...prior,
              selectedAnswer: letter,
              firstSelectedAnswer: prior.firstSelectedAnswer ?? letter,
              answerChanges: [
                ...prior.answerChanges,
                { from: prior.selectedAnswer, to: letter, at: Date.now() },
              ],
              timestamps: [...prior.timestamps, Date.now()],
            },
          },
        };
      });
    },
    [updateActive],
  );

  const navigateQuestion = useCallback(
    (index: number) => {
      updateActive((attempt) => {
        if (attempt.pausedAt) return attempt;
        const settled = settleCurrentVisit(attempt);
        const safeIndex = Math.max(0, Math.min(index, settled.questionIds.length - 1));
        const nextId = settled.questionIds[safeIndex];
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
      return { ...attempt, responses: { ...attempt.responses, [id]: { ...attempt.responses[id], flagged: !attempt.responses[id].flagged } } };
    });
  }, [updateActive]);

  useEffect(() => {
    if (!active || !state.settings.keyboardShortcuts) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const currentQuestion = questionMap[active.questionIds[active.currentIndex]];
      const key = event.key.toUpperCase();
      const numberIndex = Number(event.key) - 1;
      if (numberIndex >= 0 && numberIndex < currentQuestion.answerOptions.length) selectOption(currentQuestion.answerOptions[numberIndex]);
      else if (currentQuestion.answerOptions.includes(key)) selectOption(key);
      else if (event.key === "ArrowLeft") navigateQuestion(active.currentIndex - 1);
      else if (event.key === "ArrowRight") navigateQuestion(active.currentIndex + 1);
      else if (key === "F") toggleFlag();
      else if (key === "R") setReviewOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, navigateQuestion, questionMap, selectOption, state.settings.keyboardShortcuts, toggleFlag]);

  function beginSession(args: {
    module: ModuleId;
    count: number;
    mode: AttemptMode;
    filter?: QuestionFilter;
    durationMinutes: number | null;
    strictTimed: boolean;
    year?: number;
    originalHistoricSet?: boolean;
    sequenceRemaining?: ModuleId[];
  }): void {
    if (!bank) return;
    const pool = chooseQuestions(
      bank.questions,
      args.module,
      args.count,
      state.progress,
      args.filter ?? "all",
      state.mistakes,
      args.year,
    );
    if (pool.length < args.count) {
      setToast(`Only ${pool.length} eligible ${MODULE_LABELS[args.module]} question${pool.length === 1 ? " is" : "s are"} available for that filter.`);
      return;
    }
    beginQuestionList(pool, args.module, args.mode, args.durationMinutes, args.strictTimed, Boolean(args.originalHistoricSet), args.sequenceRemaining);
  }

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
    setState((current) => ({ ...current, activeAttempt: attempt }));
  }

  function beginHistoric(sourceExam: string, year: number, module: ModuleId): void {
    const pool = eligibleQuestions(bank?.questions ?? [], module).filter((question) => belongsToSourceSet(question, sourceExam, year));
    if (!pool.length) {
      setToast("No validated questions are available for that historic set.");
      return;
    }
    const sourceDetail = sourceExam === "ENGAA" ? "Part B" : sourceExam === "TMUA" ? "Paper 1" : "Section 1";
    const durationMinutes = esatPacedDurationMs(pool.length) / 60_000;
    beginQuestionList(pool, module, "historic", durationMinutes, true, true, undefined, "archive", { exam: sourceExam, year, label: `${sourceExam} ${year} · ${sourceDetail}` });
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
    const unavailable = (Object.keys(MODULE_LABELS) as ModuleId[]).find((module) => approvedCounts[module] < 27);
    if (unavailable) {
      setToast(`${MODULE_LABELS[unavailable]} needs 27 approved questions before a full Engineering mock can run.`);
      return;
    }
    beginSession({ module: "maths1", count: 27, mode: "exam", filter: "all", durationMinutes: 40, strictTimed: true, sequenceRemaining: ["physics", "maths2"] });
  }

  function continueSequence(attempt: Attempt): void {
    const [module, ...rest] = attempt.sequenceRemaining ?? [];
    if (!module) {
      setResult(null);
      setView("dashboard");
      return;
    }
    if (attempt.sequenceSource === "original") beginOriginal(module, rest);
    else beginSession({ module, count: 27, mode: "exam", filter: "all", durationMinutes: 40, strictTimed: true, sequenceRemaining: rest });
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

  if (!user) {
    return (
      <LoginScreen
        busy={authBusy}
        error={authError}
        onSignIn={handleSignIn}
      />
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
        onNavigate={navigateQuestion}
        onFlag={toggleFlag}
        onConfidence={(confidence) => updateActive((attempt) => {
          const id = attempt.questionIds[attempt.currentIndex];
          return { ...attempt, responses: { ...attempt.responses, [id]: { ...attempt.responses[id], confidence } } };
        })}
        onFinish={() => {
          if (window.confirm("Submit this module now? You will not be able to change these answers.")) finishAttempt(false);
        }}
        onExit={() => {
          if (window.confirm("Exit to the home page and discard this attempt? Your answers and timing for this session will not be saved.")) {
            discardActiveAttempt();
          }
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
        onClose={() => { setResult(null); setView("dashboard"); }}
        onContinue={() => continueSequence(result)}
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

  return (
    <div className="app-shell">
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
              <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => { setView(item.id); setSidebarOpen(false); }}>
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
            <button className="icon-button" onClick={() => setState((current) => ({ ...current, settings: { ...current.settings, theme: current.settings.theme === "light" ? "dark" : "light" } }))} aria-label="Toggle theme">
              {state.settings.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="account-button" onClick={handleSignOut} title="Sign out" disabled={authBusy}>
              {user.photoURL ? <img src={user.photoURL} alt="" /> : <UserRound size={18} />}
              <span>{user.displayName ?? user.email ?? "Signed in"}</span><LogOut size={15} />
            </button>
          </div>
        </header>

        <main className="content">
          {view === "dashboard" ? (
            <Dashboard
              state={state}
              bank={bank}
              approvedCounts={approvedCounts}
              daysRemaining={daysRemaining}
              dueCount={dueCount}
              studyMs={studyMs}
              onPractice={() => setView("practice")}
              onRecommended={() => {
                const dueQuestions = Object.values(state.mistakes)
                  .filter((item) => item.dueDate <= tick)
                  .map((item) => questionMap[item.questionId])
                  .filter((question): question is Question => Boolean(question));
                if (dueQuestions.length) {
                  const focusModule = dueQuestions[0].targetModule;
                  const focus = dueQuestions.filter((question) => question.targetModule === focusModule).slice(0, 10);
                  beginQuestionList(focus, focusModule, "retry", null, false);
                } else beginSession({ module: "physics", count: 10, mode: "practice", filter: "unseen", durationMinutes: null, strictTimed: false });
              }}
            />
          ) : null}
          {view === "practice" ? (
            <PracticeView
              state={state}
              now={tick}
              approvedCounts={approvedCounts}
              module={builderModule}
              setModule={setBuilderModule}
              count={builderCount}
              setCount={setBuilderCount}
              filter={builderFilter}
              setFilter={setBuilderFilter}
              timing={builderTiming}
              setTiming={setBuilderTiming}
              onStart={() => beginSession({
                module: builderModule,
                count: builderCount,
                mode: "practice",
                filter: builderFilter,
                durationMinutes: builderTiming === "untimed" ? null : builderTiming === "module" ? 40 : (builderCount * 40) / 27,
                strictTimed: false,
              })}
              onExam={(module) => beginSession({ module, count: 27, mode: "exam", filter: "all", durationMinutes: 40, strictTimed: true })}
              onFullMock={beginFullMock}
            />
          ) : null}
          {view === "originals" ? (
            <OriginalMocksView
              payload={mockBank}
              attempts={state.attempts}
              onStart={beginOriginal}
              onFull={() => beginOriginal("maths1", ["physics", "maths2"])}
            />
          ) : null}
          {view === "analytics" ? <AnalyticsView attempts={state.attempts} questionMap={questionMap} /> : null}
          {view === "mistakes" ? (
            <MistakesView
              state={state}
              now={tick}
              questionMap={questionMap}
              onRetry={(question) => beginQuestionList([question], question.targetModule, "retry", null, false)}
              onNote={(questionId, note) => setState((current) => ({ ...current, notes: { ...current.notes, [questionId]: note } }))}
            />
          ) : null}
          {view === "papers" ? <PapersView state={state} bank={bank} onStart={beginHistoric} /> : null}
          {view === "settings" ? (
            <SettingsView
              state={state}
              setState={setState}
              onExportJson={() => download("esat-atlas-export.json", JSON.stringify(state, null, 2), "application/json")}
              onExportCsv={() => {
                const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
                const rows = ["attemptId,module,mode,sourceSet,sourceExams,sourceYears,startedAt,rawScore,questionCount,freshQuestionCount,durationMs"];
                for (const attempt of state.attempts) rows.push([
                  attempt.attemptId,
                  attempt.module,
                  attempt.mode,
                  attempt.sourceSetLabel,
                  (attempt.sourceExams ?? []).join(" | "),
                  (attempt.sourceYears ?? []).join(" | "),
                  new Date(attempt.startedAt).toISOString(),
                  attempt.rawScore ?? "",
                  attempt.questionIds.length,
                  attempt.freshQuestionCount,
                  attempt.durationMs ?? "",
                ].map(csvCell).join(","));
                download("esat-atlas-attempts.csv", rows.join("\n"), "text/csv");
              }}
            />
          ) : null}
        </main>
      </div>
      {toast ? <div className="toast"><TriangleAlert size={17} />{toast}</div> : null}
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
  onPractice,
  onRecommended,
}: {
  state: StoredState;
  bank: BankPayload;
  approvedCounts: Record<ModuleId, number>;
  daysRemaining: number | null;
  dueCount: number;
  studyMs: number;
  onPractice: () => void;
  onRecommended: () => void;
}) {
  const stats = Object.fromEntries((Object.keys(MODULE_LABELS) as ModuleId[]).map((module) => [module, moduleStats(state.attempts, module)])) as Record<ModuleId, ReturnType<typeof moduleStats>>;
  const archiveIds = new Set(bank.questions.map((question) => question.id));
  const attempted = Object.keys(state.progress).filter((questionId) => archiveIds.has(questionId)).length;
  const totalApproved = Object.values(approvedCounts).reduce((sum, value) => sum + value, 0);
  const coverage = totalApproved ? attempted / totalApproved : 0;
  const lastStrict = state.attempts.find((attempt) => attempt.strictTimed);
  return (
    <>
      <section className="page-heading">
        <div><Pill tone="blue"><Sparkles size={13} /> Evidence-led preparation</Pill><h1>Your readiness, without invented scores.</h1><p>Fresh performance predicts. Retakes teach. ESAT Atlas keeps them separate.</p></div>
        <button className="button button-primary" onClick={onRecommended}><Play size={17} /> Recommended session</button>
      </section>

      <section className="readiness-grid">
        {(Object.keys(MODULE_LABELS) as ModuleId[]).map((module) => {
          const item = stats[module];
          const approvedIds = bank.questions
            .filter((question) => question.targetModule === module && !question.excluded && !question.reviewRequired)
            .map((question) => question.id);
          const unseen = approvedIds.filter((id) => !state.progress[id] || state.progress[id].neverSeen).length;
          return (
            <article className="module-card" key={module}>
              <div className={`module-accent ${module}`} />
              <div className="module-card-top"><span>{MODULE_LABELS[module]}</span><Pill tone={item.trend === "improving" ? "good" : "neutral"}>{item.trend}</Pill></div>
              {item.recentRawAverage === null ? <strong className="module-score empty-score">—</strong> : <strong className="module-score">{item.recentRawAverage.toFixed(1)}<small>/27 raw</small></strong>}
              <p>{item.freshAttemptCount ? `Recent fresh floor ${item.recentFloor?.toFixed(0)}/27` : "No fresh timed module yet"}</p>
              <div className="module-meta"><span><Target size={14} /> Personal target {state.targets[module].toFixed(1)}</span><span>{approvedCounts[module]} approved · {Math.max(0, unseen)} unseen</span></div>
            </article>
          );
        })}
      </section>

      <section className="metric-strip">
        <div><CalendarDays size={18} /><span>Exam countdown<strong>{daysRemaining === null ? "Not set" : `${daysRemaining} days`}</strong></span></div>
        <div><RotateCcw size={18} /><span>Due for retrieval<strong>{dueCount} questions</strong></span></div>
        <div><Clock3 size={18} /><span>Study this week<strong>{(studyMs / 3_600_000).toFixed(1)} hours</strong></span></div>
        <div><Activity size={18} /><span>Specification coverage<strong>{attempted ? `${Math.min(100, Math.round(coverage * 100))}%` : "Not started"}</strong></span></div>
      </section>

      <section className="dashboard-columns">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><span className="eyebrow">Exam readiness trend</span><h2>Fresh, timed performance only</h2></div><Pill tone="neutral">Retakes excluded</Pill></div>
          {state.attempts.filter((attempt) => attempt.strictTimed).length ? (
            <div className="mini-trend">
              {state.attempts.filter((attempt) => attempt.strictTimed).slice(0, 12).reverse().map((attempt) => (
                <div key={attempt.attemptId} className={`trend-bar ${attempt.module}`} style={{ height: `${Math.max(8, ((attempt.rawScore ?? 0) / attempt.questionIds.length) * 100)}%` }} title={`${MODULE_LABELS[attempt.module]} ${attempt.rawScore}/${attempt.questionIds.length}`} />
              ))}
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No fresh trend yet" body="Complete a strict 27-question module to establish your first honest baseline." action={<button className="button button-secondary" onClick={onPractice}>Choose a module</button>} />
          )}
        </article>
        <article className="panel action-panel">
          <span className="eyebrow">Next best action</span>
          <div className="action-icon"><Brain size={22} /></div>
          <h2>{dueCount ? `Clear ${dueCount} retrieval question${dueCount === 1 ? "" : "s"}` : "Build a fresh Physics baseline"}</h2>
          <p>{dueCount ? "These questions are due under the 1–3–7–14–30 day retrieval schedule." : "No mistake items are due, so an unseen session expands coverage without inflating readiness."}</p>
          <button className="text-button" onClick={onRecommended}>Start recommended session <ChevronRight size={16} /></button>
        </article>
      </section>

      <section className="source-ribbon">
        <div><ShieldCheck size={20} /><span><strong>{bank.questions.length} verified in-scope questions</strong>{approvedCounts.maths1} Mathematics 1 · {approvedCounts.physics} Physics · {approvedCounts.maths2} Mathematics 2</span></div>
        <div><strong>No ESAT raw-to-score formula</strong><span>Current score equating depends on item difficulty. Raw marks stay visible.</span></div>
      </section>
      <section className="benchmark-note">
        <div><span className="eyebrow">Official UAT-UK context</span><strong>Typical score ≈4.5 · about 10% score above 7.0</strong></div>
        <p>Context only—not a practice conversion. Live ESAT modules are separately equated using an item-response model.</p>
      </section>
      {lastStrict ? <p className="subtle-line">Last strict module: {MODULE_LABELS[lastStrict.module]} · {lastStrict.rawScore}/{lastStrict.questionIds.length} · {formatDate(lastStrict.endedAt)}</p> : null}
    </>
  );
}

function PracticeView({ state, now, approvedCounts, module, setModule, count, setCount, filter, setFilter, timing, setTiming, onStart, onExam, onFullMock }: {
  state: StoredState;
  now: number;
  approvedCounts: Record<ModuleId, number>;
  module: ModuleId;
  setModule: (module: ModuleId) => void;
  count: number;
  setCount: (count: number) => void;
  filter: QuestionFilter;
  setFilter: (filter: QuestionFilter) => void;
  timing: "untimed" | "pace" | "module";
  setTiming: (timing: "untimed" | "pace" | "module") => void;
  onStart: () => void;
  onExam: (module: ModuleId) => void;
  onFullMock: () => void;
}) {
  return (
    <>
      <section className="page-heading"><div><span className="eyebrow">Practice and simulation</span><h1>Train with a clear purpose.</h1><p>Strict exam attempts measure readiness. Practice sessions build mastery.</p></div></section>
      <section className="exam-launch-grid">
        <article className="exam-launch primary-launch">
          <div className="launch-copy"><Pill tone="blue"><Timer size={13} /> Strict simulation</Pill><h2>Full Cambridge Engineering mock</h2><p>Mathematics 1 → Physics → Mathematics 2. Three separately timed 40-minute modules; unused time never transfers.</p></div>
          <div className="launch-meta"><span>81 questions</span><span>120 minutes</span><span>No pause</span></div>
          <button className="button button-light" onClick={onFullMock}><Play size={17} /> Begin full mock</button>
          {approvedCounts.maths2 < 27 ? <div className="launch-warning"><TriangleAlert size={15} /> Locked until {27 - approvedCounts.maths2} Mathematics 2 candidates are reviewed.</div> : null}
        </article>
        <article className="panel single-module-launch">
          <span className="eyebrow">Single strict module</span><h2>27 questions · 40 minutes</h2>
          <div className="module-launch-buttons">
            {(Object.keys(MODULE_LABELS) as ModuleId[]).map((item) => (
              <button key={item} disabled={approvedCounts[item] < 27} onClick={() => onExam(item)}><span className={`module-dot ${item}`} />{MODULE_LABELS[item]}<ChevronRight size={16} /></button>
            ))}
          </div>
        </article>
      </section>

      <section className="panel builder-panel">
        <div className="panel-heading"><div><span className="eyebrow">Custom practice builder</span><h2>Shape a focused session</h2></div><Pill tone="good"><Check size={13} /> Pause and confidence enabled</Pill></div>
        <div className="builder-grid">
          <fieldset><legend>Module</legend><div className="segmented">{(Object.keys(MODULE_LABELS) as ModuleId[]).map((item) => <button className={module === item ? "selected" : ""} key={item} onClick={() => setModule(item)}>{MODULE_LABELS[item]}</button>)}</div></fieldset>
          <fieldset><legend>Question count</legend><div className="segmented compact-segments">{[5, 10, 15, 20, 27].map((item) => <button className={count === item ? "selected" : ""} key={item} onClick={() => setCount(item)}>{item}</button>)}</div></fieldset>
          <fieldset><legend>Question state</legend><select value={filter} onChange={(event) => setFilter(event.target.value as QuestionFilter)}><option value="unseen">Fresh / unseen</option><option value="incorrect">Incorrect, not mastered</option><option value="due">Due for retrieval</option><option value="all">All approved</option></select></fieldset>
          <fieldset><legend>Timing</legend><select value={timing} onChange={(event) => setTiming(event.target.value as typeof timing)}><option value="untimed">Untimed</option><option value="pace">ESAT pace (~89 sec/question)</option><option value="module">40-minute cap</option></select></fieldset>
        </div>
        <div className="builder-summary"><div><Filter size={18} /><span><strong>{MODULE_LABELS[module]}</strong>{count} questions · {filter} · {timing}</span></div><button className="button button-primary" onClick={onStart}><Play size={17} /> Build session</button></div>
      </section>
      <section className="mode-comparison">
        <div><ShieldCheck size={18} /><span><strong>Exam readiness</strong>First exposure, strict timing, no feedback during the test.</span></div>
        <div><Brain size={18} /><span><strong>Mastery</strong>Retries, confidence, notes and spaced retrieval. Never blended into readiness.</span></div>
        <div><Clock3 size={18} /><span><strong>Your current queue</strong>{Object.values(state.mistakes).filter((item) => item.dueDate <= now).length} due today.</span></div>
      </section>
    </>
  );
}

function OriginalMocksView({ payload, attempts, onStart, onFull }: { payload: MockPayload; attempts: Attempt[]; onStart: (module: ModuleId) => void; onFull: () => void }) {
  const completed = attempts.filter((attempt) => attempt.mode === "original");
  return (
    <>
      <section className="page-heading">
        <div><Pill tone="blue"><Sparkles size={13} /> Original challenge material</Pill><h1>A harder buffer, in the real module rhythm.</h1><p>Three original 27-question modules follow the 2026 specification and 40-minute structure. They are deliberately stretch-weighted and are never presented as official UAT-UK questions.</p></div>
        <button className="button button-primary" onClick={onFull}><Play size={17} /> Start full 120-minute mock</button>
      </section>
      <div className="integrity-banner original-integrity"><ShieldCheck size={18} /><div><strong>Formula-generated, independently asserted answers</strong><span>{payload.summary.questionCount} original questions passed deterministic option and answer checks. Raw results remain practice evidence—there is no invented 1.0–9.0 conversion.</span></div></div>
      <section className="original-grid">
        {(Object.keys(MODULE_LABELS) as ModuleId[]).map((module) => {
          const latest = completed.find((attempt) => attempt.module === module);
          return <article className={`original-card ${module}`} key={module}><div className="original-card-head"><span className={`module-dot ${module}`} /><Pill tone="neutral">Challenge Mock A</Pill></div><h2>{MODULE_LABELS[module]}</h2><p>27 original multiple-choice questions · 40 minutes · no calculator · no negative marking.</p><div className="original-score"><span>Latest completion</span><strong>{latest ? `${latest.rawScore}/27` : "Not attempted"}</strong></div><button className="button button-secondary" onClick={() => onStart(module)}>Start strict module <ChevronRight size={16} /></button></article>;
        })}
      </section>
      <section className="panel challenge-method"><div><span className="eyebrow">How to use it</span><h2>Treat the difficulty as a training buffer, not a forecast.</h2></div><div className="method-steps"><span><strong>1</strong> Sit it fresh and strict</span><span><strong>2</strong> Diagnose every lost mark</span><span><strong>3</strong> Confirm on archive questions</span></div></section>
    </>
  );
}

function AnalyticsView({ attempts, questionMap }: { attempts: Attempt[]; questionMap: Record<string, Question> }) {
  const completed = attempts.filter((attempt) => attempt.rawScore !== null);
  const allResponses = completed.flatMap((attempt) => Object.values(attempt.responses));
  const fresh = allResponses.filter((response) => response.firstExposure);
  const retakes = allResponses.filter((response) => !response.firstExposure);
  const rows: Record<string, { attempts: number; correct: number; time: number }> = {};
  for (const attempt of completed) for (const response of Object.values(attempt.responses)) {
    const topic = questionMap[response.questionId]?.esatTopic ?? "Unclassified";
    rows[topic] ??= { attempts: 0, correct: 0, time: 0 };
    rows[topic].attempts += 1;
    rows[topic].correct += response.correct ? 1 : 0;
    rows[topic].time += response.timeSpentMs;
  }
  const topicRows = Object.entries(rows).sort((a, b) => a[1].correct / a[1].attempts - b[1].correct / b[1].attempts);
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
      <section className="page-heading"><div><span className="eyebrow">Performance analytics</span><h1>Evidence before interpretation.</h1><p>Every chart below is built only from your recorded attempts.</p></div></section>
      {!completed.length ? <EmptyState icon={BarChart3} title="Not enough data yet" body="Analytics will appear after your first completed session. No placeholder or fabricated chart is shown." /> : (
        <>
          <section className="analytics-summary">
            <article><span>Fresh accuracy</span><strong>{percent(fresh.length ? fresh.filter((item) => item.correct).length / fresh.length : null)}</strong><small>{fresh.length} first exposures</small></article>
            <article><span>Retake accuracy</span><strong>{percent(retakes.length ? retakes.filter((item) => item.correct).length / retakes.length : null)}</strong><small>{retakes.length} repeated attempts</small></article>
            <article><span>Study volume</span><strong>{allResponses.length}</strong><small>question responses</small></article>
            <article><span>Strict modules</span><strong>{completed.filter((attempt) => attempt.strictTimed).length}</strong><small>readiness evidence</small></article>
          </section>
          <section className="analytics-grid">
            <article className="panel wide-panel"><div className="panel-heading"><div><span className="eyebrow">Fresh score trend</span><h2>Strict modules</h2></div></div>
              {completed.filter((attempt) => attempt.strictTimed).length ? <div className="large-trend">{completed.filter((attempt) => attempt.strictTimed).slice(0, 16).reverse().map((attempt) => <div key={attempt.attemptId} className="trend-column"><div className={`trend-bar ${attempt.module}`} style={{ height: `${((attempt.rawScore ?? 0) / attempt.questionIds.length) * 100}%` }} /><span>{attempt.rawScore}</span><small>{MODULE_LABELS[attempt.module].replace("Mathematics ", "M")}</small></div>)}</div> : <EmptyState icon={Activity} title="No strict modules" body="Practice results are deliberately excluded from this readiness chart." />}
            </article>
            <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Fresh vs repeated</span><h2>Learning separation</h2></div></div><div className="comparison-bars"><div><span>Fresh</span><i><b style={{ width: `${fresh.length ? fresh.filter((item) => item.correct).length / fresh.length * 100 : 0}%` }} /></i><strong>{percent(fresh.length ? fresh.filter((item) => item.correct).length / fresh.length : null)}</strong></div><div><span>Retake</span><i><b style={{ width: `${retakes.length ? retakes.filter((item) => item.correct).length / retakes.length * 100 : 0}%` }} /></i><strong>{percent(retakes.length ? retakes.filter((item) => item.correct).length / retakes.length : null)}</strong></div></div></article>
            <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Time distribution</span><h2>Accuracy by pace</h2></div></div><div className="bucket-list">{timeBuckets.map((bucket) => <div key={bucket.label}><span>{bucket.label}</span><i><b style={{ width: `${allResponses.length ? bucket.responses.length / allResponses.length * 100 : 0}%` }} /></i><strong>{bucket.responses.length ? `${Math.round(bucket.responses.filter((item) => item.correct).length / bucket.responses.length * 100)}%` : "—"}</strong></div>)}</div></article>
            <article className="panel wide-panel"><div className="panel-heading"><div><span className="eyebrow">Specification heatmap</span><h2>Topic evidence</h2></div></div><div className="topic-table"><div className="topic-row header-row"><span>Topic</span><span>Questions</span><span>Fresh accuracy</span><span>Average pace</span><span>Evidence</span></div>{topicRows.map(([topic, data]) => { const accuracy = data.correct / data.attempts; return <div className="topic-row" key={topic}><strong>{topic}</strong><span>{data.attempts}</span><span>{Math.round(accuracy * 100)}%</span><span>{Math.round(data.time / data.attempts / 1000)}s</span><Pill tone={data.attempts < 5 ? "neutral" : accuracy >= .75 ? "good" : accuracy >= .55 ? "warn" : "bad"}>{data.attempts < 5 ? "Insufficient" : accuracy >= .75 ? "Strong" : accuracy >= .55 ? "Developing" : "Priority"}</Pill></div>; })}</div></article>
          </section>
        </>
      )}
    </>
  );
}

function MistakesView({ state, now, questionMap, onRetry, onNote }: { state: StoredState; now: number; questionMap: Record<string, Question>; onRetry: (question: Question) => void; onNote: (id: string, note: string) => void }) {
  const items = Object.values(state.mistakes).sort((a, b) => a.dueDate - b.dueDate);
  return (
    <><section className="page-heading"><div><span className="eyebrow">Spaced retrieval</span><h1>Mistakes become scheduled work.</h1><p>A correct retry is progress, not instant mastery. Three delayed successes are required.</p></div></section>
      {!items.length ? <EmptyState icon={Brain} title="No mistakes in the queue" body="Incorrect answers will enter a transparent 1–3–7–14–30 day retrieval schedule." /> : <section className="mistake-list">{items.map((item) => { const question = questionMap[item.questionId]; if (!question) return null; const due = item.dueDate <= now; return <article className="mistake-card" key={item.questionId}>{question.questionImage ? <img src={publicAsset(question.questionImage)} alt={`${question.sourceExam} ${question.year} question ${question.originalQuestionNumber}`} /> : <div className="mistake-text-preview">{question.questionText}</div>}<div className="mistake-copy"><div><Pill tone={due ? "bad" : "neutral"}>{due ? "Due now" : `Due ${formatDate(item.dueDate)}`}</Pill><Pill tone="blue">{MODULE_LABELS[question.targetModule]}</Pill></div><h3>{question.esatTopic} · {sourceLabel(question)}</h3><p>{item.correctStreak}/3 delayed correct responses · current interval {item.intervalDays} day{item.intervalDays === 1 ? "" : "s"}</p><textarea value={state.notes[item.questionId] ?? ""} onChange={(event) => onNote(item.questionId, event.target.value)} placeholder="Personal note, e.g. remember the sign convention…" aria-label={`Note for ${item.questionId}`} /><button className="button button-secondary compact" onClick={() => onRetry(question)}><RotateCcw size={15} /> Retry question</button></div></article>; })}</section>}
    </>
  );
}

function PapersView({ state, bank, onStart }: { state: StoredState; bank: BankPayload; onStart: (sourceExam: string, year: number, module: ModuleId) => void }) {
  const sets = Array.from(bank.questions.reduce((map, question) => {
    const sources = [
      { sourceExam: question.sourceExam, sourcePart: question.sourcePart },
      ...(question.alternateSources ?? []).map((source) => ({ sourceExam: source.sourceExam, sourcePart: source.sourcePart })),
    ];
    for (const source of sources) {
      const key = `${source.sourceExam}|${question.year}|${question.targetModule}`;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { sourceExam: source.sourceExam, year: question.year, module: question.targetModule, count: 1, sourcePart: source.sourcePart });
    }
    return map;
  }, new Map<string, { sourceExam: string; year: number; module: ModuleId; count: number; sourcePart: string }>()).values()).sort((a, b) => a.sourceExam.localeCompare(b.sourceExam) || b.year - a.year || a.module.localeCompare(b.module));
  const completedPapers = state.attempts.filter((attempt) => attempt.mode === "historic" && attempt.rawScore !== null);
  return (
    <><section className="page-heading"><div><span className="eyebrow">Source-set library</span><h1>Every completion keeps its paper, year and module.</h1><p>NSAA, uncrossed ENGAA Part B, and TMUA Paper 1 stay visibly separate. You have completed {completedPapers.length} timed archive set{completedPapers.length === 1 ? "" : "s"}.</p></div><Pill tone="good"><Timer size={13} /> 40 min / 27-question ESAT pace</Pill></section>
      <div className="integrity-banner"><TriangleAlert size={18} /><div><strong>Raw marks are exact; live ESAT scaled scores cannot be reconstructed here.</strong><span>UAT-UK equates different forms with a Rasch model. The archive contains no complete validated conversion tables, so this platform will not fabricate a 1.0–9.0 score.</span></div></div>
      <section className="panel paper-library"><div className="paper-library-row header-row"><span>Source</span><span>Year / set</span><span>Module</span><span>Questions / cap</span><span>Attempts</span><span>Your latest</span><span /></div>{sets.map((set) => { const completions = state.attempts.filter((attempt) => attempt.mode === "historic" && attempt.module === set.module && attempt.sourceYears.includes(set.year) && (attempt.sourceExams ?? []).includes(set.sourceExam)); const latest = completions[0]; const setLabel = set.sourceExam === "ENGAA" ? "Part B · crossed items removed · repeats shown once" : set.sourceExam === "TMUA" ? "Paper 1" : set.sourcePart === "E" ? "Section 1 · Part E" : "Section 1"; return <div className="paper-library-row" key={`${set.sourceExam}-${set.year}-${set.module}`}><strong>{set.sourceExam}</strong><span>{set.year}<small>{setLabel}</small></span><span>{MODULE_LABELS[set.module]}</span><span>{set.count}<small>{formatDuration(esatPacedDurationMs(set.count))} strict</small></span><strong>{completions.length}</strong><strong>{latest ? `${latest.rawScore}/${latest.questionIds.length}` : "—"}</strong><button onClick={() => onStart(set.sourceExam, set.year, set.module)}>Open timed set <ChevronRight size={15} /></button></div>; })}</section>
      <section className="panel benchmark-panel"><div className="panel-heading"><div><span className="eyebrow">Cambridge Engineering · 2025 cycle</span><h2>Published cohort averages—not cutoffs</h2></div><Pill tone="warn">Do not infer offer probability</Pill></div><div className="benchmark-table"><div className="benchmark-row header-row"><span>Cohort</span><span>Maths 1</span><span>Physics</span><span>Maths 2</span></div>{CAMBRIDGE_BENCHMARKS.map((row) => <div className="benchmark-row" key={row.cohort}><strong>{row.cohort}</strong><span>{row.maths1.toFixed(2)}</span><span>{row.physics.toFixed(2)}</span><span>{row.maths2.toFixed(2)}</span></div>)}</div><p className="source-footnote">Cambridge FOI 2025-1097, Engineering H100, 2025 admissions cycle. These are cohort means, not thresholds; Cambridge colleges consider ESAT alongside the rest of an application. UAT-UK reports a typical candidate around 4.5 and approximately 10% above 7.0.</p><div className="source-links"><a href="https://www.whatdotheyknow.com/request/esat_statistics_2025_cycle" target="_blank" rel="noreferrer">Cambridge data request</a><a href="https://esat-tmua.ac.uk/test-results/" target="_blank" rel="noreferrer">Official scoring method</a></div></section>
    </>
  );
}

function SettingsView({ state, setState, onExportJson, onExportCsv }: { state: StoredState; setState: React.Dispatch<React.SetStateAction<StoredState>>; onExportJson: () => void; onExportCsv: () => void }) {
  return (
    <><section className="page-heading"><div><span className="eyebrow">Personal settings</span><h1>Targets and study constraints.</h1><p>Personal targets are planning aids, never official Cambridge thresholds.</p></div></section>
      <section className="settings-grid">
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Module targets</span><h2>Your own goals</h2></div></div>{(Object.keys(MODULE_LABELS) as ModuleId[]).map((module) => <label className="setting-row" key={module}><span>{MODULE_LABELS[module]}<small>1.0–9.0 personal target</small></span><input type="number" min="1" max="9" step="0.1" value={state.targets[module]} onChange={(event) => setState((current) => ({ ...current, targets: { ...current.targets, [module]: Number(event.target.value) } }))} /></label>)}</article>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Study planner</span><h2>Time available</h2></div></div><label className="setting-row"><span>ESAT date<small>Used for the calm countdown</small></span><input type="date" value={state.settings.examDate} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, examDate: event.target.value } }))} /></label><label className="setting-row"><span>Weekly hours<small>Adaptive plan capacity</small></span><input type="number" min="1" max="40" value={state.settings.weeklyHours} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, weeklyHours: Number(event.target.value) } }))} /></label></article>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Player controls</span><h2>Interaction</h2></div></div><label className="toggle-row"><span>Keyboard shortcuts<small>A–H, 1–8, arrows, F and R</small></span><input type="checkbox" checked={state.settings.keyboardShortcuts} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, keyboardShortcuts: event.target.checked } }))} /></label><label className="toggle-row"><span>Strict-mode pacing aid<small>Optional; hidden by default</small></span><input type="checkbox" checked={state.settings.pacingAid} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, pacingAid: event.target.checked } }))} /></label></article>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Data portability</span><h2>Own your revision record</h2></div></div><p className="panel-copy">Export attempts, responses, progress, mistakes, timing, targets and notes at any time.</p><div className="export-actions"><button className="button button-secondary" onClick={onExportJson}><Download size={16} /> Export JSON</button><button className="button button-secondary" onClick={onExportCsv}><Download size={16} /> Attempts CSV</button></div></article>
      </section>
    </>
  );
}

function ExamPlayer({ attempt, questionMap, now, reviewOpen, setReviewOpen, onSelect, onNavigate, onFlag, onConfidence, onFinish, onExit, onPause, pacingAid, multiTabWarning, dismissMultiTab }: { attempt: Attempt; questionMap: Record<string, Question>; now: number; reviewOpen: boolean; setReviewOpen: (value: boolean) => void; onSelect: (letter: string) => void; onNavigate: (index: number) => void; onFlag: () => void; onConfidence: (confidence: "Guess" | "Low" | "Medium" | "High") => void; onFinish: () => void; onExit: () => void; onPause: () => void; pacingAid: boolean; multiTabWarning: boolean; dismissMultiTab: () => void }) {
  const questionId = attempt.questionIds[attempt.currentIndex];
  const question = questionMap[questionId];
  const response = attempt.responses[questionId];
  const timeLeft = remainingMs(attempt, now);
  const answered = Object.values(attempt.responses).filter((item) => item.selectedAnswer).length;
  const expectedElapsed = (attempt.currentIndex / attempt.questionIds.length) * (attempt.strictTimed ? 40 * 60_000 : (attempt.endsAt ? attempt.endsAt - attempt.startedAt : 0));
  const actualElapsed = now - attempt.startedAt - attempt.totalPausedDuration;
  const paceDifference = expectedElapsed - actualElapsed;
  const displayedSource = sourceLabelForAttempt(question, attempt);
  return (
    <div className="exam-shell">
      <header className="exam-header"><div className="exam-brand"><div className="brand-mark">EA</div><span><strong>{MODULE_LABELS[attempt.module]}</strong>{attempt.mode === "historic" ? attempt.sourceSetLabel : attempt.strictTimed ? "Strict exam simulation" : "Practice session"}</span></div><div className="exam-progress"><span>Question {attempt.currentIndex + 1} of {attempt.questionIds.length}</span><div><i style={{ width: `${(attempt.currentIndex + 1) / attempt.questionIds.length * 100}%` }} /></div></div><div className="exam-header-actions"><button className="exam-exit" onClick={onExit}><Home size={16} /><span>Exit to home</span></button><div className={`exam-timer ${timeLeft !== null && timeLeft < 300_000 ? "timer-low" : ""}`}><Clock3 size={19} /><span><small>Time remaining</small><strong>{timeLeft === null ? "Untimed" : formatDuration(timeLeft)}</strong></span></div></div></header>
      {multiTabWarning ? <div className="multi-tab"><TriangleAlert size={18} /><span><strong>This attempt is open in another tab.</strong>Continue in one tab only to prevent competing saves.</span><button aria-label="Dismiss multi-tab warning" onClick={dismissMultiTab}><X size={16} /></button></div> : null}
      {attempt.pausedAt ? <div className="pause-overlay"><Pause size={28} /><h2>Practice paused</h2><p>Your timer and question visit are paused.</p><button className="button button-primary" onClick={onPause}><Play size={17} /> Resume session</button></div> : null}
      {reviewOpen ? (
        <main className="review-screen"><div className="review-heading"><div><span className="eyebrow">Module review</span><h1>Check before submitting</h1><p>{answered} answered · {attempt.questionIds.length - answered} unanswered · {Object.values(attempt.responses).filter((item) => item.flagged).length} flagged</p></div><button className="button button-secondary" onClick={() => setReviewOpen(false)}>Return to question</button></div><div className="review-grid">{attempt.questionIds.map((id, index) => { const item = attempt.responses[id]; return <button key={id} className={`${item.selectedAnswer ? "answered" : "unanswered"} ${item.flagged ? "flagged" : ""}`} onClick={() => onNavigate(index)}><strong>{index + 1}</strong><span>{item.selectedAnswer ? `Answer ${item.selectedAnswer}` : "Unanswered"}</span>{item.flagged ? <Flag size={14} /> : null}</button>; })}</div><div className="review-submit"><div><TriangleAlert size={18} /><span>Unanswered questions receive no mark. There is no negative marking.</span></div><button className="button button-primary" onClick={onFinish}>Submit module</button></div></main>
      ) : (
        <main className="exam-content"><section className="question-stage"><div className="question-toolbar"><div><Pill tone="neutral">{displayedSource}</Pill>{!attempt.strictTimed ? <Pill tone="blue">{question.esatTopic}</Pill> : null}</div><div>{pacingAid && attempt.strictTimed ? <span className={paceDifference >= 0 ? "pace-ahead" : "pace-behind"}>{formatDuration(Math.abs(paceDifference))} {paceDifference >= 0 ? "ahead" : "behind"}</span> : null}<button className={response.flagged ? "flag-button flagged" : "flag-button"} onClick={onFlag}><Flag size={16} /> {response.flagged ? "Flagged" : "Flag for review"}</button></div></div><div className={`question-image-frame ${question.authored ? "authored-frame" : ""}`}>{question.questionImage ? <img src={publicAsset(question.questionImage)} alt={`${question.sourceExam} ${question.year} question ${question.originalQuestionNumber}`} /> : <div className="authored-question"><span>Question {attempt.currentIndex + 1}</span><p>{question.questionText}</p><small>Original ESAT Atlas challenge item</small></div>}</div></section><aside className="answer-panel"><span className="eyebrow">Select one answer</span><div className="answer-options">{question.answerOptions.map((letter, index) => <button key={letter} className={response.selectedAnswer === letter ? "selected" : ""} onClick={() => onSelect(letter)}><kbd>{letter}</kbd><span>{question.optionText?.[letter] ?? `Option ${letter}`}</span><small>{index + 1}</small></button>)}</div>{!attempt.strictTimed ? <div className="confidence-picker"><span>Confidence (optional)</span><div>{(["Guess", "Low", "Medium", "High"] as const).map((confidence) => <button className={response.confidence === confidence ? "selected" : ""} key={confidence} onClick={() => onConfidence(confidence)}>{confidence}</button>)}</div></div> : null}</aside></main>
      )}
      {!reviewOpen ? <footer className="exam-footer"><div>{!attempt.strictTimed ? <button className="button button-secondary compact" onClick={onPause}><Pause size={15} /> Pause</button> : <span className="strict-note"><ShieldCheck size={15} /> Strict timing continues if this tab loses focus.</span>}</div><div className="exam-nav"><button className="button button-secondary" onClick={() => onNavigate(attempt.currentIndex - 1)} disabled={attempt.currentIndex === 0}><ChevronLeft size={17} /> Previous</button><button className="button button-secondary" onClick={() => setReviewOpen(true)}>Review ({answered}/{attempt.questionIds.length})</button>{attempt.currentIndex === attempt.questionIds.length - 1 ? <button className="button button-primary" onClick={() => setReviewOpen(true)}>Final review</button> : <button className="button button-primary" onClick={() => onNavigate(attempt.currentIndex + 1)}>Next <ChevronRight size={17} /></button>}</div></footer> : null}
    </div>
  );
}

function ResultScreen({ attempt, questionMap, onClose, onContinue, onTag }: { attempt: Attempt; questionMap: Record<string, Question>; onClose: () => void; onContinue: () => void; onTag: (questionId: string, tag: string) => void }) {
  const responses = Object.values(attempt.responses);
  const correct = responses.filter((response) => response.correct).length;
  const unanswered = responses.filter((response) => response.unanswered).length;
  const times = responses.map((response) => response.timeSpentMs).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;
  const incorrect = responses.filter((response) => response.correct === false && !response.unanswered);
  const unansweredResponses = responses.filter((response) => response.unanswered);
  const missed = [...incorrect, ...unansweredResponses];
  const fastWrong = incorrect.filter((response) => response.timeSpentMs < 60_000).length;
  const slowWrong = incorrect.filter((response) => response.timeSpentMs > 120_000).length;
  const signal = practiceSignal(correct, attempt.questionIds.length);
  return (
    <main className="result-screen"><header className="result-header"><div className="sidebar-brand"><div className="brand-mark">EA</div><div><strong>ESAT Atlas</strong><span>Session result</span></div></div><button className="button button-secondary" onClick={onClose}>Back to dashboard</button></header><section className="result-hero"><div><Pill tone={attempt.completionStatus === "timed-out" ? "warn" : "good"}>{attempt.completionStatus === "timed-out" ? "Time expired · automatically submitted" : "Module submitted"}</Pill><h1>{MODULE_LABELS[attempt.module]}</h1><p>{attempt.sourceSetLabel ?? "Practice set"} · {attempt.strictTimed ? "strict evidence" : "practice evidence"} · {attempt.freshQuestionCount} fresh</p></div><div className="raw-score"><strong>{attempt.rawScore}</strong><span>/ {attempt.questionIds.length} raw</span><small>{Math.round(correct / attempt.questionIds.length * 100)}% accuracy</small></div></section><section className="result-metrics"><div><span>Correct</span><strong>{correct}</strong></div><div><span>Incorrect</span><strong>{incorrect.length}</strong></div><div><span>Unanswered</span><strong>{unanswered}</strong></div><div><span>Time used</span><strong>{formatDuration(attempt.durationMs ?? 0)}</strong></div><div><span>Average / question</span><strong>{formatDuration((attempt.durationMs ?? 0) / attempt.questionIds.length)}</strong></div><div><span>Median / question</span><strong>{formatDuration(median)}</strong></div></section><div className="integrity-banner result-signal"><ShieldCheck size={18} /><div><strong>{signal.label}</strong><span>{signal.detail} Your raw mark above is exact; no unofficial ESAT scaled score is shown because live forms are Rasch-equated for item difficulty.</span></div></div><section className="result-insights"><article className="panel"><span className="eyebrow">What went well</span><h2>{correct ? `${correct} question${correct === 1 ? "" : "s"} answered correctly` : "Baseline captured"}</h2><p>{responses.filter((response) => response.correct && response.timeSpentMs < 90_000).length} were fast + correct at or ahead of the ESAT pace reference.</p></article><article className="panel"><span className="eyebrow">What cost marks</span><h2>{fastWrong} fast wrong · {slowWrong} slow wrong</h2><p>{unanswered ? `${unanswered} unanswered. ` : ""}Fast errors may indicate misreads or execution; slow errors more often warrant conceptual review.</p></article><article className="panel"><span className="eyebrow">Next best action</span><h2>{missed.length ? `Review and schedule ${missed.length} missed question${missed.length === 1 ? "" : "s"}` : "Expand fresh coverage"}</h2><p>{missed.length ? "Incorrect and unanswered questions are now in the retrieval queue." : "A fresh unseen set adds more readiness evidence."}</p></article></section>{missed.length ? <section className="panel review-errors"><div className="panel-heading"><div><span className="eyebrow">Mistake diagnosis</span><h2>Confirm why each mark was lost</h2></div></div>{missed.map((response) => { const question = questionMap[response.questionId]; return <details key={response.questionId}><summary><span>{sourceLabelForAttempt(question, attempt)} · {question.esatTopic}</span><strong>{response.unanswered ? "Unanswered" : `Your answer ${response.finalAnswer}`} · Correct {question.correctAnswer}</strong><ChevronRight size={16} /></summary><div className="error-review-body">{question.questionImage ? <img src={publicAsset(question.questionImage)} alt={`Review question ${question.id}`} /> : <div className="authored-review"><p>{question.questionText}</p><strong>Worked check</strong><span>{question.explanation}</span></div>}<div><p>Select every cause that genuinely applied.</p><div className="tag-picker">{ERROR_TAGS.map((tag) => <button className={response.errorClassifications.includes(tag) ? "selected" : ""} key={tag} onClick={() => onTag(response.questionId, tag)}>{tag}</button>)}</div></div></div></details>; })}</section> : null}<footer className="result-actions">{attempt.sequenceRemaining?.length ? <button className="button button-primary" onClick={onContinue}>Continue to {MODULE_LABELS[attempt.sequenceRemaining[0]]} <ChevronRight size={17} /></button> : <button className="button button-primary" onClick={onClose}>Finish review</button>}</footer></main>
  );
}
