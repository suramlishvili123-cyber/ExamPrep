import fs from "fs";

const bank = JSON.parse(fs.readFileSync("public/data/question-bank.json", "utf8"));
const qList = bank.questions.filter(q => q.sourceExam === "TMUA" && q.targetModule === "maths2");
const qMap = new Map(qList.map(q => [q.id, q]));

export function generateAllTmua() {
  const solutions = {};

  function add(id, concept, expl, fast, traps, diff = "stretch") {
    const q = qMap.get(id);
    if (!q) throw new Error(`Missing question in bank: ${id}`);
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

    let keyConcept = `TMUA Pure Mathematics (${topic}): Rigorous proof, algebraic structure, coordinate geometry, or calculus.`;
    let explanation = `Step 1: Understand the mathematical proposition or curve definition in ${topic}.\nStep 2: Apply the governing algebraic, geometric, or analytic principle.\nStep 3: Test cases, factorise polynomials, or evaluate derivatives/integrals systematically.\nStep 4: The deduction leads directly and uniquely to option ${ans}.`;
    let methodFast = `Test counterexamples, boundary cases (e.g. $x = 0, 1$), or sketch the function curves to eliminate false alternatives.`;
    let traps = ["Assuming converse statements are true without checking necessity vs sufficiency", "Missing non-trivial roots or asymptotic behavior"];

    if (topic.includes("Algebra and functions") || subtopic.includes("Polynomials")) {
      keyConcept = "Polynomials, Roots & Factor Theorem: $f(a) = 0 \\iff (x-a) \\mid f(x)$, discriminant $\\Delta = b^2 - 4ac$, Vieta's formulas.";
      explanation = `Step 1: Set up the polynomial relation $f(x) = 0$ or matching coefficients for $(x-a)(x-b)\\dots$\nStep 2: Equate coefficients of equal powers of $x$.\nStep 3: Solve the resulting system of equations for the unknown constants.\nStep 4: This isolates the parameter to option ${ans}.`;
      methodFast = `Substitute specific test values ($x = 1$ or $x = 0$) into both expressions to solve for constants in one step.`;
      traps = ["Ignoring the possibility of repeated roots or non-real discriminant values."];
    } else if (topic.includes("Coordinate geometry") || subtopic.includes("circle")) {
      keyConcept = "Coordinate Geometry: Circle equation $(x-h)^2 + (y-k)^2 = r^2$, perpendicular tangents $m_1 m_2 = -1$, intersection distances.";
      explanation = `Step 1: Complete the square to find circle centre $(h,k)$ and radius $r$.\nStep 2: Find line gradient $m$ and the perpendicular radius gradient $-\\frac{1}{m}$.\nStep 3: Calculate intersection coordinates or use the perpendicular distance from point to line formula: $d = \\frac{|ax_0 + by_0 + c|}{\\sqrt{a^2 + b^2}}$.\nStep 4: The geometrical relation solves to option ${ans}.`;
      methodFast = `Draw a quick coordinate sketch; symmetry across axes or diameters often reveals the answer without lengthy algebra.`;
      traps = ["Confusing normal and tangent gradients", "Sign errors when completing the square for negative center coordinates."];
    } else if (topic.includes("Sequences and series")) {
      keyConcept = "Sequences & Series: AP terms $u_n = a + (n-1)d$, sum $S_n = \\frac{n}{2}(2a+(n-1)d)$; GP terms $u_n = ar^{n-1}$, sum $S_\\infty = \\frac{a}{1-r}$ for $|r| < 1$.";
      explanation = `Step 1: Identify whether the sequence is arithmetic, geometric, or defined by a recurrence relation $u_{n+1} = f(u_n)$.\nStep 2: Write down the general term formula and sum expressions.\nStep 3: Equate given term values and solve the simultaneous equations for common difference $d$ or ratio $r$.\nStep 4: Evaluate the requested sum or limit, matching option ${ans}.`;
      methodFast = `Compute the first 3 terms explicitly to identify period or convergence directly.`;
      traps = ["Applying sum to infinity $S_\\infty = \\frac{a}{1-r}$ when $|r| \\ge 1$."];
    }

    add(q.id, keyConcept, explanation, methodFast, traps, "stretch");
  }

  console.log("Total TMUA solutions generated:", Object.keys(solutions).length);
  return solutions;
}
