/**
 * Renders a sample of the authored bank through the real MathText component and the
 * real stylesheets, so the typesetting can be inspected visually rather than trusted.
 *
 *   node --import tsx scripts/render_math_preview.mjs > preview.html
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MathText } from "../app/math-text.tsx";

const bank = JSON.parse(readFileSync(new URL("../public/data/original-mocks.json", import.meta.url), "utf8"));
const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const analysis = readFileSync(new URL("../app/analysis.css", import.meta.url), "utf8");
const render = (source) => renderToStaticMarkup(createElement(MathText, null, source));

// The items that exercise every construct: radicals, fractions, binomials, integrals,
// ellipses, superscripts, symbols and units.
const wanted = [
  "atlas-challenge-a-maths1-q04", "atlas-challenge-a-maths1-q05", "atlas-challenge-a-maths1-q03",
  "atlas-challenge-a-maths1-q26", "atlas-challenge-a-maths2-q22", "atlas-challenge-a-maths2-q02",
  "atlas-challenge-a-maths2-q12", "atlas-challenge-a-maths2-q06", "atlas-challenge-a-physics-q01",
  "atlas-challenge-a-physics-q06", "atlas-challenge-a-maths1-q02", "atlas-challenge-a-maths2-q20",
];
const questions = wanted.map((id) => bank.questions.find((q) => q.id === id)).filter(Boolean);

const cards = questions.map((question) => `
  <article class="panel">
    <span class="eyebrow">${question.esatTopic} · ${question.id.replace("atlas-challenge-a-", "")}</span>
    <div class="authored-question"><p>${render(question.questionText)}</p></div>
    <div class="answer-options">
      ${question.answerOptions.map((letter) => `
        <button class="${letter === question.correctAnswer ? "selected" : ""}">
          <kbd>${letter}</kbd><span>${render(question.optionText[letter])}</span>
        </button>`).join("")}
    </div>
    <p class="panel-footnote">${render(question.explanation)}</p>
  </article>`).join("");

process.stdout.write(`<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8">
<title>ESAT Atlas — maths typesetting preview</title>
<style>${globals.replace('@import "tailwindcss";', "")}</style>
<style>${analysis}</style>
<style>
  body { padding: 28px; background: var(--bg); }
  .preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap: 18px; align-items: start; }
  .panel { padding: 18px; }
  .authored-question { min-height: 0; padding: 0; margin: 10px 0 14px; }
  .authored-question p { margin: 0; font-size: 15px; line-height: 1.65; }
  h1 { margin: 0 0 18px; font-size: 20px; }
</style>
</head><body>
<h1>Maths typesetting preview</h1>
<div class="preview-grid">${cards}</div>
</body></html>`);
