/**
 * ESAT Atlas service worker.
 *
 * Two caches, because the two kinds of asset have opposite lifetimes:
 *
 * - The **shell** (HTML, bundle, stylesheet, icons, question bank JSON) is versioned per
 *   build and precached during `install`. A deployment replaces it wholesale, and the old
 *   copy is deleted on `activate`.
 * - The **library** (question crops and worked-solution pages, about 34 MB) is versioned
 *   by the question bank it belongs to, filled lazily as questions are seen and eagerly
 *   when the candidate asks for the whole archive. It deliberately survives a redeploy:
 *   re-downloading 34 MB because a stylesheet changed would be indefensible on a phone.
 *
 * Nothing here auto-activates. A new bundle taking over mid-question would reload the page
 * out from under a timed exam, so the waiting worker sits there until the application says
 * it is safe to swap — see `app/lib/offline.ts`.
 *
 * This file is not bundled. `scripts/prepare_dist.mjs` copies it to `dist/sw.js` after the
 * Vite build — the only point at which the hashed asset filenames are known — substituting
 * the placeholder tokens below. It lives in `app/` rather than `public/` so that it is
 * linted and reviewed like the rest of the application rather than shipped unchecked.
 *
 * There is deliberately no service worker under `npm run dev`: a cached shell in front of
 * the dev server would serve yesterday's bundle after every edit.
 */

const BUILD_ID = "__ESAT_BUILD_ID__";
const LIBRARY_VERSION = "__ESAT_LIBRARY_VERSION__";
const PRECACHE_URLS = ["__ESAT_PRECACHE__"];

const SHELL_CACHE = `esat-shell-${BUILD_ID}`;
const LIBRARY_CACHE = `esat-library-${LIBRARY_VERSION}`;
/** The document every navigation resolves to; the application routes on the hash. */
const SHELL_DOCUMENT = "index.html";

/** Unsubstituted placeholders, so a development copy of this file precaches nothing. */
function injected(value) {
  return !String(value).startsWith("__ESAT_");
}

const PRECACHE = PRECACHE_URLS.filter(injected);

/** How many library assets are fetched at once during a bulk download. */
const LIBRARY_CONCURRENCY = 6;

/* --------------------------------------------------------------- install / activate -- */

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // `cache.addAll` is atomic: one 404 discards the whole precache and the worker never
    // installs, which would leave the site permanently uncached. Each entry is added
    // individually so a single missing optional asset cannot cost the offline build.
    const results = await Promise.allSettled(PRECACHE.map(async (url) => {
      const request = new Request(url, { cache: "reload" });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`${url}: ${response.status}`);
      await cache.put(url, response);
    }));
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      // Reported rather than thrown: an installed worker serving most of the shell is
      // strictly better than no worker at all.
      console.warn(`ESAT Atlas: ${failed.length} shell asset(s) were not precached.`, failed);
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) await self.registration.navigationPreload.disable();
    const names = await caches.keys();
    await Promise.all(names.map((name) => {
      const isOurs = name.startsWith("esat-shell-") || name.startsWith("esat-library-");
      const isCurrent = name === SHELL_CACHE || name === LIBRARY_CACHE;
      return isOurs && !isCurrent ? caches.delete(name) : Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

/* ------------------------------------------------------------------------- fetching -- */

/**
 * `Cache.match` honours the stored response's `Vary` header, and a static host will happily
 * send `Vary: Origin` or `Vary: Accept-Encoding` on ordinary assets. Precached entries are
 * stored from a worker-initiated request that carries neither header, while the document's
 * own `<script type="module">` request is a CORS request that does send `Origin` — so a
 * default match misses, and the application loads its shell offline but not its bundle.
 *
 * The stored entry is keyed by URL and by nothing else, which is exactly what is wanted for
 * a precache, so every lookup ignores `Vary`.
 */
const MATCH_OPTIONS = { ignoreVary: true };

/** Question crops and worked-solution pages: large, immutable, cached on first sight. */
function isLibraryAsset(url) {
  return url.pathname.includes("/questions/");
}

async function cacheFirst(cacheName, request, { store = true } = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, MATCH_OPTIONS);
  if (cached) return cached;
  const response = await fetch(request);
  // Only a complete, same-origin 200 is worth keeping: storing an opaque or partial
  // response would poison the cache with something that can never be served offline.
  if (store && response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Firebase, Google identity and anything else off-origin is left entirely alone. Auth
  // and Firestore run their own retry and offline queueing, and a cache in front of them
  // could only ever serve a stale answer to a request that must not have one.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(SHELL_DOCUMENT, MATCH_OPTIONS);
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        // No shell and no network: the browser's own offline page is the honest answer.
        return Response.error();
      }
    })());
    return;
  }

  if (isLibraryAsset(url)) {
    event.respondWith(cacheFirst(LIBRARY_CACHE, request).catch(() => Response.error()));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request, MATCH_OPTIONS);
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch {
      return Response.error();
    }
  })());
});

