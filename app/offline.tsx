"use client";

/**
 * The interface over the offline stack: one hook that owns the service worker's state, and
 * the surfaces that report it — a connection indicator, an update banner and the settings
 * panel that downloads the question library.
 *
 * The imperative half lives in `app/lib/offline.ts`; this file is only React.
 */

import {
  CheckCircle2,
  CloudOff,
  Download,
  HardDriveDownload,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  Wifi,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_LIBRARY_STATE,
  applyWaitingUpdate,
  completionPercent,
  formatBytes,
  libraryStatusMessage,
  loadLibraryManifest,
  registerServiceWorker,
  requestFromWorker,
  requestPersistentStorage,
  serviceWorkerSupported,
  type LibraryState,
  type WorkerPhase,
} from "./lib/offline";

/**
 * Chrome's install event, which is not in the DOM library because it is not standardised.
 * Safari and Firefox never fire it; there the panel explains the manual route instead.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface OfflineRuntime {
  online: boolean;
  worker: WorkerPhase;
  updateReady: boolean;
  applyUpdate: () => void;
  /** True once the application is running from the home screen rather than a browser tab. */
  installed: boolean;
  installAvailable: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  library: LibraryState;
  downloadLibrary: () => Promise<void>;
  cancelDownload: () => void;
  clearLibrary: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  /** Whether the browser has exempted this origin from eviction; null while unknown. */
  persisted: boolean | null;
  /** Set when the last library operation failed, for reporting rather than for control flow. */
  error: string | null;
}

function standaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(iosStandalone) || Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches);
}

export function useOfflineRuntime(): OfflineRuntime {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [worker, setWorker] = useState<WorkerPhase>(() => (serviceWorkerSupported() ? "registering" : "unsupported"));
  const [updateReady, setUpdateReady] = useState(false);
  const [installed, setInstalled] = useState(standaloneDisplay);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [libraryState, setLibrary] = useState<LibraryState>(EMPTY_LIBRARY_STATE);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filesRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Read what is already stored. Never called before the worker is ready: asking an
  // inactive worker returns nothing, and the panel would then report an empty library that
  // is in fact fully downloaded. The unsupported case is derived below rather than written
  // here, so nothing in this function writes state before its first await.
  const refreshLibrary = useCallback(async () => {
    const manifest = await loadLibraryManifest();
    if (!mountedRef.current) return;
    if (!manifest) {
      // The development server has no generated inventory; the panel says so rather than
      // showing a download that could never complete.
      setLibrary({ ...EMPTY_LIBRARY_STATE, phase: "idle", total: 0 });
      return;
    }
    filesRef.current = manifest.files;
    try {
      await requestFromWorker({ type: "library-status", urls: manifest.files }, (reply) => {
        if (!mountedRef.current) return;
        setLibrary({
          phase: "idle",
          cached: reply.cached,
          total: reply.total,
          failed: 0,
          storageBytes: reply.storageBytes ?? 0,
          libraryBytes: manifest.totalBytes,
        });
      });
    } catch {
      if (mountedRef.current) {
        setLibrary({ ...EMPTY_LIBRARY_STATE, phase: "idle", total: manifest.fileCount, libraryBytes: manifest.totalBytes });
      }
    }
  }, []);

  useEffect(() => registerServiceWorker({
    onPhase: (phase) => {
      setWorker(phase);
      if (phase === "ready") refreshLibrary().catch(() => undefined);
    },
    onUpdateReady: () => setUpdateReady(true),
  }), [refreshLibrary]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Suppressing the browser's own mini-infobar is the price of offering the install
      // from inside Settings, where it can be explained rather than fired at a stranger.
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.persisted) return;
    navigator.storage.persisted().then((value) => {
      if (mountedRef.current) setPersisted(value);
    }).catch(() => undefined);
  }, []);

  // Derived rather than stored: with no usable worker there is no library to have a state.
  const library = useMemo<LibraryState>(
    () => (worker === "unsupported" || worker === "failed"
      ? { ...EMPTY_LIBRARY_STATE, phase: "unavailable" }
      : libraryState),
    [libraryState, worker],
  );

  const downloadLibrary = useCallback(async () => {
    const files = filesRef.current;
    if (!files.length) return;
    setError(null);
    // Storage worth 34 MB is exactly what a browser evicts first, so ask to keep it.
    const granted = await requestPersistentStorage();
    if (mountedRef.current) setPersisted(granted);
    setLibrary((current) => ({ ...current, phase: "downloading", failed: 0 }));
    try {
      await requestFromWorker({ type: "cache-library", urls: files }, (reply) => {
        if (!mountedRef.current) return;
        setLibrary((current) => ({
          ...current,
          phase: reply.type === "library-complete" ? "idle" : "downloading",
          cached: reply.cached,
          total: reply.total || current.total,
          failed: reply.failed ?? current.failed,
          storageBytes: reply.storageBytes ?? current.storageBytes,
        }));
      });
    } catch (cause) {
      if (!mountedRef.current) return;
      setLibrary((current) => ({ ...current, phase: "idle" }));
      setError(cause instanceof Error ? cause.message : "The offline download did not finish.");
    }
  }, []);

  const cancelDownload = useCallback(() => {
    if (!serviceWorkerSupported()) return;
    navigator.serviceWorker.controller?.postMessage({ type: "cancel-library" });
  }, []);

  const clearLibrary = useCallback(async () => {
    setError(null);
    try {
      await requestFromWorker({ type: "clear-library", urls: filesRef.current }, (reply) => {
        if (!mountedRef.current) return;
        setLibrary((current) => ({
          ...current,
          phase: "idle",
          cached: reply.cached,
          failed: 0,
          storageBytes: reply.storageBytes ?? current.storageBytes,
        }));
      });
    } catch (cause) {
      if (mountedRef.current) setError(cause instanceof Error ? cause.message : "Stored questions could not be removed.");
    }
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!installEvent) return "unavailable";
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    // The event is single-use; the browser fires a fresh one if it is still installable.
    setInstallEvent(null);
    return choice.outcome;
  }, [installEvent]);

  const applyUpdate = useCallback(() => {
    applyWaitingUpdate().catch(() => window.location.reload());
  }, []);

  return useMemo(() => ({
    online,
    worker,
    updateReady,
    applyUpdate,
    installed,
    installAvailable: installEvent !== null,
    promptInstall,
    library,
    downloadLibrary,
    cancelDownload,
    clearLibrary,
    refreshLibrary,
    persisted,
    error,
  }), [
    online, worker, updateReady, applyUpdate, installed, installEvent, promptInstall,
    library, downloadLibrary, cancelDownload, clearLibrary, refreshLibrary, persisted, error,
  ]);
}

