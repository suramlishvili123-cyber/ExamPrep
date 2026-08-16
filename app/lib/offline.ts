/**
 * The window-side half of the offline stack.
 *
 * Everything the service worker can do is driven from here: registering it, noticing a new
 * deployment, running the bulk download of the question library, and reporting what is
 * actually stored. The worker itself is in `app/service-worker.js`.
 *
 * Two rules shape the design.
 *
 * **A new version never takes over on its own.** `skipWaiting` is sent only when the
 * application says so, because swapping the bundle reloads the page, and reloading a page
 * that is 30 minutes into a strictly timed paper is unforgivable.
 *
 * **Nothing here is required for the application to work.** A browser with no service
 * worker, a page served over plain HTTP, a user who blocks storage — each of those returns
 * a clearly reported unsupported state and the rest of ESAT Atlas carries on unchanged.
 */

import { publicAsset } from "./assets";

/** The generated inventory of every question crop and worked-solution page shipped. */
export interface OfflineLibraryManifest {
  libraryVersion: string;
  fileCount: number;
  totalBytes: number;
  files: string[];
}

export type LibraryPhase =
  /** No service worker: unsupported browser, or an insecure origin. */
  | "unavailable"
  /** The worker is there but the stored count has not been read yet. */
  | "checking"
  | "idle"
  | "downloading";

export interface LibraryState {
  phase: LibraryPhase;
  /** Assets stored on this device. */
  cached: number;
  /** Assets the deployment ships. */
  total: number;
  /** Assets this download could not fetch; retrying picks up exactly those. */
  failed: number;
  /** Total bytes this origin is using, as the browser reports it — not just the library. */
  storageBytes: number;
  /** Bytes the complete library would occupy, from the build manifest. */
  libraryBytes: number;
}

export const EMPTY_LIBRARY_STATE: LibraryState = {
  phase: "checking",
  cached: 0,
  total: 0,
  failed: 0,
  storageBytes: 0,
  libraryBytes: 0,
};

/** Whole units up to two significant decimals: "34.2 MB", "912 kB", "0 B". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "kB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const decimals = unit === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

/** Whole per cent, never rounding an incomplete download up to 100. */
export function completionPercent(cached: number, total: number): number {
  if (total <= 0) return 0;
  if (cached >= total) return 100;
  return Math.min(99, Math.floor((cached / total) * 100));
}

/**
 * One line describing what is stored, written for a candidate rather than an engineer.
 * Kept pure so the wording is covered by tests rather than by reading it off a screen.
 */
export function libraryStatusMessage(state: LibraryState): string {
  if (state.phase === "unavailable") {
    return "This browser cannot store the question library offline. Sessions still need a connection here.";
  }
  if (state.phase === "checking") return "Checking what is already stored on this device…";
  if (state.total === 0) return "The offline library is only available in the published application.";
  if (state.phase === "downloading") {
    return `Downloading question images — ${state.cached} of ${state.total} stored (${completionPercent(state.cached, state.total)}%).`;
  }
  if (state.cached >= state.total) {
    return `Every question image is stored on this device (${formatBytes(state.libraryBytes)}). Papers open with no connection.`;
  }
  if (state.cached === 0) {
    return `No question images are stored yet. Downloading all ${state.total} takes about ${formatBytes(state.libraryBytes)}.`;
  }
  return `${state.cached} of ${state.total} question images are stored, from the questions you have already opened. The rest still need a connection.`;
}

/* ----------------------------------------------------------------- registration -- */

export type WorkerPhase = "unsupported" | "registering" | "ready" | "failed";

export interface RegistrationEvents {
  onPhase: (phase: WorkerPhase) => void;
  /** A newer deployment has finished installing and is waiting to take over. */
  onUpdateReady: () => void;
}

/** Service workers need a secure context; `file://` and plain HTTP are both out. */
export function serviceWorkerSupported(): boolean {
  return typeof navigator !== "undefined"
    && "serviceWorker" in navigator
    && typeof window !== "undefined"
    && window.isSecureContext;
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function watchForUpdate(registration: ServiceWorkerRegistration, onUpdateReady: () => void): void {
  // `waiting` is already set when a previous visit installed an update the candidate never
  // applied, so both the current state and future transitions have to be handled.
  if (registration.waiting && navigator.serviceWorker.controller) onUpdateReady();
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // Without an existing controller this is the very first install, not an update:
      // there is nothing to replace and nothing to tell the candidate about.
      if (installing.state === "installed" && navigator.serviceWorker.controller) onUpdateReady();
    });
  });
}

