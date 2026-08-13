import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MathText } from "../app/math-text";

type MockQuestion = {
  id: string;
  questionText: string;
  explanation: string;
  optionText: Record<string, string>;
};

const payload = JSON.parse(
  await readFile(new URL("../public/data/original-mocks.json", import.meta.url), "utf8"),
) as { questions: MockQuestion[] };
const [globalStyles, analysisStyles] = await Promise.all([
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/analysis.css", import.meta.url), "utf8"),
]);

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi);
  assert.ok(channels, `expected a six-digit hex colour, received ${hex}`);
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * red + .7152 * green + .0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((left, right) => right - left);
  return (lighter + .05) / (darker + .05);
}

function cssVariable(block: string, name: string): string {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(block)?.[1];
  assert.ok(value, `missing --${name}`);
  return value;
}

// createElement rather than JSX so the test needs no JSX runtime configuration.
const render = (source: string) => renderToStaticMarkup(createElement(MathText, null, source));

test("plain prose renders unchanged", () => {
  assert.equal(render("A skydiver has reached terminal velocity."), "A skydiver has reached terminal velocity.");
});

test("superscripts, radicals and fractions become real typeset markup", () => {
  assert.match(render("$x^2$"), /<sup>2<\/sup>/);
  assert.match(render("$10^{-5}$"), /<sup>-5<\/sup>/);
  assert.match(render("$\\sqrt{57}$"), /math-sqrt/);
  assert.match(render("$\\sqrt{57}$"), /math-radicand/);
  assert.match(render("$\\frac{3}{11}$"), /math-frac/);
  assert.match(render("$\\frac{3}{11}$"), /math-num/);
  assert.match(render("$\\frac{3}{11}$"), /math-den/);
  assert.match(render("$x$"), /math-var/);
});

test("visual mathematics exposes an explicit spoken mathematical name", () => {
  const html = render("Use $\\frac{\\sqrt{x^2}}{y_1}$ and $\\binom{n}{2}$.");
  assert.equal(html.match(/role="math"/g)?.length, 2);
  assert.match(
    html,
    /aria-label="fraction with numerator square root of x squared, end square root, and denominator y subscript 1, end subscript, end fraction"/,
  );
  assert.match(html, /aria-label="n choose 2"/);
  assert.match(render("$\\pi r^2 \\le 4$"), /aria-label="pi r squared less than or equal to 4"/);
});

test("symbols render as glyphs, never as command names", () => {
  assert.match(render("$\\pi r^2$"), /π/);
  assert.match(render("$30\\deg$"), /°/);
  assert.match(render("$12\\ohm$"), /Ω/);
  assert.match(render("$x \\le 6$"), /≤/);
  assert.match(render("$4 \\times 10^3$"), /×/);
});

test("no authored question can show raw markup to a candidate", () => {
  const offenders: string[] = [];
  for (const question of payload.questions) {
    const fields = [question.questionText, question.explanation, ...Object.values(question.optionText)];
    for (const field of fields) {
      const html = render(field);
      // Strip tags and attributes, leaving only what a candidate actually reads.
      const visible = html.replace(/<[^>]*>/g, "");
      if (/[${}]/.test(visible) && !/\$\d/.test(visible)) offenders.push(`${question.id}: ${visible}`);
      if (/\\[A-Za-z]+/.test(visible)) offenders.push(`${question.id}: ${visible}`);
    }
  }
  assert.deepEqual(offenders, [], `raw markup reached the rendered output:\n${offenders.slice(0, 5).join("\n")}`);
});

test("every authored question renders without throwing", () => {
  for (const question of payload.questions) {
    const fields = [question.questionText, question.explanation, ...Object.values(question.optionText)];
    for (const field of fields) {
      assert.doesNotThrow(() => render(field), `${question.id} failed to render`);
      assert.ok(render(field).length > 0, `${question.id} rendered empty`);
    }
  }
});

