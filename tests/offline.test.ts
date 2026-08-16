/**
 * The offline stack's reportable state.
 *
 * The service worker itself needs a browser, so what is covered here is the part that
 * decides what a candidate is told: how much is stored, whether that is everything, and the
 * sentence the settings panel shows. Getting that wrong means promising an offline library
 * that is not there, which is worse than having no library at all.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_LIBRARY_STATE,
  completionPercent,
  formatBytes,
  libraryStatusMessage,
  type LibraryState,
} from "../app/lib/offline";

function state(overrides: Partial<LibraryState> = {}): LibraryState {
  return { ...EMPTY_LIBRARY_STATE, phase: "idle", total: 689, libraryBytes: 33_302_742, ...overrides };
}

test("byte sizes read the way a download dialog does", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(-5), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1_000), "1.0 kB");
  assert.equal(formatBytes(912_000), "912 kB");
  assert.equal(formatBytes(33_302_742), "33 MB");
  assert.equal(formatBytes(2_400_000_000), "2.4 GB");
});

test("progress never rounds an unfinished download up to a hundred per cent", () => {
  assert.equal(completionPercent(0, 689), 0);
  assert.equal(completionPercent(688, 689), 99);
  // 688.9/689 still rounds to 99: only a genuinely complete library reports 100.
  assert.equal(completionPercent(689, 689), 100);
  assert.equal(completionPercent(700, 689), 100);
  assert.equal(completionPercent(5, 0), 0);
});

test("the status line says what is actually on the device", () => {
  assert.match(libraryStatusMessage(state({ phase: "unavailable" })), /cannot store/);
  assert.match(libraryStatusMessage(state({ phase: "checking" })), /Checking/);
  assert.match(libraryStatusMessage(state({ total: 0 })), /only available in the published application/);

  const none = libraryStatusMessage(state({ cached: 0 }));
  assert.match(none, /No question images are stored yet/);
  assert.match(none, /689/);
  assert.match(none, /33 MB/);

  const partial = libraryStatusMessage(state({ cached: 120 }));
  assert.match(partial, /120 of 689/);
  assert.match(partial, /still need a connection/);

  const complete = libraryStatusMessage(state({ cached: 689 }));
  assert.match(complete, /Every question image is stored/);
  assert.match(complete, /no connection/);

  const running = libraryStatusMessage(state({ phase: "downloading", cached: 344 }));
  assert.match(running, /344 of 689/);
  assert.match(running, /49%/);
});