/* ------------------------------------------------------------------------ surfaces -- */

export type SyncState = "offline" | "pending" | "synced";

/**
 * The one place a candidate is told whether their work has left the device.
 *
 * "Offline" is deliberately reassuring rather than alarming: everything still works and
 * nothing is lost, so it reports where the work is rather than what is missing. No count is
 * shown — a 40-minute offline paper queues hundreds of writes, and a large number next to
 * the word "offline" reads as damage when it is simply a full record waiting its turn.
 */
export function ConnectionStatus({ state }: { state: SyncState }) {
  if (state === "offline") {
    return (
      <span className="connection-status connection-offline" role="status" title="You are offline. Everything you do is stored on this device and syncs to your account when you reconnect.">
        <CloudOff size={14} /><span>Offline · saved here</span>
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span className="connection-status connection-pending" role="status" title="Sending your latest work to your account.">
        <RefreshCw size={14} className="spin" /><span>Syncing…</span>
      </span>
    );
  }
  return (
    <span className="connection-status connection-synced" title="Every change has reached your account.">
      <CheckCircle2 size={14} /><span>Saved</span>
    </span>
  );
}

/** Offered once a new deployment is waiting, and never while a paper is being sat. */
export function UpdateBanner({ onApply, onDismiss }: { onApply: () => void; onDismiss: () => void }) {
  return (
    <div className="update-banner" role="status">
      <RefreshCw size={17} />
      <span><strong>A new version of ESAT Atlas is ready.</strong>Your progress and any session in progress are kept.</span>
      <button className="button button-primary compact" onClick={onApply}>Reload now</button>
      <button className="icon-button ghost" onClick={onDismiss} aria-label="Dismiss update notice"><X size={15} /></button>
    </div>
  );
}