/**
 * Register the worker and keep watching for new deployments. Idempotent: React Strict Mode
 * mounts effects twice in development, and re-registering would restart the install.
 */
export function registerServiceWorker(events: RegistrationEvents): () => void {
  if (!serviceWorkerSupported()) {
    events.onPhase("unsupported");
    return () => undefined;
  }
  events.onPhase("registering");
  let cancelled = false;
  registrationPromise ??= navigator.serviceWorker.register(publicAsset("sw.js"), { scope: publicAsset("") });

  const checkForUpdate = () => {
    registrationPromise?.then((registration) => registration?.update().catch(() => undefined));
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") checkForUpdate();
  };
  // Half an hour is frequent enough that a fix reaches an installed application the same
  // day, and rare enough to be invisible on a metered connection.
  const interval = window.setInterval(checkForUpdate, 30 * 60_000);
  document.addEventListener("visibilitychange", onVisible);

  registrationPromise
    .then((registration) => {
      if (cancelled || !registration) return;
      events.onPhase("ready");
      watchForUpdate(registration, events.onUpdateReady);
    })
    .catch(() => {
      registrationPromise = null;
      if (!cancelled) events.onPhase("failed");
    });

  return () => {
    cancelled = true;
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/**
 * Hand over to the waiting deployment and reload once it has taken control.
 *
 * The reload is driven by `controllerchange` rather than fired straight after the message,
 * so the new page is guaranteed to be served by the new worker instead of racing it.
 */
export async function applyWaitingUpdate(): Promise<void> {
  if (!serviceWorkerSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(publicAsset(""));
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  waiting.postMessage({ type: "skip-waiting" });
}

/* --------------------------------------------------------------------- messaging -- */

/** The worker that can answer messages, which is not always the one that is controlling. */
async function activeWorker(): Promise<ServiceWorker | null> {
  if (!serviceWorkerSupported()) return null;
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
  const registration = await navigator.serviceWorker.getRegistration(publicAsset(""));
  return registration?.active ?? null;
}

export interface LibraryProgressMessage {
  type: "library-status" | "library-progress" | "library-complete";
  cached: number;
  total: number;
  failed?: number;
  storageBytes?: number;
  cancelled?: boolean;
}

/**
 * Send one request and stream every reply until the worker reports completion.
 *
 * A `MessageChannel` is used rather than a `message` listener on the registration so that
 * two concurrent operations — a status check while a download runs — cannot read each
 * other's replies.
 */
export async function requestFromWorker(
  message: Record<string, unknown>,
  onMessage: (reply: LibraryProgressMessage) => void,
): Promise<void> {
  const worker = await activeWorker();
  if (!worker) throw new Error("No active service worker is available.");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    // A worker that is killed mid-download would otherwise leave this pending forever.
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("The offline worker did not respond."));
    }, 60_000);
    channel.port1.onmessage = (event: MessageEvent<LibraryProgressMessage>) => {
      window.clearTimeout(timeout);
      onMessage(event.data);
      if (event.data.type === "library-status" || event.data.type === "library-complete") {
        channel.port1.close();
        resolve();
      }
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/** The build-time inventory, or null when running the unbuilt development server. */
export async function loadLibraryManifest(): Promise<OfflineLibraryManifest | null> {
  try {
    const response = await fetch(publicAsset("data/offline-library.json"));
    if (!response.ok) return null;
    const manifest = await response.json() as OfflineLibraryManifest;
    return Array.isArray(manifest.files) ? manifest : null;
  } catch {
    return null;
  }
}

/**
 * Ask the browser to exempt this origin from eviction under storage pressure.
 *
 * Without it a browser clearing space can drop a 34 MB library and a session's working out
 * with no warning. Chrome grants it silently to an installed application; Firefox prompts.
 * A refusal is not an error — the data simply becomes evictable.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
