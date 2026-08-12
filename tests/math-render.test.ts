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