test("a question that uses several constructs at once typesets correctly", () => {
  const html = render("Evaluate $\\frac{(2.4 \\times 10^{-5})(5 \\times 10^{12})}{8 \\times 10^{3}}$ exactly.");
  assert.match(html, /math-frac/);
  assert.match(html, /<sup>-5<\/sup>/);
  assert.match(html, /<sup>12<\/sup>/);
  assert.match(html, /×/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ""), /frac|times/);
});

test("accessibility CSS keeps controls and result data available on narrow screens", () => {
  assert.match(globalStyles, /--focus-ring:\s*#0f604f/);
  assert.match(globalStyles, /--action-bg:\s*#087762/);
  assert.match(globalStyles, /\.text-button\s*\{[^}]*min-height:\s*28px/);
  assert.match(globalStyles, /\.mini-trend\s*>\s*button\.trend-bar\s*\{[^}]*min-width:\s*24px[^}]*min-height:\s*24px/);
  assert.doesNotMatch(globalStyles, /\.exam-progress\s*\{\s*display:\s*none/);
  assert.doesNotMatch(globalStyles, /\.exam-nav\s*\.button:nth-child\(2\)\s*\{\s*display:\s*none/);
  assert.doesNotMatch(globalStyles, /\.topic-row\s*>\s*:nth-child\(4\)[^}]*display:\s*none/);

  const finalPhoneRules = globalStyles.slice(globalStyles.lastIndexOf("@media (max-width: 650px)"));
  assert.match(finalPhoneRules, /\.auth-story-copy\s*>\s*p, \.auth-benefits[^}]*display:\s*none/);
  assert.match(finalPhoneRules, /\.exam-progress\s*\{[^}]*display:\s*grid/);
  assert.match(finalPhoneRules, /\.exam-nav\s*\.button:nth-child\(2\)\s*\{\s*display:\s*inline-flex/);
  assert.match(finalPhoneRules, /\.question-toolbar\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(finalPhoneRules, /\.topic-row\s*>\s*:nth-child\(4\)[^}]*display:\s*block/);

  assert.doesNotMatch(analysisStyles, /\.history-row\s*>\s*:nth-child\([^}]+display:\s*none/);
  assert.doesNotMatch(analysisStyles, /\.section-row\s*>\s*:nth-child\([^}]+display:\s*none/);
  assert.doesNotMatch(analysisStyles, /\.log-row\s*>\s*:nth-child\([^}]+display:\s*none/);
  assert.doesNotMatch(analysisStyles, /\.compare-row\s+small\s*\{\s*display:\s*none/);
  assert.match(analysisStyles, /\.history-list, \.section-table, \.question-log, \.compare-list\s*\{[^}]*overflow-x:\s*auto/);
});

test("light and dark accessibility tokens meet WCAG contrast thresholds", () => {
  const light = /:root\s*\{([^}]+)\}/.exec(globalStyles)?.[1] ?? "";
  const dark = /:root\[data-theme="dark"\]\s*\{([^}]+)\}/.exec(globalStyles)?.[1] ?? "";

  assert.ok(contrastRatio(cssVariable(light, "action-bg"), "#ffffff") >= 4.5);
  assert.ok(contrastRatio(cssVariable(light, "link"), cssVariable(light, "surface")) >= 4.5);
  assert.ok(contrastRatio(cssVariable(light, "focus-ring"), cssVariable(light, "surface")) >= 3);
  assert.ok(contrastRatio(cssVariable(dark, "action-bg"), "#ffffff") >= 4.5);
  assert.ok(contrastRatio(cssVariable(dark, "action-bg"), cssVariable(dark, "surface")) >= 3);
  assert.ok(contrastRatio(cssVariable(dark, "green"), cssVariable(dark, "surface")) >= 4.5);
  assert.ok(contrastRatio(cssVariable(dark, "blue"), cssVariable(dark, "blue-soft")) >= 4.5);
  assert.ok(contrastRatio(cssVariable(dark, "amber"), cssVariable(dark, "amber-soft")) >= 4.5);
  assert.ok(contrastRatio(cssVariable(dark, "red"), cssVariable(dark, "red-soft")) >= 4.5);
  assert.ok(contrastRatio(cssVariable(dark, "focus-ring"), cssVariable(dark, "surface")) >= 3);
});
