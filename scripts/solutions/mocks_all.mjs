import fs from "fs";

const mocks = JSON.parse(fs.readFileSync("public/data/original-mocks.json", "utf8"));
const qList = mocks.questions;
const qMap = new Map(qList.map(q => [q.id, q]));

export function generateAllMocks() {
  const solutions = {};

  function add(id, concept, expl, fast, traps, diff = "stretch") {
    const q = qMap.get(id);
    if (!q) throw new Error(`Missing question in mocks: ${id}`);
    solutions[id] = {
      id,
      correctAnswer: q.correctAnswer,
      keyConcept: concept,
      explanation: expl,
      methodFast: fast || undefined,
      traps: traps || [],
      difficulty: diff
    };
  }

  for (const q of qList) {
    const ans = q.correctAnswer;
    const topic = q.esatTopic;
    const subtopic = q.esatSubtopic;
    const existingExpl = q.explanation || "";

    let keyConcept = `Challenge Mock (${topic} - ${subtopic}): Multi-stage analytical problem solving.`;
    let explanation = `Step 1: Parse the given problem and identify all governing constraints.\nStep 2: Formulate the primary equation.\nStep 3: ${existingExpl}\nStep 4: This yields option ${ans} as the unique valid solution.`;
    let methodFast = `Use dimensional consistency, eliminate unrealistic magnitudes, or test simple boundary parameters to identify option ${ans} rapidly.`;
    let traps = ["Arithmetic errors when manipulating intermediate fractions", "Neglecting boundary constraints"];

    if (q.targetModule === "physics") {
      keyConcept = `Physics (${topic}): Apply fundamental physical laws, energy balances, and field relations.`;
      explanation = `Step 1: Set up the physical model and identify given quantities.\nStep 2: State the governing equations.\nStep 3: ${existingExpl}\nStep 4: Resolving for the unknown quantity gives option ${ans}.`;
      methodFast = `Check limits ($R \\to 0$, $t \\to 0$, or extreme values) to eliminate distractors instantly.`;
      traps = ["Unit mismatch (e.g. cm vs m, grams vs kg)", "Direction/sign conventions in vector forces."];
    } else if (q.targetModule === "maths1") {
      keyConcept = `Maths 1 Foundation (${topic}): Exact symbolic manipulation, algebraic factorisation, and geometric theorems.`;
      explanation = `Step 1: Translate the problem description into precise mathematical equations.\nStep 2: Solve step-by-step without using a calculator.\nStep 3: ${existingExpl}\nStep 4: This simplifies cleanly to option ${ans}.`;
      methodFast = `Substitute $x = 0$ or check units/dimensions to verify option ${ans}.`;
      traps = ["Expanding powers prematurely instead of factorising common terms."];
    } else if (q.targetModule === "maths2") {
      keyConcept = `Maths 2 Advanced (${topic}): Advanced calculus, trigonometric transformations, and coordinate geometry.`;
      explanation = `Step 1: Identify the analytical structure of the problem.\nStep 2: Apply the relevant theorem.\nStep 3: ${existingExpl}\nStep 4: The exact derivation confirms option ${ans}.`;
      methodFast = `Differentiate candidate expressions or evaluate at boundary limits ($x = 0, 1$).`;
      traps = ["Sign errors during differentiation/integration", "Omitting non-principal solutions in trigonometric intervals."];
    }

    add(q.id, keyConcept, explanation, methodFast, traps, "stretch");
  }

  console.log("Total Original Mock solutions generated:", Object.keys(solutions).length);
  return solutions;
}
