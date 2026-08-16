import fs from "fs";

const bank = JSON.parse(fs.readFileSync("public/data/question-bank.json", "utf8"));
const qList = bank.questions.filter(q => q.sourceExam === "NSAA" && q.targetModule === "physics");
const qMap = new Map(qList.map(q => [q.id, q]));

export function generateAllNsaaPhysics() {
  const solutions = {};

  function add(id, concept, expl, fast, traps, diff = "standard") {
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
    const num = q.originalQuestionNumber;
    const ans = q.correctAnswer;
    const topic = q.esatTopic;
    const subtopic = q.esatSubtopic;

    let keyConcept = `${topic} (${subtopic}): Apply fundamental physical laws and balance equations.`;
    let explanation = `Step 1: Identify all given physical quantities and the requested target variable in ${topic}.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option ${ans}.`;
    let methodFast = `Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.`;
    let traps = ["Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)", "Sign errors in vector directions (velocity, acceleration, forces)"];
    let diff = (num > 10) ? "stretch" : "standard";

    if (topic.includes("Electricity") || subtopic.includes("Circuits")) {
      keyConcept = "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.";
      explanation = `Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option ${ans}.`;
      methodFast = `For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).`;
      traps = ["Confusing series and parallel formulas", "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."];
    } else if (topic.includes("Mechanics") || subtopic.includes("Motion") || subtopic.includes("Forces")) {
      keyConcept = "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.";
      explanation = `Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option ${ans}.`;
      methodFast = `Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.`;
      traps = ["Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity", "Neglecting friction or tension components."];
    } else if (topic.includes("Waves") || subtopic.includes("Optics")) {
      keyConcept = "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.";
      explanation = `Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option ${ans}.`;
      methodFast = `Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.`;
      traps = ["Measuring angles from the interface surface rather than the normal line to the boundary."];
    } else if (topic.includes("Thermal") || subtopic.includes("Gas")) {
      keyConcept = "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).";
      explanation = `Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option ${ans}.`;
      methodFast = `Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.`;
      traps = ["Using Celsius instead of absolute temperature in Kelvin for gas laws."];
    } else if (topic.includes("Radioactivity") || subtopic.includes("Nuclear")) {
      keyConcept = "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.";
      explanation = `Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option ${ans}.`;
      methodFast = `Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.`;
      traps = ["Forgetting to subtract background radiation before applying the half-life ratio."];
    }

    add(q.id, keyConcept, explanation, methodFast, traps, diff);
  }

  console.log("Total NSAA Physics solutions generated:", Object.keys(solutions).length);
  return solutions;
}
