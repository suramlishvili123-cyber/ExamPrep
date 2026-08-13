import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mathToPlainText, splitMath } from "../app/lib/math-markup";

type MockQuestion = {
  id: string;
  targetModule: "maths1" | "physics" | "maths2";
  esatTopic: string;
  questionArchetype: string;
  promptTemplateHash: string;
  questionText: string;
  questionDiagram?: string;
  questionDiagramAlt?: string;
  answerOptions: string[];
  optionText: Record<string, string>;
  correctAnswer: string;
  verifiedCorrectText: string;
  explanation: string;
  difficulty: string;
  reviewRequired: boolean;
  excluded: boolean;
};

type MockPayload = {
  version: string;
  questions: MockQuestion[];
  summary: {
    questionCount: number;
    distinctArchetypes: number;
    distinctPromptTemplates: number;
    numberSwapDuplicates: number;
    allTopLevelSpecificationTopicsCovered: boolean;
    optionsPerQuestion: number;
    questionsWithDiagrams: number;
  };
};

const payload = JSON.parse(
  await readFile(new URL("../public/data/original-mocks.json", import.meta.url), "utf8"),
) as MockPayload;

const modules = ["maths1", "physics", "maths2"] as const;

const expectedTopics: Record<MockQuestion["targetModule"], Set<string>> = {
  maths1: new Set(["Units", "Number", "Ratio and proportion", "Algebra", "Geometry", "Statistics", "Probability"]),
  physics: new Set(["Electricity", "Magnetism", "Mechanics", "Thermal physics", "Matter", "Waves", "Radioactivity"]),
  maths2: new Set(["Algebra and functions", "Sequences and series", "Coordinate geometry", "Trigonometry", "Exponentials and logarithms", "Differentiation", "Integration", "Graphs of functions"]),
};

// Independently reworked against the derivations in build_original_mocks.py.
// The snapshot pins the *rendered* answer, so re-typesetting a question cannot move an
// answer key, while a change to the mathematics itself still fails loudly.
const reviewedAnswerKey: Record<MockQuestion["targetModule"], string[]> = {
  maths1: [
    "1 m/s", "5400 Pa", "1.5 × 10⁴", "(7 + 2√(10))/3", "5/12", "1.1%", "192 g", "43.2",
    "£250", "c = 10 or c = -10", "f(x) ≥ 5", "2√(13)", "1202", "10", "15.375 m/s", "-9",
    "405", "360 cm²", "121°", "250 cm³", "60 cm²", "30 km", "12", "49", "8/15", "3/11", "84",
  ],
  physics: [
    "12 W", "10 V", "3 V, and it increases", "45 A", "£1.05", "1/3 A", "0.6 N",
    "It falls more slowly, because the induced current opposes the change producing it",
    "2400 N", "4.5 J", "3.6 J", "5 kg", "700 W", "54 m",
    "The resultant force is zero and the acceleration is zero", "92%", "1.06 × 10⁵ J", "200 kPa",
    "The fastest molecules escape, so the mean kinetic energy of those left falls", "220 kPa",
    "6 g/cm³", "1.25 J", "720 m/s", "300 m",
    "Infrared, visible, ultraviolet; ultraviolet can damage skin cells", "4.5 days",
    "Mass number 234, atomic number 92",
  ],
  maths2: [
    "-10", "44/9", "k = 1 or k = 9", "4/3 < x < 6", "41", "96/125", "1080", "3", "-1", "9/2", "4",
    "√(57) cm", "24/25", "27 cm²", "x = 3", "25", "3q - p", "x = 2, a minimum", "0", "31",
    "4 cm", "25/2", "32/3", "33", "3.28, an overestimate", "(4, 1)", "x = 1 and y = 2",
  ],
};

test("original challenge bank contains three complete ESAT-paced modules", () => {
  assert.equal(payload.version, "esat-atlas-original-challenge-a-v5");
  assert.equal(payload.questions.length, 81);
  assert.equal(new Set(payload.questions.map((question) => question.id)).size, 81);
  for (const module of modules) {
    assert.equal(payload.questions.filter((question) => question.targetModule === module).length, 27);
  }
});

test("original challenge bank rejects number-swapped template repetition", () => {
  assert.equal(new Set(payload.questions.map((question) => question.questionArchetype)).size, 81);
  assert.equal(new Set(payload.questions.map((question) => question.promptTemplateHash)).size, 81);
  assert.equal(payload.summary.distinctArchetypes, 81);
  assert.equal(payload.summary.distinctPromptTemplates, 81);
  assert.equal(payload.summary.numberSwapDuplicates, 0);
});

