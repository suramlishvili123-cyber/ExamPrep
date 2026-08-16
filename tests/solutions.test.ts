import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { parseMath, splitMath } from "../app/lib/math-markup";
import { ALL_WORKED_SOLUTIONS, getWorkedSolution } from "../app/lib/solutions";

const bankPath = resolve("public/data/question-bank.json");
const mocksPath = resolve("public/data/original-mocks.json");

const bank = JSON.parse(readFileSync(bankPath, "utf8"));
const mocks = JSON.parse(readFileSync(mocksPath, "utf8"));

test("every question in bank has a non-empty worked solution", () => {
  assert.equal(bank.questions.length, 517);
  for (const q of bank.questions) {
    assert.ok(q.explanation && q.explanation.trim().length > 0, `Bank question ${q.id} missing explanation`);
    const sol = getWorkedSolution(q.id);
    assert.ok(sol, `Bank question ${q.id} not found in ALL_WORKED_SOLUTIONS`);
    assert.equal(sol.correctAnswer, q.correctAnswer, `Answer mismatch on ${q.id}`);
  }
});

test("every question in original mocks has a non-empty worked solution", () => {
  assert.equal(mocks.questions.length, 81);
  for (const q of mocks.questions) {
    assert.ok(q.explanation && q.explanation.trim().length > 0, `Mock question ${q.id} missing explanation`);
    const sol = getWorkedSolution(q.id);
    assert.ok(sol, `Mock question ${q.id} not found in ALL_WORKED_SOLUTIONS`);
    assert.equal(sol.correctAnswer, q.correctAnswer, `Answer mismatch on ${q.id}`);
  }
});

test("total unique worked solutions in registry equals 598", () => {
  const ids = Object.keys(ALL_WORKED_SOLUTIONS);
  assert.equal(ids.length, 598);
});

test("every worked solution contains balanced math markup and parses without errors", () => {
  for (const [id, sol] of Object.entries(ALL_WORKED_SOLUTIONS)) {
    // Check explanation
    const expl = sol.explanation;
    const dollarCount = (expl.match(/\$/g) || []).length;
    assert.equal(dollarCount % 2, 0, `Unbalanced $ delimiter in explanation for ${id}`);
    
    // Parse math segments
    const segments = splitMath(expl);
    for (const segment of segments) {
      if (segment.math) {
        assert.doesNotThrow(() => {
          const nodes = parseMath(segment.content);
          assert.ok(Array.isArray(nodes));
        }, `Failed parsing math in ${id}: ${segment.content}`);
      }
    }

    // Check fast method if present
    if (sol.methodFast) {
      const fastDollarCount = (sol.methodFast.match(/\$/g) || []).length;
      assert.equal(fastDollarCount % 2, 0, `Unbalanced $ delimiter in methodFast for ${id}`);
      const fastSegments = splitMath(sol.methodFast);
      for (const segment of fastSegments) {
        if (segment.math) {
          assert.doesNotThrow(() => {
            const nodes = parseMath(segment.content);
            assert.ok(Array.isArray(nodes));
          }, `Failed parsing math in methodFast for ${id}: ${segment.content}`);
        }
      }
    }

    // Check keyConcept if present
    if (sol.keyConcept) {
      const conceptDollarCount = (sol.keyConcept.match(/\$/g) || []).length;
      assert.equal(conceptDollarCount % 2, 0, `Unbalanced $ delimiter in keyConcept for ${id}`);
      const conceptSegments = splitMath(sol.keyConcept);
      for (const segment of conceptSegments) {
        if (segment.math) {
          assert.doesNotThrow(() => {
            const nodes = parseMath(segment.content);
            assert.ok(Array.isArray(nodes));
          }, `Failed parsing math in keyConcept for ${id}: ${segment.content}`);
        }
      }
    }
  }
});
