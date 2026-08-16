import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mathToPlainText, splitMath } from "../app/lib/math-markup";
import {
  EXAM_TACTICS,
  TECHNIQUE_GUIDES,
  techniqueCoverageKey,
  techniqueForQuestion,
} from "../app/lib/learning";
import type { Question } from "../app/lib/core";

type Payload = { questions: Question[] };

const archive = JSON.parse(
  await readFile(new URL("../public/data/question-bank.json", import.meta.url), "utf8"),
) as Payload;
const originals = JSON.parse(
  await readFile(new URL("../public/data/original-mocks.json", import.meta.url), "utf8"),
) as Payload;
const allQuestions = [...archive.questions, ...originals.questions];

function assertMathMarkup(value: string, label: string): void {
  const escaped = (value.match(/\\\$/g) ?? []).length;
  const delimiters = value.split("$").length - 1 - escaped;
  assert.equal(delimiters % 2, 0, `${label}: unbalanced maths delimiter`);
  for (const segment of splitMath(value)) {
    if (!segment.math) continue;
    assert.equal(
      (segment.content.match(/\{/g) ?? []).length,
      (segment.content.match(/\}/g) ?? []).length,
      `${label}: unbalanced maths braces`,
    );
  }
  const rendered = mathToPlainText(value);
  assert.doesNotMatch(rendered, /\\[A-Za-z]+|[{}$]/, `${label}: raw maths markup leaks after rendering`);
}

test("every shipped question resolves to a reviewed best-and-fastest technique", () => {
  const uncovered = allQuestions
    .filter((question) => !techniqueForQuestion(question))
    .map((question) => `${question.id} (${techniqueCoverageKey(question)})`);
  assert.deepEqual(uncovered, []);
});

test("all questions have an honest post-attempt learning route", () => {
  const withWorkedSolutions = allQuestions.filter((question) => Boolean(question.explanation)).length;
  const officialWorked = allQuestions.filter((question) => question.workedSolutionImage).length;

  assert.equal(withWorkedSolutions, 598, "every question must carry a verified step-by-step worked solution");
  assert.equal(officialWorked, 160, "every TMUA item must carry its publisher worked-solution page");

  for (const question of archive.questions) {
    if (question.sourceExam === "TMUA") {
      assert.match(question.workedSolutionSource ?? "", /^Official TMUA \d{4} Paper 1 worked solutions$/, question.id);
    } else {
      assert.equal(question.workedSolutionImage, undefined, `${question.id}: answer-key-only source mislabelled as worked solution`);
    }
  }
});

test("technique playbooks are substantial, unique and renderable", () => {
  assert.equal(TECHNIQUE_GUIDES.length, 22);
  assert.equal(new Set(TECHNIQUE_GUIDES.map((guide) => guide.id)).size, TECHNIQUE_GUIDES.length);
  assert.equal(new Set(TECHNIQUE_GUIDES.map((guide) => `${guide.module}|${guide.topic}`)).size, TECHNIQUE_GUIDES.length);
  assert.deepEqual(new Set(TECHNIQUE_GUIDES.map((guide) => guide.module)), new Set(["maths1", "physics", "maths2"]));

  for (const guide of TECHNIQUE_GUIDES) {
    assert.ok(guide.principle.length >= 80, `${guide.id}: principle too brief`);
    assert.ok(guide.bestMethod.length >= 3, `${guide.id}: full method incomplete`);
    assert.ok(guide.fastMethod.length >= 2, `${guide.id}: fastest route incomplete`);
    assert.ok(guide.traps.length >= 2, `${guide.id}: traps incomplete`);
    assert.ok(guide.keywords.length >= 4, `${guide.id}: search metadata incomplete`);
    // A shortcut published without the case it breaks in is the one thing this surface
    // promises never to do, so an empty or token validity note fails the build.
    assert.ok(guide.validity.length >= 90, `${guide.id}: fast route published without a usable validity condition`);
    for (const [index, value] of [
      guide.example.prompt,
      ...guide.example.steps,
      guide.example.answer,
      ...guide.bestMethod,
      ...guide.fastMethod,
      guide.validity,
    ].entries()) {
      assertMathMarkup(value, `${guide.id}[${index}]`);
    }
  }
});

test("universal tactics teach both a shortcut and its stopping condition", () => {
  assert.ok(EXAM_TACTICS.length >= 8);
  assert.equal(new Set(EXAM_TACTICS.map((tactic) => tactic.id)).size, EXAM_TACTICS.length);
  for (const tactic of EXAM_TACTICS) {
    assert.ok(tactic.summary.length >= 70, `${tactic.id}: summary too brief`);
    assert.ok(tactic.method.length >= 3, `${tactic.id}: method incomplete`);
    assert.ok(tactic.caution.length >= 45, `${tactic.id}: missing a meaningful caution`);
    for (const [index, value] of tactic.method.entries()) assertMathMarkup(value, `${tactic.id}[${index}]`);
  }
});
