import type { ModuleId, Question } from "./core";

export interface WorkedExample {
  prompt: string;
  steps: string[];
  answer: string;
}

export interface TechniqueGuide {
  id: string;
  module: ModuleId;
  topic: string;
  title: string;
  principle: string;
  bestMethod: string[];
  fastMethod: string[];
  example: WorkedExample;
  traps: string[];
  keywords: string[];
}

export interface ExamTactic {
  id: string;
  title: string;
  summary: string;
  useWhen: string;
  method: string[];
  caution: string;
}

/**
 * Each archive taxonomy group has one reviewed guide. These are deliberately
 * representative examples, not claims about the derivation of a source item.
 * Exact authored solutions and official TMUA solution pages are handled by the UI.
 */
export const TECHNIQUE_GUIDES: TechniqueGuide[] = [
  {
    id: "m1-number",
    module: "maths1",
    topic: "Number",
    title: "Separate structure from arithmetic",
    principle: "Keep powers, signs and exact values separate until the final line. This reduces calculator-free arithmetic and exposes impossible options early.",
    bestMethod: [
      "Rewrite roots, indices or standard-form terms in a common form.",
      "Simplify coefficients and powers independently.",
      "Check the sign and order of magnitude before matching an option.",
    ],
    fastMethod: [
      "Estimate the power of ten first; eliminate options with the wrong scale.",
      "For surds, square a positive proposed value only when that is quicker than full simplification.",
    ],
    example: {
      prompt: "Evaluate $\\frac{(3\\times10^6)(4\\times10^{-3})}{6\\times10^2}$.",
      steps: [
        "Coefficients: $3\\times4\\div6=2$.",
        "Powers: $10^{6-3-2}=10^1$.",
        "Combine only now: $2\\times10^1$.",
      ],
      answer: "$20$",
    },
    traps: ["Adding powers when dividing", "Turning an exact surd into a rough decimal too early"],
    keywords: ["surds", "indices", "standard form", "bounds", "recurring decimals"],
  },
  {
    id: "m1-units",
    module: "maths1",
    topic: "Units",
    title: "Convert with unit factors, not memory alone",
    principle: "Write conversions as fractions equal to one so unwanted units visibly cancel, especially for squared and cubed units.",
    bestMethod: [
      "Write the required final unit beside the target quantity.",
      "Multiply by conversion factors and cancel units before calculating.",
      "For area and volume, square or cube the length conversion as well.",
    ],
    fastMethod: [
      "For speed, $\\text{km/h}\\to\\text{m/s}$ is division by $3.6$.",
      "Use dimensions to reject options: pressure must have units $\\text{N/m}^2$ and power $\\text{J/s}$.",
    ],
    example: {
      prompt: "Convert $72\\text{ km/h}$ to $\\text{m/s}$.",
      steps: [
        "$72\\times\\frac{1000\\text{ m}}{1\\text{ km}}\\times\\frac{1\\text{ h}}{3600\\text{ s}}$.",
        "Cancel $\\text{km}$ and $\\text{h}$, then simplify $72/3.6$.",
      ],
      answer: "$20\\text{ m/s}$",
    },
    traps: ["Using a length conversion unchanged for area", "Mixing centimetres with metres inside one formula"],
    keywords: ["conversion", "compound units", "dimensions", "pressure"],
  },
  {
    id: "m1-ratio",
    module: "maths1",
    topic: "Ratio and proportion",
    title: "Use multipliers and a single scale variable",
    principle: "Represent ratios with one variable and percentage changes with multipliers. Both preserve the structure of the question.",
    bestMethod: [
      "For $a:b$, write the amounts as $ak$ and $bk$.",
      "For a percentage change of $p\\%$, multiply by $1\\pm p/100$.",
      "Reverse a change by dividing by its multiplier, never by applying the opposite percentage.",
    ],
    fastMethod: [
      "Cancel common ratio factors before substituting numbers.",
      "Chain successive percentage changes as one product and compare it with $1$.",
    ],
    example: {
      prompt: "A price rises by $20\\%$ and then falls by $20\\%$. What is the overall change?",
      steps: [
        "The combined multiplier is $1.20\\times0.80=0.96$.",
        "$0.96$ is $4\\%$ below $1$.",
      ],
      answer: "$4\\%$ decrease",
    },
    traps: ["Assuming equal percentage changes cancel", "Adding percentage changes when the base changes"],
    keywords: ["ratio", "proportion", "percentage", "variation", "scale"],
  },
  {
    id: "m1-algebra",
    module: "maths1",
    topic: "Algebra",
    title: "Preserve equivalence, then exploit the options",
    principle: "Simplify before expanding and keep an equation balanced. In multiple choice, substitution can verify a candidate faster than a full symbolic solution.",
    bestMethod: [
      "State restrictions first when fractions or roots are present.",
      "Collect like terms or factor before reaching for the quadratic formula.",
      "Substitute the result back into the original expression, not only a rearranged line.",
    ],
    fastMethod: [
      "Back-substitute simple answer choices when solving forward would be long.",
      "For a sequence, inspect first and second differences before deriving a formula.",
    ],
    example: {
      prompt: "Solve $\\frac{3x-1}{x+2}=4$.",
      steps: [
        "Restriction: $x\\ne-2$.",
        "$3x-1=4x+8$, so $x=-9$.",
        "Check: $(-28)/(-7)=4$.",
      ],
      answer: "$x=-9$",
    },
    traps: ["Cancelling across addition", "Keeping a root that is excluded from the original expression"],
    keywords: ["equations", "sequences", "quadratic", "functions", "inequalities"],
  },
  {
    id: "m1-geometry",
    module: "maths1",
    topic: "Geometry",
    title: "Mark the invariant before calculating",
    principle: "Add known equal lengths, equal angles, right angles and parallel lines to the diagram first; the shortest theorem often becomes visible.",
    bestMethod: [
      "Translate the diagram into facts and mark the requested length or angle.",
      "Choose one governing relationship: similarity, Pythagoras, trigonometry, circle facts, or area/volume scaling.",
      "Check whether the result is geometrically possible before selecting it.",
    ],
    fastMethod: [
      "Look for $3$-$4$-$5$, $5$-$12$-$13$ and $1$-$1$-$\\sqrt2$ triangles.",
      "Similarity: length scales by $k$, area by $k^2$, volume by $k^3$.",
    ],
    example: {
      prompt: "Similar solids have surface-area ratio $9:25$. If the smaller volume is $54$, find the larger volume.",
      steps: [
        "Length ratio is $\\sqrt9:\\sqrt{25}=3:5$.",
        "Volume ratio is $3^3:5^3=27:125$.",
        "Larger volume $=54\\times125/27$.",
      ],
      answer: "$250$",
    },
    traps: ["Using an area ratio as a length ratio", "Reading a diagram as if it were drawn to scale"],
    keywords: ["angles", "circles", "trigonometry", "area", "volume", "similarity"],
  },
  {
    id: "m1-statistics",
    module: "maths1",
    topic: "Statistics",
    title: "Work with totals, not repeated averages",
    principle: "Convert a mean into a total immediately. For grouped data, remember that midpoint calculations are estimates.",
    bestMethod: [
      "Identify whether the question asks for centre, spread or a comparison.",
      "Use $\\text{total}=\\text{mean}\\times\\text{frequency}$.",
      "Order raw data before locating medians or quartiles.",
    ],
    fastMethod: [
      "Use deviations from a convenient centre to calculate a mean mentally.",
      "For a combined mean, add group totals and divide once.",
    ],
    example: {
      prompt: "Eight values have mean $12$. A ninth value of $21$ is added. Find the new mean.",
      steps: [
        "Original total $=8\\times12=96$.",
        "New total $=96+21=117$.",
        "New mean $=117/9$.",
      ],
      answer: "$13$",
    },
    traps: ["Averaging two means without weighting", "Treating a grouped-data estimate as exact"],
    keywords: ["mean", "median", "quartile", "spread", "grouped data"],
  },
  {
    id: "m1-probability",
    module: "maths1",
    topic: "Probability",
    title: "Count the complement or build a clean sample space",
    principle: "Use the route with fewer cases. ‘At least one’ is usually fastest through its complement; selection without replacement needs changing denominators.",
    bestMethod: [
      "Define the event precisely and decide whether order matters.",
      "Use a tree, table or combinations so every outcome is counted once.",
      "Check that the final probability lies between $0$ and $1$.",
    ],
    fastMethod: [
      "Use $P(\\text{at least one})=1-P(\\text{none})$.",
      "If all selections are equally likely, count favourable selections over total selections.",
    ],
    example: {
      prompt: "A fair die is rolled twice. Find the probability of at least one six.",
      steps: [
        "$P(\\text{no six})=(5/6)^2=25/36$.",
        "$P(\\text{at least one six})=1-25/36$.",
      ],
      answer: "$11/36$",
    },
    traps: ["Adding overlapping events without subtracting the overlap", "Keeping the denominator fixed without replacement"],
    keywords: ["probability", "counting", "combinations", "conditional", "complement"],
  },
  {
    id: "m2-algebra",
    module: "maths2",
    topic: "Algebra and functions",
    title: "Use the theorem that targets the requested fact",
    principle: "Factor, remainder, discriminant and function questions rarely require a complete expansion. Use the theorem that returns exactly what is asked.",
    bestMethod: [
      "Identify the target: root, remainder, number of roots, inverse, or range.",
      "Apply the matching result, such as $f(a)=0$ for factor $(x-a)$ or $b^2-4ac$ for root count.",
      "Check domain and sign conditions at the end.",
    ],
    fastMethod: [
      "For a remainder on division by $x-a$, calculate $f(a)$ instead of dividing.",
      "For a repeated root or tangency, set the discriminant to zero.",
    ],
    example: {
      prompt: "Find the remainder when $2x^3-3x+5$ is divided by $x-2$.",
      steps: [
        "By the remainder theorem, the remainder is $f(2)$.",
        "$f(2)=2(8)-3(2)+5=16-6+5$.",
      ],
      answer: "$15$",
    },
    traps: ["Using $f(-a)$ for divisor $x-a$", "Ignoring domain restrictions when finding an inverse"],
    keywords: ["polynomial", "factor theorem", "remainder", "proof", "functions", "discriminant"],
  },
  {
    id: "m2-coordinate",
    module: "maths2",
    topic: "Coordinate geometry",
    title: "Translate geometry into one equation",
    principle: "Coordinates turn perpendicularity, distance and circles into algebra. State the geometric condition before manipulating it.",
    bestMethod: [
      "Extract centres, radii, gradients or midpoints from the given form.",
      "Write the one geometric condition required.",
      "Substitute and simplify, keeping exact roots where possible.",
    ],
    fastMethod: [
      "Perpendicular gradients satisfy $m_1m_2=-1$ when both are finite.",
      "Complete the square only for the coordinates actually needed.",
    ],
    example: {
      prompt: "Find the centre and radius of $x^2+y^2-6x+4y-12=0$.",
      steps: [
        "Complete squares: $(x-3)^2-9+(y+2)^2-4=12$.",
        "So $(x-3)^2+(y+2)^2=25$.",
      ],
      answer: "Centre $(3,-2)$, radius $5$",
    },
    traps: ["Losing the sign of a circle centre", "Assuming perpendicular gradients are negatives rather than negative reciprocals"],
    keywords: ["lines", "circles", "gradient", "distance", "coordinate plane"],
  },
  {
    id: "m2-differentiation",
    module: "maths2",
    topic: "Differentiation",
    title: "Differentiate only as far as the decision requires",
    principle: "A derivative answers a rate or gradient question; its zeros give candidates, while its sign or the second derivative classifies them.",
    bestMethod: [
      "Define the quantity to optimise as a function of one variable.",
      "Differentiate, solve $f'(x)=0$, and include relevant endpoints.",
      "Classify and check the candidate in the original context.",
    ],
    fastMethod: [
      "Factor $f'(x)$ before solving.",
      "For a quadratic objective with negative $x^2$ coefficient, its stationary point is automatically the maximum.",
    ],
    example: {
      prompt: "A rectangle has perimeter $12$. Find its maximum area.",
      steps: [
        "If one side is $x$, the other is $6-x$, so $A=6x-x^2$.",
        "$A'=6-2x=0$ gives $x=3$.",
        "$A''=-2<0$, so this is a maximum; $A(3)=9$.",
      ],
      answer: "$9$ square units",
    },
    traps: ["Reporting the stationary input when the question asks for the output", "Ignoring endpoints in a restricted interval"],
    keywords: ["derivative", "stationary", "tangent", "normal", "optimisation"],
  },
  {
    id: "m2-exp-log",
    module: "maths2",
    topic: "Exponentials and logarithms",
    title: "Compress logarithms before evaluating",
    principle: "Logarithm laws turn products, quotients and powers into simpler single expressions; exact structure is usually faster than decimal approximation.",
    bestMethod: [
      "Check that every logarithm argument is positive.",
      "Combine or expand with the log laws needed for the target.",
      "Convert to exponential form only after simplifying.",
    ],
    fastMethod: [
      "A difference of logs is the log of a quotient.",
      "Match bases before solving exponential equations.",
    ],
    example: {
      prompt: "Evaluate $\\log_2 40-\\log_2 5$.",
      steps: [
        "$\\log_2 40-\\log_2 5=\\log_2(40/5)$.",
        "$\\log_2 8=3$.",
      ],
      answer: "$3$",
    },
    traps: ["Writing $\\log(a+b)=\\log a+\\log b$", "Forgetting positivity restrictions"],
    keywords: ["logarithms", "exponentials", "growth", "decay", "base"],
  },
  {
    id: "m2-graphs",
    module: "maths2",
    topic: "Graphs of functions",
    title: "Transform landmarks, not a cloud of points",
    principle: "Track roots, intercepts, turning points and asymptotes. A few transformed landmarks determine a graph more reliably than plotting many values.",
    bestMethod: [
      "List the original graph's decisive landmarks.",
      "Apply horizontal transformations inside the function and vertical ones outside.",
      "Check asymptotes, domain and range after the transformation.",
    ],
    fastMethod: [
      "$f(x-a)+b$ moves the graph right $a$ and up $b$.",
      "$f(-x)$ reflects in the $y$-axis; $-f(x)$ reflects in the $x$-axis.",
    ],
    example: {
      prompt: "The graph $y=f(x)$ has a minimum at $(1,-2)$. Where is it on $y=f(x-3)+4$?",
      steps: [
        "$x-3$ shifts the graph right by $3$.",
        "$+4$ shifts it up by $4$.",
      ],
      answer: "$(4,2)$",
    },
    traps: ["Reversing the direction of a horizontal shift", "Moving an asymptote that should remain fixed"],
    keywords: ["graphs", "transformations", "asymptotes", "curve sketching", "modulus"],
  },
  {
    id: "m2-integration",
    module: "maths2",
    topic: "Integration",
    title: "Separate signed integral from geometric area",
    principle: "Integration reverses differentiation, but geometric area is non-negative. Split at every crossing when the graph changes sign.",
    bestMethod: [
      "Find an antiderivative and include $+C$ for an indefinite integral.",
      "For area, locate intersections or roots and split the interval if needed.",
      "Apply limits carefully and check the sign against the graph.",
    ],
    fastMethod: [
      "Use symmetry: an odd function integrates to zero over $[-a,a]$; double one half for an even function.",
      "Recognise triangles and trapezia before integrating a straight-line graph.",
    ],
    example: {
      prompt: "Find $\\int_0^3(2x+1)\\,dx$.",
      steps: [
        "An antiderivative is $x^2+x$.",
        "Evaluate: $(3^2+3)-(0^2+0)=12$.",
      ],
      answer: "$12$",
    },
    traps: ["Forgetting the constant for an indefinite integral", "Calling a negative signed integral a negative area"],
    keywords: ["integration", "area", "antiderivative", "trapezium rule"],
  },
  {
    id: "m2-series",
    module: "maths2",
    topic: "Sequences and series",
    title: "Classify the sequence before choosing a formula",
    principle: "Constant differences indicate arithmetic structure; constant ratios indicate geometric structure. Write the first few terms if the indexing is unclear.",
    bestMethod: [
      "Identify arithmetic, geometric, recurrence or binomial structure.",
      "Write the relevant term or sum formula with its indexing.",
      "Check the formula against a small known term.",
    ],
    fastMethod: [
      "For an infinite geometric series, first verify $|r|<1$ then use $a/(1-r)$.",
      "For a single binomial coefficient, go directly to $\\binom nr a^{n-r}b^r$.",
    ],
    example: {
      prompt: "Find the sum to infinity of $12+6+3+\\cdots$.",
      steps: [
        "This is geometric with $a=12$ and $r=1/2$.",
        "$|r|<1$, so $S_\\infty=a/(1-r)=12/(1/2)$.",
      ],
      answer: "$24$",
    },
    traps: ["Using the infinite-sum formula when $|r|\\ge1$", "An off-by-one error in the power of $r$"],
    keywords: ["sequence", "series", "binomial", "arithmetic", "geometric"],
  },
  {
    id: "m2-trigonometry",
    module: "maths2",
    topic: "Trigonometry",
    title: "Reduce to an exact angle or one identity",
    principle: "Use exact values, quadrant signs and a single identity. Avoid converting to decimals until the answer format requires it.",
    bestMethod: [
      "Choose the shortest relation: triangle rule, exact value, identity or graph.",
      "Solve for the reference angle, then include all valid quadrants in the interval.",
      "Substitute solutions back when squaring or rearranging may introduce extras.",
    ],
    fastMethod: [
      "Memorise exact values at $0,30,45,60,90$ degrees.",
      "Use $\\sin^2x+\\cos^2x=1$ to replace a pair of squared terms immediately.",
    ],
    example: {
      prompt: "Solve $2\\sin x=1$ for $0^\\circ\\le x<360^\\circ$.",
      steps: [
        "$\\sin x=1/2$ has reference angle $30^\\circ$.",
        "Sine is positive in quadrants I and II.",
      ],
      answer: "$x=30^\\circ,150^\\circ$",
    },
    traps: ["Giving only the principal solution", "Using a right-triangle rule in a non-right triangle"],
    keywords: ["trigonometry", "identities", "equations", "sine", "cosine"],
  },
  {
    id: "p-electricity",
    module: "physics",
    topic: "Electricity",
    title: "Reduce the circuit before calculating power",
    principle: "Mark what is shared: current in series, potential difference in parallel. Reduce the network before applying $V=IR$ or a power relation.",
    bestMethod: [
      "Redraw the circuit as clear series and parallel blocks.",
      "Find the equivalent resistance and total current or voltage.",
      "Work back into the branch containing the requested component.",
    ],
    fastMethod: [
      "Two parallel resistors give a resistance smaller than either; equal resistors $R$ in parallel give $R/2$.",
      "Choose the power form that uses known quantities: $P=IV$, $I^2R$, or $V^2/R$.",
    ],
    example: {
      prompt: "A $6\\ohm$ and $3\\ohm$ resistor are in parallel across $12\\text{ V}$. Find the total current.",
      steps: [
        "$1/R=1/6+1/3=1/2$, so $R=2\\ohm$.",
        "$I=V/R=12/2$.",
      ],
      answer: "$6\\text{ A}$",
    },
    traps: ["Adding parallel resistances directly", "Using the total current as every branch current"],
    keywords: ["circuits", "resistance", "current", "voltage", "power"],
  },
  {
    id: "p-magnetism",
    module: "physics",
    topic: "Magnetism",
    title: "Name the changing cause and the opposing response",
    principle: "For induction, identify the change in magnetic flux and then apply Lenz's law. For force, keep field, current and motion directions distinct.",
    bestMethod: [
      "State whether the question concerns force, induction, or transformation.",
      "Identify the field direction and the changing quantity.",
      "Apply the appropriate direction rule or transformer ratio, including energy losses only if stated.",
    ],
    fastMethod: [
      "A larger rate of flux change means a larger induced emf.",
      "For an ideal transformer, $V_p/V_s=N_p/N_s$ and input power equals output power.",
    ],
    example: {
      prompt: "An ideal transformer has $N_p:N_s=20:1$ and $V_p=240\\text{ V}$. Find $V_s$.",
      steps: [
        "$V_s=V_p(N_s/N_p)$.",
        "$V_s=240/20$.",
      ],
      answer: "$12\\text{ V}$",
    },
    traps: ["Using turns difference rather than turns ratio", "Saying induced effects support the change instead of opposing it"],
    keywords: ["magnetic field", "motor", "induction", "transformer", "flux"],
  },
  {
    id: "p-matter",
    module: "physics",
    topic: "Matter",
    title: "Start from the definition and keep units visible",
    principle: "Density, pressure and elastic behaviour are definition-led. Unit conversion is often the real test.",
    bestMethod: [
      "Write the defining equation before inserting values.",
      "Convert all quantities into a consistent unit system.",
      "Check whether the result's scale and direction are physically plausible.",
    ],
    fastMethod: [
      "Pressure increases with force and decreases with contact area.",
      "$1\\text{ g/cm}^3=1000\\text{ kg/m}^3$.",
    ],
    example: {
      prompt: "A mass of $540\\text{ g}$ occupies $90\\text{ cm}^3$. Find its density.",
      steps: [
        "$\\rho=m/V$.",
        "$\\rho=540/90$ in the already consistent units.",
      ],
      answer: "$6\\text{ g/cm}^3$",
    },
    traps: ["Converting mass but not volume", "Confusing pressure with force"],
    keywords: ["density", "pressure", "Hooke", "materials", "fluids"],
  },
  {
    id: "p-mechanics",
    module: "physics",
    topic: "Mechanics",
    title: "Choose the conservation law before the equation",
    principle: "A clean system diagram usually reveals whether the shortest route is force, energy, momentum, moments or kinematics.",
    bestMethod: [
      "Define the object or system and a positive direction.",
      "List initial and final states, then choose one governing law.",
      "Solve symbolically before substituting and check units.",
    ],
    fastMethod: [
      "No time given often suggests energy; collision language suggests momentum.",
      "At constant velocity, resultant force is zero—not that every force is zero.",
    ],
    example: {
      prompt: "A $2\\text{ kg}$ object falls $5\\text{ m}$ from rest. Take $g=10\\text{ N/kg}$ and ignore drag. Find its kinetic energy just before impact.",
      steps: [
        "Loss of gravitational potential energy becomes kinetic energy.",
        "$E_k=mgh=2\\times10\\times5$.",
      ],
      answer: "$100\\text{ J}$",
    },
    traps: ["Mixing scalar speed with signed velocity", "Applying conservation of mechanical energy when dissipative work is stated"],
    keywords: ["motion", "forces", "energy", "momentum", "moments", "power"],
  },
  {
    id: "p-radioactivity",
    module: "physics",
    topic: "Radioactivity",
    title: "Conserve nucleon and proton numbers separately",
    principle: "Nuclear equations balance mass number and atomic number independently; half-life questions are repeated multiplication, not linear subtraction.",
    bestMethod: [
      "For a nuclear equation, balance the top and bottom numbers in separate columns.",
      "For decay, find the number of half-lives $n=t/T_{1/2}$.",
      "Apply the decay factor $(1/2)^n$ to undecayed nuclei or activity.",
    ],
    fastMethod: [
      "Alpha emission changes $(A,Z)$ by $(-4,-2)$; beta-minus leaves $A$ unchanged and changes $Z$ by $+1$.",
      "After $n$ half-lives, the remaining fraction is $1/2^n$.",
    ],
    example: {
      prompt: "A sample has half-life $3$ days. What fraction remains after $12$ days?",
      steps: [
        "$12/3=4$ half-lives.",
        "Remaining fraction $=(1/2)^4$.",
      ],
      answer: "$1/16$",
    },
    traps: ["Subtracting one half of the original amount each time", "Changing mass number during beta decay"],
    keywords: ["radioactivity", "half-life", "nuclear", "isotopes", "decay"],
  },
  {
    id: "p-thermal",
    module: "physics",
    topic: "Thermal physics",
    title: "Track energy and absolute temperature",
    principle: "Distinguish temperature change from change of state. Gas-law temperatures must be in kelvin.",
    bestMethod: [
      "Identify heating within a state ($E=mc\\Delta T$) or a change of state ($E=mL$).",
      "For a fixed gas sample, write the invariant relationship before substituting.",
      "Convert Celsius to kelvin for gas ratios and proportional reasoning.",
    ],
    fastMethod: [
      "On a flat heating-curve section, supplied energy changes state rather than temperature.",
      "At fixed volume, gas pressure is proportional to kelvin temperature.",
    ],
    example: {
      prompt: "How much energy heats $0.50\\text{ kg}$ of water by $10^\\circ\\text{C}$ if $c=4200\\text{ J kg}^{-1}\\text{K}^{-1}$?",
      steps: [
        "$E=mc\\Delta T$.",
        "$E=0.50\\times4200\\times10$.",
      ],
      answer: "$2.1\\times10^4\\text{ J}$",
    },
    traps: ["Using Celsius in a gas-law ratio", "Using specific heat capacity during a phase change"],
    keywords: ["temperature", "gases", "specific heat", "latent heat", "evaporation"],
  },
  {
    id: "p-waves",
    module: "physics",
    topic: "Waves",
    title: "Follow what stays fixed across the boundary",
    principle: "Use $v=f\\lambda$ and remember that frequency is fixed by the source; at a boundary, speed and wavelength may change together.",
    bestMethod: [
      "Identify the wave quantity requested and the medium in each region.",
      "Apply $v=f\\lambda$, a timing relation, or ray geometry.",
      "Check whether the described bending matches the speed change.",
    ],
    fastMethod: [
      "Across a boundary, frequency stays constant, so wavelength changes in the same ratio as speed.",
      "For an echo, the measured travel distance is out and back, so divide by two.",
    ],
    example: {
      prompt: "A wave of frequency $50\\text{ Hz}$ travels at $200\\text{ m/s}$. Find its wavelength.",
      steps: [
        "$v=f\\lambda$, so $\\lambda=v/f$.",
        "$\\lambda=200/50$.",
      ],
      answer: "$4\\text{ m}$",
    },
    traps: ["Changing frequency at a material boundary", "Forgetting the return journey in echo distance"],
    keywords: ["waves", "sound", "light", "refraction", "frequency", "wavelength"],
  },
];