/* ------------------------------------------------------- bulk library download jobs -- */

/**
 * Set while a bulk download is running so a later `cancel` message can stop it. A cancelled
 * job keeps everything it had already stored: a partial library is still useful offline.
 */
let libraryJob = null;

async function alreadyCached(cache, urls) {
  const present = new Set();
  await Promise.all(urls.map(async (url) => {
    if (await cache.match(url, MATCH_OPTIONS)) present.add(url);
  }));
  return present;
}

async function libraryStatus(urls) {
  const cache = await caches.open(LIBRARY_CACHE);
  const present = await alreadyCached(cache, urls);
  let bytes = 0;
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    bytes = estimate.usage ?? 0;
  }
  return { total: urls.length, cached: present.size, storageBytes: bytes };
}

/**
 * Download every listed asset that is not already stored, reporting progress as it goes.
 *
 * Failures are counted rather than thrown. On a flaky connection a handful of assets will
 * always fail, and aborting the whole download over one of them would mean the candidate
 * can never finish it; running it again picks up exactly what is still missing.
 */
async function downloadLibrary(urls, report) {
  const cache = await caches.open(LIBRARY_CACHE);
  const present = await alreadyCached(cache, urls);
  const pending = urls.filter((url) => !present.has(url));
  const job = { cancelled: false };
  libraryJob = job;

  let completed = present.size;
  let failed = 0;
  const total = urls.length;
  report({ type: "library-progress", cached: completed, total, failed });

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length && !job.cancelled) {
      const url = pending[cursor];
      cursor += 1;
      try {
        const response = await fetch(new Request(url, { cache: "no-cache" }));
        if (!response.ok || response.type !== "basic") throw new Error(String(response.status));
        await cache.put(url, response);
        completed += 1;
      } catch {
        failed += 1;
      }
      report({ type: "library-progress", cached: completed, total, failed });
    }
  };

  await Promise.all(Array.from({ length: Math.min(LIBRARY_CONCURRENCY, pending.length) }, worker));
  if (libraryJob === job) libraryJob = null;
  const storage = await libraryStatus(urls);
  report({
    type: "library-complete",
    cached: storage.cached,
    total,
    failed,
    storageBytes: storage.storageBytes,
    cancelled: job.cancelled,
  });
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  const port = event.ports?.[0] ?? null;
  const report = (message) => {
    if (port) port.postMessage(message);
  };

  if (data.type === "skip-waiting") {
    self.skipWaiting();
    return;
  }
  if (data.type === "build-id") {
    report({ type: "build-id", buildId: BUILD_ID, libraryVersion: LIBRARY_VERSION });
    return;
  }
  if (data.type === "cancel-library") {
    if (libraryJob) libraryJob.cancelled = true;
    return;
  }
  if (data.type === "library-status") {
    event.waitUntil(libraryStatus(data.urls ?? []).then((status) => report({ type: "library-status", ...status })));
    return;
  }
  if (data.type === "clear-library") {
    if (libraryJob) libraryJob.cancelled = true;
    event.waitUntil(caches.delete(LIBRARY_CACHE).then(async () => {
      const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : { usage: 0 };
      report({ type: "library-complete", cached: 0, total: data.urls?.length ?? 0, failed: 0, storageBytes: estimate.usage ?? 0, cancelled: false });
    }));
    return;
  }
  if (data.type === "cache-library") {
    event.waitUntil(downloadLibrary(data.urls ?? [], report));
  }
});