export function OfflinePanel({ runtime, onToast }: { runtime: OfflineRuntime; onToast: (message: string) => void }) {
  const { library } = runtime;
  const percent = completionPercent(library.cached, library.total);
  const complete = library.total > 0 && library.cached >= library.total;
  const downloading = library.phase === "downloading";

  return (
    <article className="panel offline-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Installation and offline use</span>
          <h2>Work with no connection</h2>
        </div>
        {runtime.online ? <Wifi size={18} /> : <CloudOff size={18} />}
      </div>
      <p className="panel-copy">
        ESAT Atlas installs as an application and runs entirely on this device. Sign in once
        while you have a connection; after that every paper, mock, mistake, note and
        whiteboard page works offline, and your work syncs to your account the moment you
        are back online.
      </p>

      <div className="offline-rows">
        <div className="offline-row">
          <Smartphone size={17} />
          <div>
            <strong>{runtime.installed ? "Installed on this device" : "Install to the home screen"}</strong>
            <small>
              {runtime.installed
                ? "Running as an installed application, so it opens without browser controls."
                : runtime.installAvailable
                  ? "Adds an icon and opens full-screen, without any browser controls."
                  : "On iPad and iPhone use Share → Add to Home Screen. On desktop Chrome or Edge use the install icon in the address bar."}
            </small>
          </div>
          {!runtime.installed && runtime.installAvailable ? (
            <button
              className="button button-secondary compact"
              onClick={() => {
                runtime.promptInstall().then((outcome) => {
                  if (outcome === "dismissed") onToast("Installation was cancelled. You can install at any time from this panel.");
                });
              }}
            >
              <Download size={15} /> Install
            </button>
          ) : null}
        </div>

        <div className="offline-row">
          <HardDriveDownload size={17} />
          <div>
            <strong>Question library on this device</strong>
            <small>{libraryStatusMessage(library)}</small>
            {library.total > 0 ? (
              <div className="offline-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Question images stored on this device">
                <i style={{ width: `${percent}%` }} />
              </div>
            ) : null}
            {library.failed > 0 ? (
              <small className="offline-warning">
                <TriangleAlert size={13} /> {library.failed} image{library.failed === 1 ? "" : "s"} could not be fetched. Downloading again retries only those.
              </small>
            ) : null}
          </div>
          <div className="offline-row-actions">
            {downloading ? (
              <button className="button button-secondary compact" onClick={runtime.cancelDownload}>Stop</button>
            ) : (
              <button
                className="button button-secondary compact"
                disabled={library.phase !== "idle" || library.total === 0 || complete || !runtime.online}
                onClick={() => { runtime.downloadLibrary().catch(() => undefined); }}
              >
                <Download size={15} /> {library.cached > 0 ? "Finish download" : "Download all"}
              </button>
            )}
            {library.cached > 0 && !downloading ? (
              <button
                className="button button-ghost compact"
                onClick={() => {
                  if (!window.confirm("Remove every stored question image from this device? Your results, notes and whiteboard pages are not affected, and images download again when you are online.")) return;
                  runtime.clearLibrary().then(() => onToast("Stored question images were removed from this device.")).catch(() => undefined);
                }}
              >
                <Trash2 size={15} /> Remove
              </button>
            ) : null}
          </div>
        </div>

        <div className="offline-row">
          <ShieldCheck size={17} />
          <div>
            <strong>Storage protection</strong>
            <small>
              {runtime.persisted === true
                ? "This browser has been asked not to evict ESAT Atlas when storage runs low."
                : runtime.persisted === false
                  ? "This browser may clear stored questions if the device runs low on space. Your account copy is unaffected."
                  : "Checking how this browser treats stored data…"}
              {library.storageBytes > 0 ? ` Currently using ${formatBytes(library.storageBytes)}.` : ""}
            </small>
          </div>
          {runtime.persisted === false ? (
            <button
              className="button button-secondary compact"
              onClick={() => {
                requestPersistentStorage().then((granted) => {
                  onToast(granted
                    ? "This browser will now keep ESAT Atlas data under storage pressure."
                    : "This browser declined to protect the stored data. Everything remains safe in your account.");
                });
              }}
            >
              Request
            </button>
          ) : null}
        </div>
      </div>

      {runtime.error ? <p className="panel-footnote offline-warning"><TriangleAlert size={13} /> {runtime.error}</p> : null}
      <p className="panel-footnote">
        {runtime.worker === "unsupported"
          ? "This browser or address cannot run an offline worker, so a connection is needed for each session. Everything else works normally."
          : "Sitting a paper stores its images automatically, so anything you have already opened is available offline without downloading the whole archive."}
      </p>
    </article>
  );
}
