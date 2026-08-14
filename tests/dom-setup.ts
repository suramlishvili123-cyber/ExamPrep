/**
 * A DOM for the component tests.
 *
 * Import this before anything that touches React or the application modules: React
 * Testing Library reads `document` when it loads, and the application modules read
 * `localStorage` and `matchMedia` at import time.
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://esat-atlas.test/",
  pretendToBeVisual: true,
});

const { window } = dom;

// Copy the globals a browser build assumes. Anything already defined on globalThis
// (Node's own URL, fetch, and so on) is left alone.
const forwarded = [
  "window", "document", "navigator", "location", "history",
  "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement",
  "Element", "Node", "NodeList", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent",
  "DOMException", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame",
  "localStorage", "sessionStorage", "Image", "MutationObserver", "DOMParser",
] as const;

const target = globalThis as unknown as Record<string, unknown>;
const source = window as unknown as Record<string, unknown>;
for (const name of forwarded) {
  if (source[name] === undefined) continue;
  // Some globals (`navigator` on modern Node) are accessor-only, so a plain assignment
  // throws. Defining the property replaces them regardless of how they were declared.
  Object.defineProperty(target, name, {
    value: source[name],
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

// jsdom implements neither of these, and the application calls both on mount.
target.matchMedia ??= (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});
window.scrollTo = () => undefined;
target.scrollTo = () => undefined;

// React 19 requires this to be set before act() is used.
target.IS_REACT_ACT_ENVIRONMENT = true;

export { window, dom };
