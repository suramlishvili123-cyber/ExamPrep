import type { SolutionMap } from "./types";

export const NSAA_PHYSICS_SOLUTIONS: SolutionMap = {
  "nsaa-2017-s1-q19": {
    "id": "nsaa-2017-s1-q19",
    "correctAnswer": "B",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option B.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q20": {
    "id": "nsaa-2017-s1-q20",
    "correctAnswer": "G",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option G.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q21": {
    "id": "nsaa-2017-s1-q21",
    "correctAnswer": "E",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option E.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q22": {
    "id": "nsaa-2017-s1-q22",
    "correctAnswer": "E",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option E.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q23": {
    "id": "nsaa-2017-s1-q23",
    "correctAnswer": "D",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option D.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q24": {
    "id": "nsaa-2017-s1-q24",
    "correctAnswer": "D",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option D.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q25": {
    "id": "nsaa-2017-s1-q25",
    "correctAnswer": "B",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option B.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q26": {
    "id": "nsaa-2017-s1-q26",
    "correctAnswer": "F",
    "keyConcept": "Magnetism (Magnetic fields, motors and induction): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Magnetism.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option F.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q27": {
    "id": "nsaa-2017-s1-q27",
    "correctAnswer": "A",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option A.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q28": {
    "id": "nsaa-2017-s1-q28",
    "correctAnswer": "A",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option A.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q29": {
    "id": "nsaa-2017-s1-q29",
    "correctAnswer": "E",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option E.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q30": {
    "id": "nsaa-2017-s1-q30",
    "correctAnswer": "C",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option C.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q31": {
    "id": "nsaa-2017-s1-q31",
    "correctAnswer": "C",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option C.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q32": {
    "id": "nsaa-2017-s1-q32",
    "correctAnswer": "C",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option C.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q33": {
    "id": "nsaa-2017-s1-q33",
    "correctAnswer": "C",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option C.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q34": {
    "id": "nsaa-2017-s1-q34",
    "correctAnswer": "D",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option D.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q35": {
    "id": "nsaa-2017-s1-q35",
    "correctAnswer": "E",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option E.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2017-s1-q36": {
    "id": "nsaa-2017-s1-q36",
    "correctAnswer": "E",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option E.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q19": {
    "id": "nsaa-2018-s1-q19",
    "correctAnswer": "B",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option B.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q20": {
    "id": "nsaa-2018-s1-q20",
    "correctAnswer": "B",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option B.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q21": {
    "id": "nsaa-2018-s1-q21",
    "correctAnswer": "G",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option G.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q22": {
    "id": "nsaa-2018-s1-q22",
    "correctAnswer": "E",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option E.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q23": {
    "id": "nsaa-2018-s1-q23",
    "correctAnswer": "E",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option E.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q24": {
    "id": "nsaa-2018-s1-q24",
    "correctAnswer": "C",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option C.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q25": {
    "id": "nsaa-2018-s1-q25",
    "correctAnswer": "C",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option C.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q26": {
    "id": "nsaa-2018-s1-q26",
    "correctAnswer": "A",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option A.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q27": {
    "id": "nsaa-2018-s1-q27",
    "correctAnswer": "A",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option A.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q28": {
    "id": "nsaa-2018-s1-q28",
    "correctAnswer": "C",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option C.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q29": {
    "id": "nsaa-2018-s1-q29",
    "correctAnswer": "E",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option E.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q30": {
    "id": "nsaa-2018-s1-q30",
    "correctAnswer": "C",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option C.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q31": {
    "id": "nsaa-2018-s1-q31",
    "correctAnswer": "B",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option B.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q32": {
    "id": "nsaa-2018-s1-q32",
    "correctAnswer": "E",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option E.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q33": {
    "id": "nsaa-2018-s1-q33",
    "correctAnswer": "H",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option H.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q34": {
    "id": "nsaa-2018-s1-q34",
    "correctAnswer": "C",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option C.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q35": {
    "id": "nsaa-2018-s1-q35",
    "correctAnswer": "E",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option E.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2018-s1-q36": {
    "id": "nsaa-2018-s1-q36",
    "correctAnswer": "A",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option A.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q19": {
    "id": "nsaa-2019-s1-q19",
    "correctAnswer": "B",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option B.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q20": {
    "id": "nsaa-2019-s1-q20",
    "correctAnswer": "E",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option E.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q21": {
    "id": "nsaa-2019-s1-q21",
    "correctAnswer": "F",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option F.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q22": {
    "id": "nsaa-2019-s1-q22",
    "correctAnswer": "A",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option A.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q23": {
    "id": "nsaa-2019-s1-q23",
    "correctAnswer": "C",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option C.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q24": {
    "id": "nsaa-2019-s1-q24",
    "correctAnswer": "D",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option D.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q25": {
    "id": "nsaa-2019-s1-q25",
    "correctAnswer": "A",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option A.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q26": {
    "id": "nsaa-2019-s1-q26",
    "correctAnswer": "A",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option A.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q27": {
    "id": "nsaa-2019-s1-q27",
    "correctAnswer": "E",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option E.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q28": {
    "id": "nsaa-2019-s1-q28",
    "correctAnswer": "F",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option F.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q29": {
    "id": "nsaa-2019-s1-q29",
    "correctAnswer": "C",
    "keyConcept": "Magnetism (Magnetic fields, motors and induction): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Magnetism.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option C.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q30": {
    "id": "nsaa-2019-s1-q30",
    "correctAnswer": "C",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option C.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q31": {
    "id": "nsaa-2019-s1-q31",
    "correctAnswer": "C",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option C.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q32": {
    "id": "nsaa-2019-s1-q32",
    "correctAnswer": "E",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option E.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q33": {
    "id": "nsaa-2019-s1-q33",
    "correctAnswer": "F",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option F.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q34": {
    "id": "nsaa-2019-s1-q34",
    "correctAnswer": "D",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option D.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q35": {
    "id": "nsaa-2019-s1-q35",
    "correctAnswer": "B",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option B.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2019-s1-q36": {
    "id": "nsaa-2019-s1-q36",
    "correctAnswer": "B",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option B.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q21": {
    "id": "nsaa-2020-s1-q21",
    "correctAnswer": "C",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option C.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q22": {
    "id": "nsaa-2020-s1-q22",
    "correctAnswer": "B",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option B.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q23": {
    "id": "nsaa-2020-s1-q23",
    "correctAnswer": "F",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option F.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q24": {
    "id": "nsaa-2020-s1-q24",
    "correctAnswer": "A",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option A.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q25": {
    "id": "nsaa-2020-s1-q25",
    "correctAnswer": "A",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option A.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q26": {
    "id": "nsaa-2020-s1-q26",
    "correctAnswer": "D",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option D.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q27": {
    "id": "nsaa-2020-s1-q27",
    "correctAnswer": "E",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option E.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q28": {
    "id": "nsaa-2020-s1-q28",
    "correctAnswer": "D",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option D.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q29": {
    "id": "nsaa-2020-s1-q29",
    "correctAnswer": "C",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option C.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q30": {
    "id": "nsaa-2020-s1-q30",
    "correctAnswer": "F",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option F.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q31": {
    "id": "nsaa-2020-s1-q31",
    "correctAnswer": "B",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option B.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q32": {
    "id": "nsaa-2020-s1-q32",
    "correctAnswer": "C",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option C.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q33": {
    "id": "nsaa-2020-s1-q33",
    "correctAnswer": "D",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option D.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q34": {
    "id": "nsaa-2020-s1-q34",
    "correctAnswer": "E",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option E.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q35": {
    "id": "nsaa-2020-s1-q35",
    "correctAnswer": "C",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option C.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q36": {
    "id": "nsaa-2020-s1-q36",
    "correctAnswer": "H",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option H.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q37": {
    "id": "nsaa-2020-s1-q37",
    "correctAnswer": "G",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option G.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q38": {
    "id": "nsaa-2020-s1-q38",
    "correctAnswer": "D",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option D.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q39": {
    "id": "nsaa-2020-s1-q39",
    "correctAnswer": "G",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option G.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2020-s1-q40": {
    "id": "nsaa-2020-s1-q40",
    "correctAnswer": "A",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option A.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q21": {
    "id": "nsaa-2021-s1-q21",
    "correctAnswer": "B",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option B.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q22": {
    "id": "nsaa-2021-s1-q22",
    "correctAnswer": "E",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option E.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q23": {
    "id": "nsaa-2021-s1-q23",
    "correctAnswer": "F",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option F.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q24": {
    "id": "nsaa-2021-s1-q24",
    "correctAnswer": "A",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option A.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q25": {
    "id": "nsaa-2021-s1-q25",
    "correctAnswer": "G",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option G.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q26": {
    "id": "nsaa-2021-s1-q26",
    "correctAnswer": "F",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option F.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q27": {
    "id": "nsaa-2021-s1-q27",
    "correctAnswer": "C",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option C.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q28": {
    "id": "nsaa-2021-s1-q28",
    "correctAnswer": "D",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option D.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q29": {
    "id": "nsaa-2021-s1-q29",
    "correctAnswer": "E",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option E.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q30": {
    "id": "nsaa-2021-s1-q30",
    "correctAnswer": "H",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option H.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q31": {
    "id": "nsaa-2021-s1-q31",
    "correctAnswer": "B",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option B.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q32": {
    "id": "nsaa-2021-s1-q32",
    "correctAnswer": "G",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option G.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q33": {
    "id": "nsaa-2021-s1-q33",
    "correctAnswer": "C",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option C.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q34": {
    "id": "nsaa-2021-s1-q34",
    "correctAnswer": "E",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option E.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q35": {
    "id": "nsaa-2021-s1-q35",
    "correctAnswer": "D",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option D.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q36": {
    "id": "nsaa-2021-s1-q36",
    "correctAnswer": "B",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option B.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q37": {
    "id": "nsaa-2021-s1-q37",
    "correctAnswer": "C",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option C.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q38": {
    "id": "nsaa-2021-s1-q38",
    "correctAnswer": "D",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option D.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q39": {
    "id": "nsaa-2021-s1-q39",
    "correctAnswer": "G",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option G.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2021-s1-q40": {
    "id": "nsaa-2021-s1-q40",
    "correctAnswer": "E",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option E.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q21": {
    "id": "nsaa-2022-s1-q21",
    "correctAnswer": "A",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option A.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q22": {
    "id": "nsaa-2022-s1-q22",
    "correctAnswer": "C",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option C.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q23": {
    "id": "nsaa-2022-s1-q23",
    "correctAnswer": "E",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option E.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q24": {
    "id": "nsaa-2022-s1-q24",
    "correctAnswer": "G",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option G.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q25": {
    "id": "nsaa-2022-s1-q25",
    "correctAnswer": "E",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option E.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q26": {
    "id": "nsaa-2022-s1-q26",
    "correctAnswer": "B",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option B.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q27": {
    "id": "nsaa-2022-s1-q27",
    "correctAnswer": "A",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option A.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q28": {
    "id": "nsaa-2022-s1-q28",
    "correctAnswer": "G",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option G.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q29": {
    "id": "nsaa-2022-s1-q29",
    "correctAnswer": "B",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option B.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q30": {
    "id": "nsaa-2022-s1-q30",
    "correctAnswer": "D",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option D.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q31": {
    "id": "nsaa-2022-s1-q31",
    "correctAnswer": "E",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option E.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q32": {
    "id": "nsaa-2022-s1-q32",
    "correctAnswer": "C",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option C.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q33": {
    "id": "nsaa-2022-s1-q33",
    "correctAnswer": "G",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option G.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q34": {
    "id": "nsaa-2022-s1-q34",
    "correctAnswer": "C",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option C.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q35": {
    "id": "nsaa-2022-s1-q35",
    "correctAnswer": "D",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option D.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q36": {
    "id": "nsaa-2022-s1-q36",
    "correctAnswer": "D",
    "keyConcept": "Magnetism (Magnetic fields, motors and induction): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Magnetism.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option D.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q37": {
    "id": "nsaa-2022-s1-q37",
    "correctAnswer": "F",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option F.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q38": {
    "id": "nsaa-2022-s1-q38",
    "correctAnswer": "E",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option E.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q39": {
    "id": "nsaa-2022-s1-q39",
    "correctAnswer": "E",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option E.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2022-s1-q40": {
    "id": "nsaa-2022-s1-q40",
    "correctAnswer": "A",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option A.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q21": {
    "id": "nsaa-2023-s1-q21",
    "correctAnswer": "G",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option G.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q22": {
    "id": "nsaa-2023-s1-q22",
    "correctAnswer": "F",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option F.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q23": {
    "id": "nsaa-2023-s1-q23",
    "correctAnswer": "D",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option D.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q24": {
    "id": "nsaa-2023-s1-q24",
    "correctAnswer": "F",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option F.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q25": {
    "id": "nsaa-2023-s1-q25",
    "correctAnswer": "B",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option B.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q26": {
    "id": "nsaa-2023-s1-q26",
    "correctAnswer": "B",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option B.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q27": {
    "id": "nsaa-2023-s1-q27",
    "correctAnswer": "E",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option E.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q28": {
    "id": "nsaa-2023-s1-q28",
    "correctAnswer": "B",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option B.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q29": {
    "id": "nsaa-2023-s1-q29",
    "correctAnswer": "E",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option E.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q30": {
    "id": "nsaa-2023-s1-q30",
    "correctAnswer": "E",
    "keyConcept": "Nuclear Physics: Half-life decay $N(t) = N_0 \\left(\\frac{1}{2}\\right)^{t/t_{1/2}}$, conservation of nucleon and proton numbers.",
    "explanation": "Step 1: Determine the number of elapsed half-lives $n = \\frac{t}{t_{1/2}}$.\nStep 2: Calculate remaining fraction $(1/2)^n$ or decayed fraction $1 - (1/2)^n$.\nStep 3: Account for background count rate by subtracting background before scaling, then adding background back if total rate is required.\nStep 4: The calculated activity or time corresponds to option E.",
    "methodFast": "Halve the count repeatedly: $100\\% \\to 50\\% \\to 25\\% \\to 12.5\\% \\to 6.25\\%$. Each step is one half-life.",
    "traps": [
      "Forgetting to subtract background radiation before applying the half-life ratio."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q31": {
    "id": "nsaa-2023-s1-q31",
    "correctAnswer": "A",
    "keyConcept": "Newtonian Mechanics & Kinematics: SUVAT equations, $F_{\\text{net}} = ma$, momentum conservation $p = mv$, energy conservation.",
    "explanation": "Step 1: Draw a free-body diagram and resolve all forces parallel and perpendicular to the direction of motion.\nStep 2: Apply Newton's Second Law $F_{\\text{net}} = ma$ or conservation of energy $E_k + E_p = \\text{constant}$.\nStep 3: Integrate with SUVAT kinematics ($v^2 = u^2 + 2as$, $s = ut + \\frac{1}{2}at^2$) to eliminate time or distance.\nStep 4: Solve for the requested kinematic or dynamic quantity, matching option A.",
    "methodFast": "Use energy conservation directly ($\\Delta E_k = W_{\\text{net}}$) to bypass calculating intermediate accelerations and times.",
    "traps": [
      "Mixing up signs of $g = 9.8$ or $10\\text{ m/s}^2$ with upward initial velocity",
      "Neglecting friction or tension components."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q32": {
    "id": "nsaa-2023-s1-q32",
    "correctAnswer": "A",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option A.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q33": {
    "id": "nsaa-2023-s1-q33",
    "correctAnswer": "B",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option B.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q34": {
    "id": "nsaa-2023-s1-q34",
    "correctAnswer": "C",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option C.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q35": {
    "id": "nsaa-2023-s1-q35",
    "correctAnswer": "E",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option E.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q36": {
    "id": "nsaa-2023-s1-q36",
    "correctAnswer": "D",
    "keyConcept": "Wave Mechanics & Optics: Wave equation $v = f\\lambda$, Snell's law $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$, critical angle $\\sin c = 1/n$.",
    "explanation": "Step 1: Identify wave properties (frequency $f$, wavelength $\\lambda$, speed $v$, refractive index $n$).\nStep 2: Note that frequency $f$ remains invariant across medium boundaries, while speed and wavelength change proportionally ($v \\propto \\lambda$).\nStep 3: Apply Snell's Law or path difference conditions ($d \\sin\\theta = m\\lambda$) as appropriate.\nStep 4: Calculate the required angle, speed, or frequency, matching option D.",
    "methodFast": "Frequency never changes when a wave enters a new medium. Speed and wavelength scale together: $\\frac{v_1}{v_2} = \\frac{\\lambda_1}{\\lambda_2} = \\frac{n_2}{n_1}$.",
    "traps": [
      "Measuring angles from the interface surface rather than the normal line to the boundary."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q37": {
    "id": "nsaa-2023-s1-q37",
    "correctAnswer": "H",
    "keyConcept": "Magnetism (Magnetic fields, motors and induction): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Magnetism.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option H.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q38": {
    "id": "nsaa-2023-s1-q38",
    "correctAnswer": "B",
    "keyConcept": "Ohm's Law and Circuit Analysis: $V = IR$, $P = IV = I^2 R = \\frac{V^2}{R}$, Kirchhoff's current and voltage laws.",
    "explanation": "Step 1: Simplify resistor combinations (series $R_s = R_1 + R_2$, parallel $\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}$).\nStep 2: Determine total equivalent circuit resistance and total supply current $I_{\\text{total}} = \\frac{V}{R_{\\text{total}}}$.\nStep 3: Apply potential divider or current divider principles to the branch of interest.\nStep 4: Calculate the required voltage, current, or power, yielding option B.",
    "methodFast": "For equal parallel branches, current splits equally and equivalent resistance is halved. Check limiting cases ($R \\to 0$ or $R \\to \\infty$).",
    "traps": [
      "Confusing series and parallel formulas",
      "Forgetting internal resistance in $\\mathcal{E} = I(R + r)$."
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q39": {
    "id": "nsaa-2023-s1-q39",
    "correctAnswer": "C",
    "keyConcept": "Matter (Density, pressure and material behaviour): Apply fundamental physical laws and balance equations.",
    "explanation": "Step 1: Identify all given physical quantities and the requested target variable in Matter.\nStep 2: State the governing physics equations and boundary conditions.\nStep 3: Solve algebraically for the target quantity and substitute the parameters step-by-step.\nStep 4: The calculation resolves directly to option C.",
    "methodFast": "Use dimensional analysis or ratio scaling to eliminate physically inconsistent options quickly.",
    "traps": [
      "Unit inconsistencies (e.g. grams vs kilograms, centimetres vs metres)",
      "Sign errors in vector directions (velocity, acceleration, forces)"
    ],
    "difficulty": "stretch"
  },
  "nsaa-2023-s1-q40": {
    "id": "nsaa-2023-s1-q40",
    "correctAnswer": "A",
    "keyConcept": "Thermodynamics & Gas Laws: Specific heat $Q = mc\\Delta T$, latent heat $Q = mL$, ideal gas law $pV = nRT$ (or $\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}$).",
    "explanation": "Step 1: Express thermal energy balance: heat gained by cold body equals heat lost by warm body (plus latent heat during phase changes).\nStep 2: Ensure temperatures are converted to Kelvin ($T(\\text{K}) = \\theta(^\\circ\\text{C}) + 273$) when using gas laws.\nStep 3: Solve the heat transfer or gas equation for the unknown final temperature or pressure.\nStep 4: The result matches option A.",
    "methodFast": "Check thermal equilibrium limits: the final equilibrium temperature must lie strictly between the initial temperatures of the mixed substances.",
    "traps": [
      "Using Celsius instead of absolute temperature in Kelvin for gas laws."
    ],
    "difficulty": "stretch"
  }
};
