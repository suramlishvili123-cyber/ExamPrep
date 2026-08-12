import assert from "node:assert/strict";
import test from "node:test";
import { mathToPlainText, parseMath, splitMath, unknownCommands, type MathNode } from "../app/lib/math-markup";

/** Compact serialisation so the tree shape can be asserted readably. */
function shape(nodes: MathNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text") return node.italic ? `i(${node.value})` : node.value;
    if (node.type === "sup") return `^[${shape(node.children)}]`;
    if (node.type === "sub") return `_[${shape(node.children)}]`;
    if (node.type === "sqrt") return `sqrt[${shape(node.children)}]`;
    if (node.type === "binom") return `binom[${shape(node.upper)}|${shape(node.lower)}]`;
    return `frac[${shape(node.numerator)}|${shape(node.denominator)}]`;
  }).join("");
}

test("prose without any delimiter passes through untouched", () => {
  const segments = splitMath("A car travels at 72 km/h for 45 seconds.");
  assert.equal(segments.length, 1);
  assert.equal(segments[0].math, false);
  assert.equal(segments[0].content, "A car travels at 72 km/h for 45 seconds.");
});

test("mathematics is separated from the prose around it", () => {
  const segments = splitMath("Evaluate $x^2$ when $x = 3$.");
  assert.deepEqual(segments.map((segment) => [segment.math, segment.content]), [
    [false, "Evaluate "],
    [true, "x^2"],
    [false, " when "],
    [true, "x = 3"],
    [false, "."],
  ]);
});

test("an escaped dollar is currency, not a delimiter", () => {
  const segments = splitMath("It costs \\$250 in total.");
  assert.equal(segments.length, 1);
  assert.equal(segments[0].math, false);
  assert.equal(segments[0].content, "It costs $250 in total.");
});

test("an unterminated delimiter never swallows the rest of the sentence", () => {
  const segments = splitMath("Cost is $250 for the part");
  assert.equal(segments.every((segment) => segment.math === false), true);
  assert.equal(segments.map((segment) => segment.content).join(""), "Cost is 250 for the part");
});

test("superscripts and subscripts accept both braced and single-character arguments", () => {
  assert.equal(shape(parseMath("x^2")), "i(x)^[2]");
  assert.equal(shape(parseMath("10^{-5}")), "10^[-5]");
  assert.equal(shape(parseMath("a_1")), "i(a)_[1]");
  assert.equal(shape(parseMath("x^{2n}")), "i(x)^[2i(n)]");
});

test("radicals and fractions nest correctly", () => {
  assert.equal(shape(parseMath("\\sqrt{57}")), "sqrt[57]");
  assert.equal(shape(parseMath("\\frac{1}{2}")), "frac[1|2]");
  assert.equal(shape(parseMath("\\frac{\\sqrt{5}}{2}")), "frac[sqrt[5]|2]");
  assert.equal(shape(parseMath("\\sqrt{x^2 + 1}")), "sqrt[i(x)^[2] + 1]");
});

test("symbols and function names render upright, variables render italic", () => {
  assert.equal(shape(parseMath("\\pi r^2")), "πi(r)^[2]");
  assert.equal(shape(parseMath("\\sin \\theta")), "sin θ");
  assert.equal(shape(parseMath("30\\deg")), "30°");
  assert.equal(shape(parseMath("4 \\times 10^3")), "4 × 10^[3]");
  assert.equal(shape(parseMath("x \\le 6")), "i(x) ≤ 6");
  assert.equal(shape(parseMath("R = 12\\ohm")), "i(R) = 12Ω");
});

test("text mode keeps units and words upright", () => {
  assert.equal(shape(parseMath("5400\\text{ Pa}")), "5400 Pa");
  assert.equal(shape(parseMath("v\\text{ in m/s}")), "i(v) in m/s");
});

test("an unknown command is flagged loudly rather than shown as bare text", () => {
  // This is the bug that shipped "0.41666ldots": an unrecognised command silently
  // printed its own name. It must now be impossible to mistake for real content.
  assert.equal(shape(parseMath("\\notacommand")), "⟦\\notacommand?⟧");
  assert.deepEqual(unknownCommands("$0.4\\notacommand$"), ["notacommand"]);
  assert.deepEqual(unknownCommands("$\\frac{1}{2} + \\sqrt{3}$"), []);
  // Commands outside maths mode are ordinary prose and are not checked.
  assert.deepEqual(unknownCommands("a backslash \\notacommand in prose"), []);
});

test("the commands the bank actually uses all render", () => {
  for (const source of [
    "$0.41666\\ldots$", "$\\binom{12}{3}$", "$\\int_1^4 x\\, dx$",
    "$\\left(3\\sqrt{x}\\right)$", "$54\\,000$", "$90\\%$",
  ]) {
    assert.deepEqual(unknownCommands(source), [], source);
    assert.doesNotMatch(mathToPlainText(source), /⟦/, source);
  }
  assert.equal(mathToPlainText("$0.41666\\ldots$"), "0.41666…");
  assert.equal(mathToPlainText("$\\binom{12}{3}$"), "C(12, 3)");
  assert.equal(mathToPlainText("$\\int_1^4$"), "∫₁⁴");
  assert.equal(mathToPlainText("$\\left(x\\right)$"), "(x)");
});

test("the parser terminates on unbalanced braces", () => {
  assert.doesNotThrow(() => parseMath("\\frac{1}{"));
  assert.doesNotThrow(() => parseMath("\\sqrt{"));
  assert.doesNotThrow(() => parseMath("}}}"));
  assert.doesNotThrow(() => parseMath("^"));
});

test("plain-text rendering keeps mathematics readable for alt text and export", () => {
  assert.equal(mathToPlainText("Evaluate $x^2 + 1$."), "Evaluate x² + 1.");
  assert.equal(mathToPlainText("$10^{-5}$"), "10⁻⁵");
  assert.equal(mathToPlainText("$\\sqrt{57}$ cm"), "√(57) cm");
  assert.equal(mathToPlainText("$\\frac{3}{11}$"), "3/11");
  assert.equal(mathToPlainText("$\\pi$"), "π");
  assert.equal(mathToPlainText("no maths here"), "no maths here");
});