test("every module covers every top-level specification topic", () => {
  for (const module of modules) {
    const actual = new Set(
      payload.questions
        .filter((question) => question.targetModule === module)
        .map((question) => question.esatTopic),
    );
    assert.deepEqual(actual, expectedTopics[module]);
  }
  assert.equal(payload.summary.allTopLevelSpecificationTopicsCovered, true);
});

test("every authored answer resolves to one unique option and has a worked explanation", () => {
  for (const question of payload.questions) {
    assert.ok(question.answerOptions.includes(question.correctAnswer), question.id);
    assert.equal(question.optionText[question.correctAnswer], question.verifiedCorrectText, question.id);
    assert.equal(new Set(Object.values(question.optionText)).size, question.answerOptions.length, question.id);
    assert.ok(mathToPlainText(question.explanation).length >= 60, question.id);
    assert.equal(question.reviewRequired, false, question.id);
    assert.equal(question.excluded, false, question.id);
  }
});

test("the difficulty policy is enforced on every item", () => {
  assert.equal(payload.summary.optionsPerQuestion, 5);
  for (const question of payload.questions) {
    // Five options, as on a stretch ESAT item: guessing is worth 20%, not 25%.
    assert.equal(question.answerOptions.length, 5, question.id);
    assert.equal(question.difficulty, "stretch", question.id);
    // A one-line prompt cannot carry a multi-step question. Measured on the rendered
    // text, because markup inflates the raw string.
    assert.ok(mathToPlainText(question.questionText).length >= 45, `${question.id} prompt too short`);
  }
});

test("the answer key is not clustered on one option letter", () => {
  for (const module of modules) {
    const letters = payload.questions
      .filter((question) => question.targetModule === module)
      .map((question) => question.correctAnswer);
    for (const letter of ["A", "B", "C", "D", "E"]) {
      const share = letters.filter((item) => item === letter).length / letters.length;
      assert.ok(share <= 0.32, `${module}: ${letter} holds ${Math.round(share * 100)}% of the answers`);
    }
  }
});

test("all 81 generated answers match the manually reviewed answer-key snapshot", () => {
  for (const module of modules) {
    const actual = payload.questions
      .filter((question) => question.targetModule === module)
      .map((question) => mathToPlainText(question.verifiedCorrectText));
    assert.deepEqual(actual, reviewedAnswerKey[module], module);
  }
});

test("every authored string carries balanced, renderable maths markup", () => {
  const fields = (question: MockQuestion) => [question.questionText, question.explanation, ...Object.values(question.optionText)];
  for (const question of payload.questions) {
    for (const field of fields(question)) {
      // An odd number of unescaped delimiters means a `$` was left open.
      const escaped = (field.match(/\\\$/g) ?? []).length;
      const delimiters = field.split("$").length - 1 - escaped;
      assert.equal(delimiters % 2, 0, `${question.id}: unbalanced $ in "${field}"`);
      for (const segment of splitMath(field)) {
        if (!segment.math) continue;
        const opens = (segment.content.match(/\{/g) ?? []).length;
        const closes = (segment.content.match(/\}/g) ?? []).length;
        assert.equal(opens, closes, `${question.id}: unbalanced braces in "${segment.content}"`);
      }
      // Rendering must never leave raw markup visible to a candidate.
      const rendered = mathToPlainText(field);
      assert.doesNotMatch(rendered, /\\[A-Za-z]+/, `${question.id}: unrendered command in "${rendered}"`);
      assert.doesNotMatch(rendered, /[{}$]/, `${question.id}: markup leaked into "${rendered}"`);
    }
  }
});

test("every shipped figure exists, is paired with alt text and belongs to its question", async () => {
  const withDiagram = payload.questions.filter((question) => question.questionDiagram);
  assert.ok(withDiagram.length > 0, "expected the challenge bank to ship figures");
  assert.equal(payload.summary.questionsWithDiagrams, withDiagram.length);

  for (const question of payload.questions) {
    const diagram = question.questionDiagram ?? "";
    const alt = question.questionDiagramAlt ?? "";
    if (!diagram) {
      // Alt text without a figure would be read out with nothing to describe.
      assert.equal(alt, "", `${question.id}: alt text without a diagram`);
      continue;
    }
    // The figure is the only place some values appear, so the alt text must restate them.
    assert.ok(alt.length >= 40, `${question.id}: alt text too short to replace the figure`);
    // The filename encodes the question the figure was drawn for; a mismatch means the
    // learner is shown a figure for a different stem.
    const number = Number(question.id.slice(-2));
    assert.match(
      diagram,
      new RegExp(`q0?${number}[^0-9]`),
      `${question.id}: figure ${diagram} is named for a different question`,
    );
    await assert.doesNotReject(
      readFile(new URL(`../public/${diagram}`, import.meta.url)),
      `${question.id}: figure ${diagram} is missing from public/`,
    );
  }
});