export const EXAM_TACTICS: ExamTactic[] = [
  {
    id: "target-first",
    title: "Read the target first",
    summary: "Before processing every detail, identify exactly what the final sentence asks for and in which units.",
    useWhen: "Long stems, diagrams, or questions containing extra data.",
    method: ["Read the final sentence.", "Write a two-word target such as ‘total current’ or ‘minimum $x$’.", "Use only data connected to that target."],
    caution: "Still read conditions such as ‘not to scale’, interval restrictions and approximations.",
  },
  {
    id: "options-as-information",
    title: "Use the options as information",
    summary: "The choices can reveal required precision, sign, scale, or a faster reverse route.",
    useWhen: "Forward algebra is long or the options are simple numerical candidates.",
    method: ["Eliminate impossible signs or units.", "Try a middle or simple option.", "Use whether it is too high or low to choose the next candidate."],
    caution: "Back-substitute into the original condition; rearranging can introduce invalid candidates.",
  },
  {
    id: "choose-values",
    title: "Choose easy values",
    summary: "When a statement must hold for all allowed values, a carefully chosen simple value can disprove options quickly.",
    useWhen: "Identities, proportional statements, transformations and abstract function claims.",
    method: ["Try $0$, $1$, $-1$ or an exact-angle value if permitted.", "Reject any option that fails.", "Use a second value if several survive."],
    caution: "One successful test does not prove an identity; it only rejects failures.",
  },
  {
    id: "estimate-bound",
    title: "Estimate, then bound",
    summary: "A rough scale check can remove most options; a tight upper or lower bound can finish the decision without exact arithmetic.",
    useWhen: "Awkward roots, percentages, standard form and physical magnitudes.",
    method: ["Round in a direction you can track.", "Calculate a lower and/or upper bound.", "Select only if one option lies in the interval."],
    caution: "Do not round both sides unpredictably and then call the result a bound.",
  },
  {
    id: "units-elimination",
    title: "Let units eliminate options",
    summary: "Dimensional structure exposes missing squares, reciprocals and conversion errors before detailed calculation.",
    useWhen: "Physics formulae, compound units, area and volume.",
    method: ["Attach units to every quantity.", "Cancel them algebraically.", "Reject answers with the wrong dimension or scale."],
    caution: "Two choices may share the correct units, so dimensional analysis is a filter rather than always a complete proof.",
  },
  {
    id: "ratio-before-values",
    title: "Compare ratios before values",
    summary: "Many physics and geometry questions ask only how a result changes, so constants cancel.",
    useWhen: "Proportional change, similar shapes, inverse-square relationships and fixed-form formulae.",
    method: ["Write the formula twice.", "Divide new by old.", "Cancel unchanged quantities before inserting the change factors."],
    caution: "Check whether the relationship is direct, inverse, squared or cubed.",
  },
  {
    id: "one-law",
    title: "Name one governing law",
    summary: "Selecting the physical or mathematical principle before numbers prevents formula-hunting.",
    useWhen: "Mechanics, circuits, thermal physics and multi-stage algebra.",
    method: ["Define the system.", "Name the law in words.", "Write one equation and solve symbolically."],
    caution: "Conservation laws require the right system and any losses must be included.",
  },
  {
    id: "skip-return",
    title: "Use a two-pass module",
    summary: "The official pace averages about $89$ seconds per question. Protect time for accessible marks and return to harder items.",
    useWhen: "You cannot see a credible route after an initial read or your algebra is expanding rapidly.",
    method: ["Make a defensible elimination if possible.", "Flag and move on.", "Return with the remaining module time, then answer every blank because there is no negative marking."],
    caution: "This is a practice framework, not an official timing rule; calibrate the trigger using your own timed evidence.",
  },
];

const GUIDE_BY_KEY = new Map(
  TECHNIQUE_GUIDES.map((guide) => [`${guide.module}|${guide.topic}`, guide]),
);

export function techniqueForQuestion(question: Pick<Question, "targetModule" | "esatTopic">): TechniqueGuide | null {
  return GUIDE_BY_KEY.get(`${question.targetModule}|${question.esatTopic}`) ?? null;
}

export function techniqueCoverageKey(question: Pick<Question, "targetModule" | "esatTopic">): string {
  return `${question.targetModule}|${question.esatTopic}`;
}
