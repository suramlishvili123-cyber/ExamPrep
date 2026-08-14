/**
 * Bounded local persistence.
 *
 * The device copy is a cache, not the record: Firestore holds the authoritative history,
 * and this exists so a reload, a closed tab or an offline session loses nothing. That
 * distinction is what makes shedding safe — anything dropped here is still in the cloud
 * copy and in a JSON export.
 *
 * Writing the whole record unconditionally does not scale. A candidate with a year of
 * revision reaches several megabytes, and browsers cap an origin at roughly 5 MB. The
 * failure mode matters more than the size: once `setItem` throws, every later write fails
 * too, so an in-progress exam would stop being recoverable exactly when it matters most.
 *
 * So the payload is shed in tiers until it fits, cheapest information first. One
 * invariant holds at every tier: the active attempt and the complete profile — settings,
 * targets, notes, progress, retrieval queue and sync clocks — are always written.
 */

import type { Attempt, StoredState } from "./core";

export type PersistTier = 0 | 1 | 2 | 3 | 4;

export type PersistReason =
  | "ok"
  | "compacted"
  /** Storage is unusable (disabled, private mode, blocked); a smaller payload will not help. */
  | "unavailable"
  /** Even the smallest payload was rejected. */
  | "quota";

export interface PersistResult {
  stored: boolean;
  tier: PersistTier;
  bytes: number;
  /** Completed attempts left out of the device copy; they remain in the cloud copy. */
  droppedAttempts: number;
  reason: PersistReason;
}

/** How many completed attempts each tier keeps on the device. */
const TIER_ATTEMPT_LIMIT: Record<PersistTier, number> = {
  0: Number.POSITIVE_INFINITY,
  1: Number.POSITIVE_INFINITY,
  2: 40,
  3: 12,
  4: 0,
};

export const PERSIST_TIERS: PersistTier[] = [0, 1, 2, 3, 4];

/**
 * `answerChanges` and `timestamps` are recorded for the JSON export and for any later
 * analysis, but nothing in the application reads them back. On a heavy record they are
 * over half the payload, which makes them the first thing to shed and the least missed.
 */
function stripWriteOnlyDetail(attempt: Attempt): Attempt {
  let changed = false;
  const responses: Attempt["responses"] = {};
  for (const [questionId, response] of Object.entries(attempt.responses)) {
    if (response.answerChanges?.length || response.timestamps?.length) {
      changed = true;
      responses[questionId] = { ...response, answerChanges: [], timestamps: [] };
    } else {
      responses[questionId] = response;
    }
  }
  return changed ? { ...attempt, responses } : attempt;
}

function newestFirst(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort(
    (left, right) => (right.endedAt ?? right.startedAt) - (left.endedAt ?? left.startedAt),
  );
}

/**
 * The state as it would be written at `tier`. Pure, so the shedding policy can be tested
 * without a browser and reasoned about without reading the effect that calls it.
 */
export function compactForStorage(state: StoredState, tier: PersistTier): StoredState {
  if (tier <= 0) return state;
  const limit = TIER_ATTEMPT_LIMIT[tier];
  const kept = Number.isFinite(limit) ? newestFirst(state.attempts).slice(0, limit) : state.attempts;
  return {
    ...state,
    // The active attempt keeps its full detail at every tier: it is the one record that
    // has not reached the cloud yet, and losing it loses a session in progress.
    attempts: kept.map(stripWriteOnlyDetail),
  };
}

/** Browsers disagree on the shape of a quota failure, so match on all the known forms. */
function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "QuotaExceededError"
      || error.name === "NS_ERROR_DOM_QUOTA_REACHED"
      || error.code === 22;
  }
  const name = typeof error === "object" && error && "name" in error ? String(error.name) : "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export interface StorageLike {
  setItem(key: string, value: string): void;
}

/**
 * Write the state, shedding detail until it fits. Returns what was actually stored so the
 * interface can tell the candidate the truth rather than silently keeping less.
 */
export function persistStoredState(
  storage: StorageLike,
  key: string,
  state: StoredState,
): PersistResult {
  const total = state.attempts.length;
  let lastBytes = 0;
  for (const tier of PERSIST_TIERS) {
    const payload = JSON.stringify(compactForStorage(state, tier));
    lastBytes = payload.length;
    try {
      storage.setItem(key, payload);
      const kept = Math.min(total, TIER_ATTEMPT_LIMIT[tier]);
      return {
        stored: true,
        tier,
        bytes: payload.length,
        droppedAttempts: total - kept,
        reason: tier === 0 ? "ok" : "compacted",
      };
    } catch (error) {
      // A non-quota failure means storage itself is unusable; a smaller payload cannot
      // help, and retrying four more times would only waste work on every save.
      if (!isQuotaError(error)) {
        return { stored: false, tier, bytes: payload.length, droppedAttempts: 0, reason: "unavailable" };
      }
    }
  }
  return { stored: false, tier: 4, bytes: lastBytes, droppedAttempts: total, reason: "quota" };
}
