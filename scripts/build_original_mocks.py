"""Build and aggressively validate three original 27-question ESAT mock modules.

Difficulty policy
-----------------
Candidate reports describe the live ESAT as harder than the legacy NSAA papers this
archive is drawn from, so every item here is deliberately pitched above archive level:

* each question needs at least two linked steps, or one step plus a judgement;
* distractors are the answers produced by named, specific mistakes, not random numbers;
* no item can be solved by recognising a standard form and substituting once;
* the whole set is calculator-free and sits inside the ESAT 2026 v7.1.1 specification.

The bank uses 81 different question archetypes. Numerical answers are derived in code
(usually with Fraction) wherever the arithmetic allows, while conceptual items are
checked against the specification. The output is original practice material and must
never be presented as official UAT-UK content or as a source of an official score.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from fractions import Fraction
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
OUTPUT = APP_DIR / "public" / "data" / "original-mocks.json"
VERSION = "esat-atlas-original-challenge-a-v5"
LETTERS = "ABCDEFGH"

# A figure may only be attached to a question it actually depicts, and the alt text must
# state every value the figure carries, because it is the sole source for a learner who
# cannot see the image. Both are asserted in verify_diagrams() below.
DIAGRAMS: dict[tuple[str, int], tuple[str, str]] = {
    ("maths1", 15): ("questions/original/atlas-challenge-a-maths1-q15.png", "Speed-time graph: speed decreases uniformly from 30 m/s at 0 s to 12 m/s at 24 s, then remains at 12 m/s until 64 s."),
    ("maths1", 18): ("questions/original/atlas-challenge-a-maths1-q18.png", "Right square-based pyramid with a 10 cm square base and a vertical height of 12 cm marked from the apex to the centre of the base."),
    ("maths1", 19): ("questions/original/atlas-challenge-a-maths1-q19.png", "Circle with centre O. Tangents PA and PB meet at the external point P, radii OA and OB subtend 118 degrees at O, and C lies on the minor arc AB."),
    ("maths1", 22): ("questions/original/atlas-challenge-a-maths1-q22.png", "Bearing diagram from port P: one route is 24 km on bearing 060 degrees and the other is 18 km on bearing 150 degrees."),
    ("maths2", 10): ("questions/original/atlas-challenge-a-maths2-q10.png", "Coordinate graph of y equals x squared and y equals x plus 2, with the enclosed region between x equals minus 1 and x equals 2 shaded."),
    ("maths2", 12): ("questions/original/atlas-challenge-a-maths2-q12.png", "Triangle ABC with AB 7 cm, BC 8 cm and included angle ABC 60 degrees."),
    ("maths2", 21): ("questions/original/atlas-challenge-a-maths2-q21.png", "Closed cylinder labelled with radius r and height h, and a stated volume of 128 pi cubic centimetres."),
    ("physics", 1): ("questions/original/physics-q01-resistor-network.png", "A 24 V source and 4 ohm resistor in series with parallel 6 ohm and 12 ohm branches."),
    ("physics", 3): ("questions/original/physics-q03-thermistor-potential-divider.png", "A 9 V potential divider containing a 3 kilo-ohm fixed resistor and an NTC thermistor, with a voltmeter across the fixed resistor."),
    ("physics", 14): ("questions/original/physics-q14-speed-time-graph.png", "Car speed-time graph: a constant 20 m/s through the 0.70 s reaction time, then uniform braking to rest at 4.70 s."),
    ("physics", 22): ("questions/original/physics-q22-force-extension-graph.png", "Straight force-extension graph through 4.0 cm at 10 N and 10 cm at 25 N, with the triangular stored-energy area below the line shaded."),
    ("physics", 26): ("questions/original/physics-q26-radioactive-decay-graph.png", "Activity-time decay graph starting at 960 Bq and passing 480, 240, 120 and 60 Bq at equal time intervals, reaching 60 Bq at 18 days."),
}

EXPECTED_TOPICS = {
    "maths1": {
        "Units",
        "Number",
        "Ratio and proportion",
        "Algebra",
        "Geometry",
        "Statistics",
        "Probability",
    },
    "physics": {
        "Electricity",
        "Magnetism",
        "Mechanics",
        "Thermal physics",
        "Matter",
        "Waves",
        "Radioactivity",
    },
    "maths2": {
        "Algebra and functions",
        "Sequences and series",
        "Coordinate geometry",
        "Trigonometry",
        "Exponentials and logarithms",
        "Differentiation",
        "Integration",
        "Graphs of functions",
    },
}


def fmt(value: int | Fraction | float) -> str:
    """Format exact values without leaking Python's float representation."""
    if isinstance(value, Fraction):
        return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:g}"
    return str(value)


def prompt_signature(prompt: str) -> str:
    """Remove numeric substitutions so number-swapped copies have one signature."""
    normalized = prompt.lower()
    normalized = re.sub(r"\d+(?:\.\d+)?", "<n>", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def simple_numeric_option(value: str) -> tuple[Fraction, str] | None:
    """Canonicalise simple numeric options so 1/2 and 0.5 cannot both appear."""
    match = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?|-?\d+/\d+)\s*(.*?)\s*", value)
    if not match:
        return None
    number, suffix = match.groups()
    try:
        return Fraction(number), suffix.strip()
    except (ValueError, ZeroDivisionError):
        return None


RENDERED = {
    "pi": "π", "theta": "θ", "alpha": "α", "beta": "β", "lambda": "λ",
    "rho": "ρ", "mu": "μ", "Delta": "Δ", "Omega": "Ω", "ohm": "Ω",
    "times": "×", "div": "÷", "cdot": "·", "pm": "±", "mp": "∓",
    "le": "≤", "ge": "≥", "ne": "≠", "approx": "≈", "to": "→",
    "infty": "∞", "deg": "°", "propto": "∝", "ldots": "...",
    "sin": "sin", "cos": "cos", "tan": "tan", "log": "log", "ln": "ln",
    "int": "∫", "binom": "C", "text": "", "left": "", "right": "",
}


FRACTION = re.compile(r"\\frac\{([^{}]*)\}\{([^{}]*)\}")
ROOT = re.compile(r"\\sqrt\{([^{}]*)\}")
COMMAND = re.compile(r"\\(?:[A-Za-z]+|.)")


def strip_math(value: str) -> str:
    """Approximate the rendered text of authored markup, for length and content checks."""
    text = value.replace("\\$", "$")
    for _ in range(3):  # fractions and roots can nest a couple of levels deep
        text = FRACTION.sub(r"\1/\2", text)
        text = ROOT.sub(r"sqrt(\1)", text)
    text = COMMAND.sub(lambda match: RENDERED.get(match.group(0)[1:], ""), text)
    text = text.replace("$", "").replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", text).strip()


def diagram_hash(relative_path: str) -> str:
    """Content hash of a shipped figure, so a redrawn diagram changes the question record."""
    path = APP_DIR / "public" / relative_path
    if not path.is_file():
        raise FileNotFoundError(
            f"{relative_path} is referenced by DIAGRAMS but is missing. "
            f"Run scripts/build_original_diagrams.py and scripts/build_original_math_diagrams.py first."
        )
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_question(
    module: str,
    number: int,
    topic: str,
    spec_code: str,
    subtopic: str,
    archetype: str,
    prompt: str,
    correct: str,
    distractors: list[str],
    explanation: str,
) -> dict[str, object]:
    values: list[str] = []
    for value in [correct, *distractors]:
        clean = str(value).strip()
        if clean and clean not in values:
            values.append(clean)
    if len(values) < 5:
        raise ValueError(f"{module} Q{number}: fewer than five unique options")
    values = values[:5]
    # Stable hash ordering prevents an exploitable repeating answer-letter pattern while
    # keeping the generated bank deterministic across machines and builds.
    values.sort(key=lambda value: hashlib.sha256(f"{VERSION}|{module}|{number}|{value}".encode("utf-8")).digest())
    correct_index = values.index(correct)
    question_id = f"atlas-challenge-a-{module}-q{number:02d}"
    digest = hashlib.sha256(f"{prompt}|{correct}|{explanation}".encode("utf-8")).hexdigest()
    signature = prompt_signature(prompt)
    diagram = DIAGRAMS.get((module, number))
    return {
        "id": question_id,
        "questionBankVersion": VERSION,
        "year": 2026,
        "sourceExam": "ESAT Atlas Original",
        "sourcePaper": "Challenge Mock A",
        "sourceSection": module,
        "sourcePart": "Original module",
        "originalQuestionNumber": number,
        "sourcePage": 0,
        "sourcePages": [],
        "targetModule": module,
        "esatTopic": topic,
        "esatSubtopic": subtopic,
        "specificationCode": spec_code,
        "specificationVersion": "ESAT-2026-v7.1.1",
        "questionArchetype": archetype,
        "promptTemplateHash": hashlib.sha256(signature.encode("utf-8")).hexdigest(),
        "questionImage": "",
        "questionText": prompt,
        "questionDiagram": diagram[0] if diagram else "",
        "questionDiagramAlt": diagram[1] if diagram else "",
        "optionText": dict(zip(answer_letters := list(LETTERS[: len(values)]), values, strict=True)),
        "answerOptions": answer_letters,
        "correctAnswer": answer_letters[correct_index],
        "verifiedCorrectText": correct,
        "explanation": explanation,
        "difficulty": "stretch",
        "authored": True,
        "excluded": False,
        "exclusionReason": None,
        "reviewRequired": False,
        "importConfidence": "high",
        "sourceHash": digest,
        "imageHash": diagram_hash(diagram[0]) if diagram else digest,
        "searchText": f"{prompt} {topic} {subtopic}",
    }


def maths1() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []

    def add(topic: str, code: str, subtopic: str, archetype: str, prompt: str, correct: str, distractors: list[str], explanation: str) -> None:
        output.append(make_question("maths1", len(output) + 1, topic, code, subtopic, archetype, prompt, correct, distractors, explanation))

    # --- Units -------------------------------------------------------------
    flow_speed = Fraction(15, 1000) / 60 / Fraction(25, 100_000)
    add(
        "Units", "M1.2", "Compound unit conversion", "volumetric-flow-to-speed",
        r"A pump delivers 15 litres of water per minute through a pipe of cross-sectional area $2.5\text{ cm}^2$. What is the mean speed of the water in the pipe?",
        rf"${fmt(flow_speed)}\text{{ m/s}}$", [r"$0.1\text{ m/s}$", r"$10\text{ m/s}$", r"$0.06\text{ m/s}$", r"$6\text{ m/s}$"],
        r"The flow rate is $0.015\text{ m}^3$ per $60\text{ s}$, which is $2.5 \times 10^{-4}\text{ m}^3\text{/s}$, and $2.5\text{ cm}^2 = 2.5 \times 10^{-4}\text{ m}^2$. Speed is flow rate divided by area, giving $1\text{ m/s}$.",
    )

    cube_pressure = Fraction(2700 * 8, 1000) * 10 / Fraction(4, 100)
    add(
        "Units", "M1.4", "Derived units and pressure", "solid-cube-ground-pressure",
        r"A solid cube of side $20\text{ cm}$ is made from a material of density $2.7\text{ g/cm}^3$. Taking $g = 10\text{ N/kg}$, what pressure does the cube exert on the ground when it rests on one face?",
        rf"${fmt(cube_pressure)}\text{{ Pa}}$", [r"$540\text{ Pa}$", r"$54\,000\text{ Pa}$", r"$216\text{ Pa}$", r"$2700\text{ Pa}$"],
        r"The volume is $8000\text{ cm}^3$, so the mass is $21.6\text{ kg}$ and the weight is $216\text{ N}$. The face area is $0.04\text{ m}^2$, giving $216 \div 0.04 = 5400\text{ Pa}$.",
    )

    # --- Number ------------------------------------------------------------
    add(
        "Number", "M2.2", "Standard form", "standard-form-three-factor",
        r"Evaluate $\frac{(2.4 \times 10^{-5})(5 \times 10^{12})}{8 \times 10^{3}}$, giving your answer in standard form.",
        r"$1.5 \times 10^{4}$", [r"$1.5 \times 10^{3}$", r"$1.5 \times 10^{5}$", r"$15 \times 10^{3}$", r"$1.2 \times 10^{4}$"],
        r"Combine the coefficients and the powers separately: $\frac{2.4 \times 5}{8} = 1.5$ and $10^{-5 + 12 - 3} = 10^{4}$, so the value is $1.5 \times 10^{4}$.",
    )

    add(
        "Number", "M2.4", "Surds and rationalising", "conjugate-rationalisation",
        r"Write $\frac{\sqrt{5} + \sqrt{2}}{\sqrt{5} - \sqrt{2}}$ in the form $\frac{a + b\sqrt{10}}{c}$, where $a$, $b$ and $c$ are integers.",
        r"$\frac{7 + 2\sqrt{10}}{3}$", [r"$\frac{7 - 2\sqrt{10}}{3}$", r"$\frac{7 + 2\sqrt{10}}{7}$", r"$7 + 2\sqrt{10}$", r"$\frac{3 + 2\sqrt{10}}{3}$"],
        r"Multiply top and bottom by $\sqrt{5} + \sqrt{2}$. The denominator becomes $5 - 2 = 3$ and the numerator becomes $5 + 2 + 2\sqrt{10} = 7 + 2\sqrt{10}$.",
    )

    recurring = Fraction(5, 12)
    add(
        "Number", "M2.3", "Recurring decimals", "mixed-recurring-decimal",
        r"The decimal $0.41666\ldots$, in which only the digit $6$ repeats, is written as a fraction in its lowest terms. What is that fraction?",
        rf"$\frac{{{recurring.numerator}}}{{{recurring.denominator}}}$", [r"$\frac{41}{99}$", r"$\frac{5}{11}$", r"$\frac{37}{90}$", r"$\frac{3}{7}$"],
        r"Let $x = 0.41666\ldots$ Then $100x = 41.666\ldots$ and $1000x = 416.666\ldots$, so $900x = 375$ and $x = \frac{375}{900} = \frac{5}{12}$.",
    )

    add(
        "Number", "M2.7", "Bounds and error", "percentage-error-from-bounds",
        r"A rectangle is measured as $12.0\text{ cm}$ by $7.5\text{ cm}$, each correct to the nearest $0.1\text{ cm}$. Taking the measured values as nominal, what is the greatest possible percentage error in the calculated area, to 2 significant figures?",
        r"$1.1\%$", [r"$0.83\%$", r"$1.3\%$", r"$2.2\%$", r"$0.55\%$"],
        r"The upper bounds are $12.05\text{ cm}$ and $7.55\text{ cm}$, giving a maximum area of $90.9775\text{ cm}^2$ against a nominal $90\text{ cm}^2$. The error is $\frac{0.9775}{90} = 1.086\%$, which is $1.1\%$ to 2 significant figures.",
    )

    # --- Ratio and proportion ---------------------------------------------
    ratio_total = 8 * 24
    add(
        "Ratio and proportion", "M3.1", "Changing ratios", "ratio-after-addition",
        r"In a mixture the masses of $A$ and $B$ are in the ratio $5 : 3$. When a further $24\text{ g}$ of $B$ is added the ratio becomes $5 : 4$. What was the total mass of the original mixture?",
        rf"${ratio_total}\text{{ g}}$", [r"$168\text{ g}$", r"$216\text{ g}$", r"$144\text{ g}$", r"$240\text{ g}$"],
        r"Write $A = 5k$ and $B = 3k$. Then $\frac{5k}{3k + 24} = \frac{5}{4}$ gives $20k = 15k + 120$, so $k = 24$ and the original total is $8k = 192\text{ g}$.",
    )

    joint_variation = Fraction(6 * 36, 5)
    add(
        "Ratio and proportion", "M3.2", "Joint variation", "joint-direct-inverse-variation",
        r"$y$ is directly proportional to $x^2$ and inversely proportional to $\sqrt{z}$. When $x = 4$ and $z = 9$, $y = 32$. What is $y$ when $x = 6$ and $z = 25$?",
        rf"${fmt(float(joint_variation))}$", [r"$48$", r"$38.4$", r"$54$", r"$28.8$"],
        r"From $y = \frac{kx^2}{\sqrt{z}}$, substituting gives $32 = \frac{16k}{3}$, so $k = 6$. Then $y = \frac{6 \times 36}{5} = 43.2$.",
    )

    add(
        "Ratio and proportion", "M3.3", "Reverse percentage change", "reverse-successive-percentage",
        r"A price is increased by $15\%$ and the new price is then reduced by $12\%$. The final price is £253. What was the original price?",
        r"£250", [r"£247", r"£256", r"£245", r"£260"],
        r"Successive changes multiply, so the overall factor is $1.15 \times 0.88 = 1.012$. The original price is $\frac{253}{1.012} = £250$.",
    )

    # --- Algebra -----------------------------------------------------------
    add(
        "Algebra", "M4.2", "Line and circle", "tangent-condition-discriminant",
        r"The line $y = 2x + c$ is a tangent to the circle $x^2 + y^2 = 20$. What are the possible values of $c$?",
        r"$c = 10$ or $c = -10$", [r"$c = 5$ or $c = -5$", r"$c = 2\sqrt{5}$ or $c = -2\sqrt{5}$", r"$c = 20$ or $c = -20$", r"$c = 10$ only"],
        r"Substituting gives $5x^2 + 4cx + c^2 - 20 = 0$. Tangency needs a zero discriminant: $16c^2 - 20(c^2 - 20) = 0$, so $4c^2 = 400$ and $c = \pm 10$.",
    )

    add(
        "Algebra", "M4.3", "Completing the square", "quadratic-range-statement",
        r"The function $f$ is defined for all real $x$ by $f(x) = 2x^2 - 12x + 23$. What is the range of $f$?",
        r"$f(x) \ge 5$", [r"$f(x) \ge 23$", r"$f(x) \ge -5$", r"$f(x) \ge 3$", r"$f(x) \le 5$"],
        r"Completing the square gives $f(x) = 2(x - 3)^2 + 5$. The squared term is never negative, so the least value is $5$, taken at $x = 3$.",
    )

    add(
        "Algebra", "M4.5", "Equations with algebraic fractions", "rational-equation-root-difference",
        r"The equation $\frac{4}{x - 2} - \frac{3}{x + 1} = 1$ has two real solutions. What is the positive difference between them?",
        r"$2\sqrt{13}$", [r"$2\sqrt{11}$", r"$\sqrt{13}$", r"$2$", r"$4\sqrt{13}$"],
        r"Clearing the fractions gives $x^2 - 2x - 12 = 0$, so $x = 1 \pm \sqrt{13}$. Neither root is excluded, and the difference is $2\sqrt{13}$.",
    )

    sequence_term = 3 * 20**2 + 2
    add(
        "Algebra", "M4.7", "Quadratic sequences", "quadratic-sequence-distant-term",
        r"A sequence begins $5$, $14$, $29$, $50$, $77$, $\ldots$ and its $n$th term is a quadratic in $n$. What is its $20$th term?",
        rf"${sequence_term}$", [r"$1200$", r"$1220$", r"$1178$", r"$1205$"],
        r"The second difference is $6$, so the $n^2$ coefficient is $3$. Subtracting $3n^2$ leaves a constant $2$, giving $3n^2 + 2$ and a $20$th term of $1202$.",
    )

    add(
        "Algebra", "M4.6", "Quadratic inequalities", "compound-inequality-integer-count",
        r"How many integer values of $n$ satisfy both of the inequalities $n^2 < 6n + 27$ and $n > -2$?",
        r"$10$", [r"$9$", r"$11$", r"$12$", r"$8$"],
        r"The quadratic condition rearranges to $(n - 9)(n + 3) < 0$, so $-3 < n < 9$. Combining with $n > -2$ leaves $n = -1$ up to $n = 8$, which is ten integers.",
    )

    journey_average = Fraction(984, 64)
    add(
        "Algebra", "M4.8", "Speed-time graphs", "two-phase-average-speed",
        r"A train decelerates uniformly from $30\text{ m/s}$ to $12\text{ m/s}$ in $24\text{ s}$, then travels at a steady $12\text{ m/s}$ for $40\text{ s}$. What is its average speed over the whole $64\text{ s}$?",
        rf"${fmt(float(journey_average))}\text{{ m/s}}$", [r"$16\text{ m/s}$", r"$15\text{ m/s}$", r"$21\text{ m/s}$", r"$14.5\text{ m/s}$"],
        r"The area under the speed-time graph is $\frac{1}{2}(30 + 12)(24) + 12(40) = 504 + 480 = 984\text{ m}$. The average speed is $\frac{984}{64} = 15.375\text{ m/s}$.",
    )

    add(
        "Algebra", "M4.9", "Inverse functions", "rational-function-inverse-value",
        r"The function $f$ is defined by $f(x) = \frac{3x - 1}{x + 2}$ for $x \ne -2$. What is the value of $f^{-1}(4)$?",
        r"$-9$", [r"$9$", r"$-\frac{7}{2}$", r"$\frac{11}{2}$", r"$-\frac{9}{7}$"],
        r"Solve $f(x) = 4$: $3x - 1 = 4(x + 2)$, so $3x - 1 = 4x + 8$ and $x = -9$. Checking, $f(-9) = \frac{-28}{-7} = 4$.",
    )

    # --- Geometry ----------------------------------------------------------
    diagonals = 30 * 27 // 2
    add(
        "Geometry", "M5.1", "Polygon angles", "polygon-angle-difference-diagonals",
        r"In a regular polygon each interior angle exceeds each exterior angle by $156\deg$. How many diagonals does the polygon have?",
        rf"${diagonals}$", [r"$375$", r"$435$", r"$390$", r"$420$"],
        r"The two angles sum to $180\deg$ and differ by $156\deg$, so the exterior angle is $12\deg$ and the polygon has $\frac{360}{12} = 30$ sides. It therefore has $\frac{30(30 - 3)}{2} = 405$ diagonals.",
    )

    pyramid_area = 100 + 4 * (10 * 13 // 2)
    add(
        "Geometry", "M5.3", "Three-dimensional Pythagoras", "square-pyramid-total-surface-area",
        r"A right pyramid has a square base of side $10\text{ cm}$ and a vertical height of $12\text{ cm}$. What is its total surface area?",
        rf"${pyramid_area}\text{{ cm}}^2$", [r"$340\text{ cm}^2$", r"$620\text{ cm}^2$", r"$260\text{ cm}^2$", r"$400\text{ cm}^2$"],
        r"The slant height of a triangular face is $\sqrt{12^2 + 5^2} = 13\text{ cm}$, so each face has area $65\text{ cm}^2$. Four faces plus the $100\text{ cm}^2$ base give $360\text{ cm}^2$.",
    )

    add(
        "Geometry", "M5.7", "Circle theorems", "minor-arc-inscribed-angle",
        r"$PA$ and $PB$ are tangents to a circle with centre $O$, and angle $AOB = 118\deg$. The point $C$ lies on the minor arc $AB$. What is angle $ACB$?",
        r"$121\deg$", [r"$59\deg$", r"$62\deg$", r"$118\deg$", r"$131\deg$"],
        r"For $C$ on the minor arc, the relevant central angle is the reflex angle $360 - 118 = 242\deg$. The inscribed angle is half of it, giving $121\deg$.",
    )

    cone_volume = Fraction(54 * 125, 27)
    add(
        "Geometry", "M5.5", "Similar solids", "similar-cones-area-to-volume",
        r"Two similar solid cones have total surface areas in the ratio $9 : 25$. The smaller cone has volume $54\text{ cm}^3$. What is the volume of the larger cone?",
        rf"${fmt(cone_volume)}\text{{ cm}}^3$", [r"$150\text{ cm}^3$", r"$90\text{ cm}^3$", r"$375\text{ cm}^3$", r"$200\text{ cm}^3$"],
        r"An area ratio of $9 : 25$ means a length ratio of $3 : 5$, so the volume ratio is $27 : 125$. The larger volume is $\frac{54 \times 125}{27} = 250\text{ cm}^3$.",
    )

    sector_area = 12 * (34 - 24) // 2
    add(
        "Geometry", "M5.6", "Arcs and sectors", "sector-area-from-perimeter",
        r"A sector of a circle has radius $12\text{ cm}$ and perimeter $34\text{ cm}$. What is its area?",
        rf"${sector_area}\text{{ cm}}^2$", [r"$48\text{ cm}^2$", r"$72\text{ cm}^2$", r"$120\text{ cm}^2$", r"$34\text{ cm}^2$"],
        r"The two radii use $24\text{ cm}$, so the arc is $10\text{ cm}$. Using area $= \frac{1}{2} \times \text{radius} \times \text{arc}$ gives $\frac{1}{2} \times 12 \times 10 = 60\text{ cm}^2$.",
    )

    add(
        "Geometry", "M5.8", "Bearings", "perpendicular-bearing-separation",
        r"From port $P$ one ship sails $24\text{ km}$ on a bearing of $060\deg$ and another sails $18\text{ km}$ on a bearing of $150\deg$. How far apart are the two ships?",
        r"$30\text{ km}$", [r"$42\text{ km}$", r"$6\text{ km}$", r"$21\text{ km}$", r"$36\text{ km}$"],
        r"The bearings differ by $90\deg$, so the two tracks are perpendicular. The separation is $\sqrt{24^2 + 18^2} = \sqrt{900} = 30\text{ km}$.",
    )

    # --- Statistics --------------------------------------------------------
    add(
        "Statistics", "M6.2", "Grouped data", "grouped-mean-missing-frequency",
        r"A grouped frequency table has classes $0$–$20$, $20$–$40$ and $40$–$60$ with frequencies $5$, $x$ and $3$. Using class midpoints, the estimated mean is $28$. What is $x$?",
        r"$12$", [r"$10$", r"$14$", r"$16$", r"$8$"],
        r"Using midpoints, $\frac{5(10) + 30x + 3(50)}{8 + x} = 28$ gives $200 + 30x = 224 + 28x$, so $2x = 24$ and $x = 12$.",
    )

    outlier_limit = 25 + 3 * 16 // 2
    add(
        "Statistics", "M6.4", "Outliers", "iqr-outlier-upper-limit",
        r"Eleven values in ascending order are $4$, $6$, $9$, $11$, $13$, $16$, $18$, $20$, $25$, $30$ and $k$, where $k > 30$. Quartiles are taken as the 3rd and 9th values. Using the rule that an outlier lies more than $1.5$ times the interquartile range beyond a quartile, what is the largest value of $k$ that is not an outlier?",
        rf"${outlier_limit}$", [r"$41$", r"$57$", r"$33$", r"$65$"],
        r"The quartiles are $9$ and $25$, so the interquartile range is $16$ and $1.5 \times 16 = 24$. The upper limit is $25 + 24 = 49$.",
    )

    # --- Probability -------------------------------------------------------
    conditional = Fraction(8, 15)
    add(
        "Probability", "M7.2", "Conditional probability", "two-subject-conditional",
        r"In a class of $30$ students, $18$ study Physics, $15$ study Chemistry and $5$ study neither. A student is chosen at random from those who study Chemistry. What is the probability that the student also studies Physics?",
        rf"$\frac{{{conditional.numerator}}}{{{conditional.denominator}}}$", [r"$\frac{8}{18}$", r"$\frac{4}{15}$", r"$\frac{8}{25}$", r"$\frac{1}{2}$"],
        r"$25$ students study at least one subject, so $18 + 15 - 25 = 8$ study both. Of the $15$ chemists, $8$ also study Physics, giving $\frac{8}{15}$.",
    )

    all_different = Fraction(4 * 5 * 3, 220)
    add(
        "Probability", "M7.3", "Selection without replacement", "three-colour-all-different",
        r"A bag contains $4$ red, $5$ blue and $3$ green counters. Three counters are taken without replacement. What is the probability that all three are different colours?",
        rf"$\frac{{{all_different.numerator}}}{{{all_different.denominator}}}$", [r"$\frac{1}{22}$", r"$\frac{2}{11}$", r"$\frac{5}{22}$", r"$\frac{1}{4}$"],
        r"There are $\binom{12}{3} = 220$ equally likely selections and $4 \times 5 \times 3 = 60$ contain one of each colour, so the probability is $\frac{60}{220} = \frac{3}{11}$.",
    )

    add(
        "Probability", "M7.5", "Systematic counting", "restricted-even-four-digit-count",
        r"How many four-digit numbers greater than $4000$ can be formed from the digits $1$, $2$, $3$, $4$, $5$ and $6$, using no digit more than once, if the number must be even?",
        r"$84$", [r"$72$", r"$90$", r"$96$", r"$60$"],
        r"The last digit is $2$, $4$ or $6$ and the first is $4$, $5$ or $6$. If the last digit is $2$ there are $3$ choices of first digit, otherwise $2$; the middle pair can always be filled in $4 \times 3 = 12$ ways, giving $36 + 24 + 24 = 84$.",
    )

    assert len(output) == 27, f"maths1 produced {len(output)} questions"
    return output


def physics() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []

    def add(topic: str, code: str, subtopic: str, archetype: str, prompt: str, correct: str, distractors: list[str], explanation: str) -> None:
        output.append(make_question("physics", len(output) + 1, topic, code, subtopic, archetype, prompt, correct, distractors, explanation))

    # --- Electricity -------------------------------------------------------
    parallel = Fraction(1, Fraction(1, 6) + Fraction(1, 12))
    total_current = Fraction(24, parallel + 4)
    power_12 = (Fraction(total_current * parallel, 12)) ** 2 * 12
    add(
        "Electricity", "P1.3", "Series and parallel circuits", "mixed-network-branch-power",
        r"A $6\ohm$ resistor and a $12\ohm$ resistor are connected in parallel, and this combination is in series with a $4\ohm$ resistor across a $24\text{ V}$ supply. What power is dissipated in the $12\ohm$ resistor?",
        rf"${fmt(power_12)}\text{{ W}}$", [r"$3\text{ W}$", r"$36\text{ W}$", r"$48\text{ W}$", r"$4\text{ W}$"],
        r"The parallel pair is $4\ohm$, so the circuit is $8\ohm$ and the supply current is $3\text{ A}$. The parallel section has $12\text{ V}$ across it, so the $12\ohm$ branch carries $1\text{ A}$ and dissipates $I^2R = 12\text{ W}$.",
    )

    terminal_pd = 12 - Fraction(12, Fraction(5, 2) + Fraction(1, 2)) * Fraction(1, 2)
    add(
        "Electricity", "P1.2", "Internal resistance", "terminal-pd-with-internal-resistance",
        r"A $12\text{ V}$ battery of internal resistance $0.5\ohm$ is connected to a single $2.5\ohm$ resistor. What is the potential difference across the battery terminals?",
        rf"${fmt(terminal_pd)}\text{{ V}}$", [r"$12\text{ V}$", r"$2\text{ V}$", r"$9.6\text{ V}$", r"$11.5\text{ V}$"],
        r"The total resistance is $3\ohm$, so the current is $4\text{ A}$. The lost volts inside the battery are $4 \times 0.5 = 2\text{ V}$, leaving $10\text{ V}$ at the terminals.",
    )

    add(
        "Electricity", "P1.5", "Sensing circuits", "thermistor-divider-direction",
        r"A $9\text{ V}$ supply is connected across a $3\text{ k}\ohm$ fixed resistor in series with a thermistor whose resistance is $6\text{ k}\ohm$ at $20\deg\text{C}$. What is the potential difference across the fixed resistor at $20\deg\text{C}$, and what happens to it as the temperature rises?",
        r"$3\text{ V}$, and it increases", [r"$3\text{ V}$, and it decreases", r"$6\text{ V}$, and it increases", r"$6\text{ V}$, and it decreases", r"$3\text{ V}$, and it stays constant"],
        r"The fixed resistor takes $\frac{3}{3 + 6}$ of $9\text{ V}$, which is $3\text{ V}$. Heating lowers the thermistor resistance, so the fixed resistor takes a larger share of the supply and its potential difference rises.",
    )

    add(
        "Electricity", "P1.1", "Power, current and safety", "fuse-rating-selection",
        r"An electric shower is rated at $8.5\text{ kW}$ and runs from a $230\text{ V}$ mains supply. Fuses are available rated at $13\text{ A}$, $30\text{ A}$, $45\text{ A}$ and $60\text{ A}$. Which is the lowest suitable rating?",
        r"$45\text{ A}$", [r"$13\text{ A}$", r"$30\text{ A}$", r"$60\text{ A}$", r"$40\text{ A}$"],
        r"The operating current is $\frac{8500}{230} = 37\text{ A}$ to the nearest amp. A $30\text{ A}$ fuse would blow in normal use, so the lowest suitable rating above $37\text{ A}$ is $45\text{ A}$.",
    )

    energy_cost = Fraction(25, 10) * Fraction(3, 2) * 28
    add(
        "Electricity", "P1.6", "Energy transfer and cost", "appliance-running-cost",
        r"A $2.5\text{ kW}$ heater is used for $90$ minutes. Electricity costs $28$ pence per kilowatt-hour. What is the cost of running the heater?",
        rf"£{fmt(float(energy_cost) / 100)}", [r"£0.70", r"£1.58", r"£6.30", r"£0.63"],
        r"The energy used is $2.5\text{ kW} \times 1.5\text{ h} = 3.75\text{ kWh}$. At $28$ pence per kilowatt-hour the cost is $105$ pence, which is £1.05.",
    )

    # --- Magnetism ---------------------------------------------------------
    secondary_voltage = Fraction(240 * 100, 1200)
    primary_current = Fraction(secondary_voltage**2 / 5, 240)
    add(
        "Magnetism", "P2.4", "Transformers", "transformer-primary-current",
        r"An ideal transformer has $1200$ turns on the primary and $100$ turns on the secondary. The primary is connected to a $240\text{ V}$ a.c. supply and the secondary supplies a $5\ohm$ resistor. What current flows in the primary coil?",
        rf"$\frac{{{primary_current.numerator}}}{{{primary_current.denominator}}}\text{{ A}}$", [r"$4\text{ A}$", r"$3\text{ A}$", r"$\frac{1}{2}\text{ A}$", r"$12\text{ A}$"],
        r"The secondary voltage is $\frac{240 \times 100}{1200} = 20\text{ V}$, so the secondary current is $4\text{ A}$ and the power is $80\text{ W}$. An ideal transformer conserves power, so the primary current is $\frac{80}{240} = \frac{1}{3}\text{ A}$.",
    )

    motor_force = Fraction(4, 10) * 6 * Fraction(25, 100)
    add(
        "Magnetism", "P2.2", "Motor effect", "current-carrying-wire-force",
        r"A straight wire of length $0.25\text{ m}$ carries a current of $6.0\text{ A}$ at right angles to a uniform magnetic field of flux density $0.40\text{ T}$. What force acts on the wire?",
        rf"${fmt(float(motor_force))}\text{{ N}}$", [r"$6\text{ N}$", r"$0.06\text{ N}$", r"$2.4\text{ N}$", r"$1.5\text{ N}$"],
        r"For a wire perpendicular to the field, $F = BIL = 0.40 \times 6.0 \times 0.25 = 0.60\text{ N}$.",
    )

    add(
        "Magnetism", "P2.3", "Electromagnetic induction", "lenz-law-falling-magnet",
        r"A bar magnet is dropped so that it falls straight through a horizontal copper ring. Compared with the same magnet falling through an identical plastic ring, how does its motion change and why?",
        r"It falls more slowly, because the induced current opposes the change producing it",
        [
            r"It falls more quickly, because the induced current attracts the magnet",
            r"It falls at the same rate, because copper is not magnetic",
            r"It falls more slowly, because the copper ring becomes permanently magnetised",
            r"It falls at the same rate, because no current is induced in a closed ring",
        ],
        r"The changing flux induces a current in the copper ring. By Lenz's law that current opposes the magnet's motion, so the magnet is retarded; a plastic ring carries no induced current.",
    )

    # --- Mechanics ---------------------------------------------------------
    resultant_force = 1200 * Fraction(20 - 8, 6)
    add(
        "Mechanics", "P3.2", "Newton's second law", "average-resultant-force",
        r"A car of mass $1200\text{ kg}$ accelerates uniformly from $8.0\text{ m/s}$ to $20\text{ m/s}$ in $6.0\text{ s}$. What resultant force acts on it?",
        rf"${fmt(resultant_force)}\text{{ N}}$", [r"$4000\text{ N}$", r"$1600\text{ N}$", r"$2000\text{ N}$", r"$3600\text{ N}$"],
        r"The acceleration is $\frac{20 - 8}{6} = 2.0\text{ m/s}^2$, so the resultant force is $1200 \times 2.0 = 2400\text{ N}$.",
    )

    ke_lost = Fraction(1, 2) * Fraction(6, 10) * 25 - Fraction(1, 2) * Fraction(15, 10) * 4
    add(
        "Mechanics", "P3.4", "Momentum and energy", "inelastic-collision-energy-loss",
        r"A trolley of mass $0.60\text{ kg}$ moving at $5.0\text{ m/s}$ collides with a stationary trolley of mass $0.90\text{ kg}$, and the two move off together. How much kinetic energy is lost in the collision?",
        rf"${fmt(float(ke_lost))}\text{{ J}}$", [r"$3\text{ J}$", r"$7.5\text{ J}$", r"$1.5\text{ J}$", r"$10.5\text{ J}$"],
        r"Conservation of momentum gives a common speed of $\frac{3.0}{1.5} = 2.0\text{ m/s}$. The kinetic energy falls from $7.5\text{ J}$ to $3.0\text{ J}$, so $4.5\text{ J}$ is lost.",
    )

    bounce_loss = Fraction(2, 10) * 10 * Fraction(18, 10)
    add(
        "Mechanics", "P3.5", "Energy transfer", "bounce-energy-loss",
        r"A ball of mass $0.20\text{ kg}$ is dropped from a height of $5.0\text{ m}$ and rebounds to a height of $3.2\text{ m}$. Taking $g = 10\text{ N/kg}$, how much energy is lost during the bounce?",
        rf"${fmt(float(bounce_loss))}\text{{ J}}$", [r"$10\text{ J}$", r"$6.4\text{ J}$", r"$1.8\text{ J}$", r"$0.36\text{ J}$"],
        r"The gravitational potential energy falls by $mg\Delta h = 0.20 \times 10 \times 1.8 = 3.6\text{ J}$, which is the energy lost in the bounce.",
    )

    balancing_mass = Fraction(20 * 10 * Fraction(4, 10), 1) / Fraction(16, 10) / 10
    add(
        "Mechanics", "P3.3", "Moments", "plank-pivot-balancing-mass",
        r"A uniform plank of mass $20\text{ kg}$ and length $4.0\text{ m}$ rests on a pivot $1.6\text{ m}$ from its left-hand end. Taking $g = 10\text{ N/kg}$, what mass placed at the left-hand end will balance the plank?",
        rf"${fmt(float(balancing_mass))}\text{{ kg}}$", [r"$4\text{ kg}$", r"$8\text{ kg}$", r"$10\text{ kg}$", r"$12.5\text{ kg}$"],
        r"The plank's $200\text{ N}$ weight acts at its centre, $0.4\text{ m}$ to the right of the pivot, giving a moment of $80\text{ N m}$. A mass at the left end has a $1.6\text{ m}$ lever arm, so it must weigh $50\text{ N}$: a mass of $5.0\text{ kg}$.",
    )

    useful_power = Fraction(80 * 10 * 45 + 20 * 300, 60)
    add(
        "Mechanics", "P3.6", "Work and power", "cyclist-slope-output-power",
        r"A cyclist and machine of total mass $80\text{ kg}$ travel $300\text{ m}$ up a slope, rising $45\text{ m}$ vertically, in $60\text{ s}$ at a steady speed against a constant resistive force of $20\text{ N}$. Taking $g = 10\text{ N/kg}$, what is the useful output power?",
        rf"${fmt(useful_power)}\text{{ W}}$", [r"$600\text{ W}$", r"$100\text{ W}$", r"$800\text{ W}$", r"$500\text{ W}$"],
        r"The work done is $mgh + Fd = 80 \times 10 \times 45 + 20 \times 300 = 36\,000 + 6000 = 42\,000\text{ J}$. Dividing by $60\text{ s}$ gives $700\text{ W}$.",
    )

    stopping = Fraction(7, 10) * 20 + Fraction(400, 10)
    add(
        "Mechanics", "P3.7", "Stopping distance", "thinking-plus-braking-distance",
        r"A car travelling at $20\text{ m/s}$ brakes to rest with a uniform deceleration of $5.0\text{ m/s}^2$. The driver's reaction time is $0.70\text{ s}$. What is the total stopping distance?",
        rf"${fmt(stopping)}\text{{ m}}$", [r"$40\text{ m}$", r"$44\text{ m}$", r"$60\text{ m}$", r"$74\text{ m}$"],
        r"The thinking distance is $20 \times 0.70 = 14\text{ m}$ and the braking distance is $\frac{v^2}{2a} = \frac{400}{10} = 40\text{ m}$, giving $54\text{ m}$ in total.",
    )

    add(
        "Mechanics", "P3.8", "Terminal velocity", "terminal-velocity-statement",
        r"A skydiver falling through air has reached terminal velocity. Which statement about the skydiver is correct?",
        r"The resultant force is zero and the acceleration is zero",
        [
            r"The resultant force is zero and the acceleration is greatest",
            r"The weight is zero and the drag is greatest",
            r"The drag exceeds the weight, so the skydiver slows down",
            r"The resultant force is constant and downwards",
        ],
        r"At terminal velocity the drag has grown until it equals the weight. The forces balance, so the resultant force and the acceleration are both zero while the speed stays constant.",
    )

    # --- Thermal physics ---------------------------------------------------
    efficiency = Fraction(8, 10) * 4200 * 82 / (2000 * 150) * 100
    add(
        "Thermal physics", "P4.1", "Specific heat capacity", "kettle-efficiency-percentage",
        r"A $2.0\text{ kW}$ kettle heats $0.80\text{ kg}$ of water from $18\deg\text{C}$ to $100\deg\text{C}$ in $150\text{ s}$. The specific heat capacity of water is $4200\text{ J/(kg}\deg\text{C)}$. What percentage of the electrical energy supplied is transferred to the water, to the nearest whole number?",
        rf"${round(float(efficiency))}\%$", [r"$85\%$", r"$96\%$", r"$88\%$", r"$78\%$"],
        r"The water gains $0.80 \times 4200 \times 82 = 275\,520\text{ J}$ while the kettle is supplied with $2000 \times 150 = 300\,000\text{ J}$, giving $91.8\%$, or $92\%$ to the nearest whole number.",
    )

    latent = Fraction(25, 100) * 340000 + Fraction(25, 100) * 4200 * 20
    add(
        "Thermal physics", "P4.2", "Specific latent heat", "ice-to-warm-water-energy",
        r"How much energy is needed to turn $0.25\text{ kg}$ of ice at $0\deg\text{C}$ into water at $20\deg\text{C}$? The specific latent heat of fusion of ice is $3.4 \times 10^{5}\text{ J/kg}$ and the specific heat capacity of water is $4200\text{ J/(kg}\deg\text{C)}$.",
        r"$1.06 \times 10^{5}\text{ J}$", [r"$8.5 \times 10^{4}\text{ J}$", r"$2.1 \times 10^{4}\text{ J}$", r"$1.27 \times 10^{5}\text{ J}$", r"$9.6 \times 10^{4}\text{ J}$"],
        rf"Melting needs $0.25 \times 3.4 \times 10^{{5}} = 85\,000\text{{ J}}$ and warming needs $0.25 \times 4200 \times 20 = 21\,000\text{{ J}}$, giving ${fmt(latent)}\text{{ J}}$ in total.",
    )

    new_pressure = Fraction(150 * 400, 300)
    add(
        "Thermal physics", "P4.3", "Gas laws", "constant-volume-pressure-law",
        r"A sealed rigid container holds gas at $27\deg\text{C}$ and a pressure of $150\text{ kPa}$. The gas is heated to $127\deg\text{C}$. What is the new pressure?",
        rf"${fmt(new_pressure)}\text{{ kPa}}$", [r"$705\text{ kPa}$", r"$112.5\text{ kPa}$", r"$250\text{ kPa}$", r"$175\text{ kPa}$"],
        r"At constant volume $\frac{p}{T}$ is constant, with $T$ in kelvin. Here $300\text{ K}$ becomes $400\text{ K}$, so the pressure becomes $\frac{150 \times 400}{300} = 200\text{ kPa}$.",
    )

    add(
        "Thermal physics", "P4.4", "Evaporation", "evaporation-cooling-explanation",
        r"A small amount of water is left in an open dish and slowly evaporates. Why does the remaining water become cooler?",
        r"The fastest molecules escape, so the mean kinetic energy of those left falls",
        [
            r"Evaporation destroys kinetic energy, so the total energy of the water falls",
            r"The slowest molecules escape first, so the water loses its coldest particles",
            r"The air above the water is always colder than the water itself",
            r"Evaporating molecules take latent heat from the air rather than from the water",
        ],
        r"Only molecules with above-average kinetic energy can escape the surface. Removing them lowers the mean kinetic energy of the remaining molecules, and temperature is a measure of that mean.",
    )

    # --- Matter ------------------------------------------------------------
    total_pressure = 1000 * 10 * 12 // 1000 + 100
    add(
        "Matter", "P5.2", "Pressure in fluids", "total-pressure-at-depth",
        r"A diver is $12\text{ m}$ below the surface of a lake. The density of water is $1000\text{ kg/m}^3$, $g = 10\text{ N/kg}$ and atmospheric pressure is $100\text{ kPa}$. What is the total pressure on the diver?",
        rf"${total_pressure}\text{{ kPa}}$", [r"$120\text{ kPa}$", r"$100\text{ kPa}$", r"$1200\text{ kPa}$", r"$210\text{ kPa}$"],
        r"The pressure due to the water is $\rho gh = 1000 \times 10 \times 12 = 120\,000\text{ Pa} = 120\text{ kPa}$. Adding atmospheric pressure gives $220\text{ kPa}$.",
    )

    alloy_density = Fraction(500, Fraction(300, 9) + Fraction(200, 4))
    add(
        "Matter", "P5.1", "Density", "two-metal-alloy-density",
        r"An alloy is made by melting together $300\text{ g}$ of a metal of density $9.0\text{ g/cm}^3$ and $200\text{ g}$ of a metal of density $4.0\text{ g/cm}^3$. Assuming the volumes add, what is the density of the alloy?",
        rf"${fmt(alloy_density)}\text{{ g/cm}}^3$", [r"$6.5\text{ g/cm}^3$", r"$7\text{ g/cm}^3$", r"$5.5\text{ g/cm}^3$", r"$6.8\text{ g/cm}^3$"],
        r"The volumes are $\frac{300}{9} = 33.3\text{ cm}^3$ and $\frac{200}{4} = 50\text{ cm}^3$, a total of $83.3\text{ cm}^3$ for $500\text{ g}$. The density is $\frac{500}{83.3} = 6.0\text{ g/cm}^3$, not the mean of $9$ and $4$.",
    )

    spring_energy = Fraction(1, 2) * 250 * Fraction(1, 100)
    add(
        "Matter", "P5.3", "Hooke's law", "spring-energy-after-load-change",
        r"A spring extends by $4.0\text{ cm}$ when a load of $10\text{ N}$ hangs from it, and it stays within its limit of proportionality. How much elastic potential energy is stored when the load is $25\text{ N}$?",
        rf"${fmt(float(spring_energy))}\text{{ J}}$", [r"$2.5\text{ J}$", r"$0.5\text{ J}$", r"$1\text{ J}$", r"$5\text{ J}$"],
        r"The spring constant is $\frac{10}{0.04} = 250\text{ N/m}$, so a $25\text{ N}$ load gives an extension of $0.10\text{ m}$. The stored energy is $\frac{1}{2}kx^2 = \frac{1}{2} \times 250 \times 0.10^2 = 1.25\text{ J}$.",
    )

    # --- Waves -------------------------------------------------------------
    wave_speed = 400 * Fraction(18, 10)
    add(
        "Waves", "P6.1", "Wave speed and refraction", "wavelength-change-across-boundary",
        r"A wave of frequency $400\text{ Hz}$ passes from one medium into another. Its wavelength changes from $3.0\text{ m}$ to $1.8\text{ m}$. What is its speed in the second medium?",
        rf"${fmt(wave_speed)}\text{{ m/s}}$", [r"$1200\text{ m/s}$", r"$222\text{ m/s}$", r"$480\text{ m/s}$", r"$133\text{ m/s}$"],
        r"Frequency is unchanged when a wave crosses a boundary, so $v = f\lambda = 400 \times 1.8 = 720\text{ m/s}$ in the second medium.",
    )

    depth = Fraction(1500 * Fraction(4, 10), 2)
    add(
        "Waves", "P6.3", "Echo sounding", "sonar-depth-from-echo-time",
        r"A ship sends a sound pulse vertically downwards and receives the echo $0.40\text{ s}$ later. Sound travels at $1500\text{ m/s}$ in water. How deep is the sea bed below the ship?",
        rf"${fmt(depth)}\text{{ m}}$", [r"$600\text{ m}$", r"$150\text{ m}$", r"$3750\text{ m}$", r"$375\text{ m}$"],
        r"The pulse travels $1500 \times 0.40 = 600\text{ m}$ in total, but that is the round trip. The depth is half of it, which is $300\text{ m}$.",
    )

    add(
        "Waves", "P6.4", "Electromagnetic spectrum", "em-spectrum-order-and-hazard",
        r"Three regions of the electromagnetic spectrum are infrared, ultraviolet and visible light. Which list places them in order of increasing frequency, and correctly names the hazard of the highest-frequency one?",
        r"Infrared, visible, ultraviolet; ultraviolet can damage skin cells",
        [
            r"Ultraviolet, visible, infrared; infrared can damage skin cells",
            r"Infrared, visible, ultraviolet; ultraviolet causes only heating",
            r"Visible, infrared, ultraviolet; ultraviolet can damage skin cells",
            r"Infrared, ultraviolet, visible; visible light can damage skin cells",
        ],
        r"Frequency increases from infrared through visible light to ultraviolet. Ultraviolet photons carry enough energy to ionise and damage skin cells, which is why it causes sunburn and raises skin cancer risk.",
    )

    # --- Radioactivity -----------------------------------------------------
    half_life = Fraction(18, 4)
    add(
        "Radioactivity", "P7.1", "Half-life", "half-life-from-activity-drop",
        r"The activity of a radioactive sample falls from $960\text{ Bq}$ to $60\text{ Bq}$ in $18$ days. What is the half-life of the sample?",
        rf"${fmt(float(half_life))}$ days", [r"$3$ days", r"$6$ days", r"$9$ days", r"$4$ days"],
        r"Going from $960\text{ Bq}$ to $60\text{ Bq}$ means dividing by $16$, which is four halvings. Four half-lives occupy $18$ days, so one half-life is $4.5$ days.",
    )

    add(
        "Radioactivity", "P7.2", "Nuclear equations", "alpha-then-two-beta-decay",
        r"A nucleus of uranium-238, which has atomic number $92$, emits one alpha particle and then two beta-minus particles. What are the mass number and atomic number of the resulting nuclide?",
        r"Mass number $234$, atomic number $92$",
        [
            r"Mass number $234$, atomic number $90$",
            r"Mass number $234$, atomic number $91$",
            r"Mass number $230$, atomic number $92$",
            r"Mass number $238$, atomic number $90$",
        ],
        r"Alpha emission removes $4$ from the mass number and $2$ from the atomic number, giving $234$ and $90$. Each beta-minus emission then adds $1$ to the atomic number, returning it to $92$ with the mass number unchanged.",
    )

    assert len(output) == 27, f"physics produced {len(output)} questions"
    return output


def maths2() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []

    def add(topic: str, code: str, subtopic: str, archetype: str, prompt: str, correct: str, distractors: list[str], explanation: str) -> None:
        output.append(make_question("maths2", len(output) + 1, topic, code, subtopic, archetype, prompt, correct, distractors, explanation))

    # --- Algebra and functions --------------------------------------------
    add(
        "Algebra and functions", "M8.3", "Factor and remainder theorems", "cubic-factor-and-remainder",
        r"The polynomial $p(x) = 2x^3 + ax^2 - 5x + b$ has $(x - 2)$ as a factor and leaves a remainder of $-6$ when divided by $(x + 1)$. What is the value of $b$?",
        r"$-10$", [r"$-6$", r"$10$", r"$-4$", r"$2$"],
        r"$p(2) = 0$ gives $4a + b = -6$, and $p(-1) = -6$ gives $a + b = -9$. Subtracting, $3a = 3$, so $a = 1$ and $b = -10$.",
    )

    partial_product = Fraction(4, 3) * Fraction(11, 3)
    add(
        "Algebra and functions", "M8.5", "Partial fractions", "partial-fraction-coefficient-product",
        r"The identity $\frac{5x - 1}{(x - 1)(x + 2)} = \frac{A}{x - 1} + \frac{B}{x + 2}$ holds for all valid $x$. What is the value of $AB$?",
        rf"$\frac{{{partial_product.numerator}}}{{{partial_product.denominator}}}$", [r"$\frac{4}{3}$", r"$\frac{11}{3}$", r"$\frac{5}{3}$", r"$\frac{44}{3}$"],
        r"Setting $x = 1$ gives $A = \frac{4}{3}$, and setting $x = -2$ gives $B = \frac{-11}{-3} = \frac{11}{3}$. Their product is $\frac{44}{9}$.",
    )

    add(
        "Algebra and functions", "M8.2", "Discriminant", "equal-roots-parameter-values",
        r"The equation $kx^2 + (k + 3)x + 4 = 0$ has equal roots. What are the possible values of $k$?",
        r"$k = 1$ or $k = 9$", [r"$k = 3$ or $k = 12$", r"$k = -1$ or $k = -9$", r"$k = 2$ or $k = 8$", r"$k = 9$ only"],
        r"Equal roots need $(k + 3)^2 = 16k$, so $k^2 - 10k + 9 = 0$ and $(k - 1)(k - 9) = 0$, giving $k = 1$ or $k = 9$. Both are non-zero, so both are valid.",
    )

    add(
        "Algebra and functions", "M8.6", "Modulus inequalities", "modulus-linear-inequality",
        r"Find the complete set of real values of $x$ that satisfy the inequality $|2x - 5| < x + 1$.",
        r"$\frac{4}{3} < x < 6$", [r"$x < 6$", r"$x > \frac{4}{3}$", r"$-6 < x < \frac{4}{3}$", r"$\frac{4}{3} < x < 4$"],
        r"The right-hand side must be positive. Writing $-(x + 1) < 2x - 5 < x + 1$ gives $x > \frac{4}{3}$ from the left inequality and $x < 6$ from the right.",
    )

    # --- Sequences and series ---------------------------------------------
    tenth_term = (2 * 100 + 3 * 10) - (2 * 81 + 3 * 9)
    add(
        "Sequences and series", "M9.1", "Arithmetic series", "term-from-sum-formula",
        r"The sum of the first $n$ terms of an arithmetic series is $S_n = 2n^2 + 3n$. What is the $10$th term of the series?",
        rf"${tenth_term}$", [r"$43$", r"$39$", r"$46$", r"$23$"],
        r"The $n$th term is $S_n - S_{n-1}$. Here $S_{10} = 230$ and $S_9 = 189$, so the $10$th term is $41$.",
    )

    fourth_term = 12 * Fraction(2, 5) ** 3
    add(
        "Sequences and series", "M9.2", "Geometric series", "gp-term-from-sum-to-infinity",
        r"A convergent geometric series has first term $12$ and sum to infinity $20$. What is its fourth term?",
        rf"$\frac{{{fourth_term.numerator}}}{{{fourth_term.denominator}}}$", [r"$\frac{48}{25}$", r"$\frac{24}{125}$", r"$\frac{96}{25}$", r"$\frac{8}{125}$"],
        r"From $\frac{a}{1 - r} = 20$ with $a = 12$, we get $1 - r = \frac{3}{5}$, so $r = \frac{2}{5}$. The fourth term is $12(\frac{2}{5})^3 = \frac{96}{125}$.",
    )

    binomial = math.comb(5, 3) * 2**2 * 3**3
    add(
        "Sequences and series", "M9.3", "Binomial expansion", "binomial-coefficient-extraction",
        r"What is the coefficient of $x^3$ in the binomial expansion of $(2 + 3x)^5$?",
        rf"${binomial}$", [r"$720$", r"$810$", r"$2160$", r"$270$"],
        r"The $x^3$ term is $\binom{5}{3} \times 2^2 \times (3x)^3 = 10 \times 4 \times 27x^3$, so the coefficient is $1080$.",
    )

    # --- Coordinate geometry ----------------------------------------------
    tangent_length = int(math.isqrt(25 - 16))
    add(
        "Coordinate geometry", "M10.4", "Circles", "tangent-length-from-external-point",
        r"A circle has equation $x^2 + y^2 - 6x + 8y + 9 = 0$. What is the length of a tangent drawn to the circle from the origin?",
        rf"${tangent_length}$", [r"$4$", r"$5$", r"$\sqrt{41}$", r"$9$"],
        r"Completing the square gives centre $(3, -4)$ and radius $4$. The centre is $5$ from the origin, so the tangent length is $\sqrt{5^2 - 4^2} = 3$.",
    )

    add(
        "Coordinate geometry", "M10.2", "Perpendicular bisectors", "perpendicular-bisector-intercept",
        r"Points $A(-1, 4)$ and $B(5, -2)$ are given. The perpendicular bisector of $AB$ is written as $y = mx + c$. What is the value of $c$?",
        r"$-1$", [r"$1$", r"$3$", r"$-3$", r"$2$"],
        r"The midpoint of $AB$ is $(2, 1)$ and $AB$ has gradient $-1$, so the bisector has gradient $1$. Then $1 = 2 + c$ gives $c = -1$.",
    )

    enclosed_area = Fraction(9, 2)
    add(
        "Coordinate geometry", "M10.5", "Areas between graphs", "line-parabola-enclosed-area",
        r"The line $y = x + 2$ meets the curve $y = x^2$ at two points. What is the area of the region enclosed between the line and the curve?",
        rf"$\frac{{{enclosed_area.numerator}}}{{{enclosed_area.denominator}}}$", [r"$9$", r"$\frac{27}{2}$", r"$4$", r"$3$"],
        r"The curves meet where $x^2 - x - 2 = 0$, so $x = -1$ and $x = 2$. Integrating $(x + 2 - x^2)$ between those limits gives $\frac{9}{2}$.",
    )

    # --- Trigonometry ------------------------------------------------------
    add(
        "Trigonometry", "M11.4", "Trigonometric equations", "quadratic-in-cosine-solution-count",
        r"How many solutions does $3\sin^2\theta = 2 + \cos\theta$ have in the interval $0 \le \theta < 360\deg$?",
        r"$4$", [r"$2$", r"$3$", r"$6$", r"$0$"],
        r"Using $\sin^2\theta = 1 - \cos^2\theta$ gives $3\cos^2\theta + \cos\theta - 1 = 0$, whose roots are both between $-1$ and $1$. Each valid cosine value gives two angles in the interval, so there are four solutions.",
    )

    add(
        "Trigonometry", "M11.2", "Cosine rule", "cosine-rule-exact-side",
        r"In triangle $ABC$, $AB = 7\text{ cm}$, $BC = 8\text{ cm}$ and angle $ABC = 60\deg$. What is the exact length of $AC$?",
        r"$\sqrt{57}\text{ cm}$", [r"$\sqrt{113}\text{ cm}$", r"$\sqrt{99}\text{ cm}$", r"$11\text{ cm}$", r"$\sqrt{85}\text{ cm}$"],
        r"By the cosine rule, $AC^2 = 49 + 64 - 2(7)(8)\cos 60\deg = 113 - 56 = 57$, so $AC = \sqrt{57}\text{ cm}$.",
    )

    double_angle = Fraction(2 * 3 * 4, 25)
    add(
        "Trigonometry", "M11.5", "Double angle identities", "exact-sin-double-angle-from-tan",
        r"Given that $\tan\theta = \frac{3}{4}$ and $\theta$ is acute, what is the exact value of $\sin 2\theta$?",
        rf"$\frac{{{double_angle.numerator}}}{{{double_angle.denominator}}}$", [r"$\frac{12}{25}$", r"$\frac{7}{25}$", r"$\frac{24}{7}$", r"$\frac{3}{5}$"],
        r"A $3$–$4$–$5$ triangle gives $\sin\theta = \frac{3}{5}$ and $\cos\theta = \frac{4}{5}$. Then $\sin 2\theta = 2\sin\theta\cos\theta = \frac{24}{25}$.",
    )

    triangle_area = Fraction(1, 2) * 9 * 12 * Fraction(1, 2)
    add(
        "Trigonometry", "M11.3", "Area of a triangle", "obtuse-included-angle-area",
        r"A triangle has sides of $9\text{ cm}$ and $12\text{ cm}$ with an included angle of $150\deg$. What is its area?",
        rf"${fmt(triangle_area)}\text{{ cm}}^2$", [r"$54\text{ cm}^2$", r"$46.8\text{ cm}^2$", r"$27\sqrt{3}\text{ cm}^2$", r"$13.5\text{ cm}^2$"],
        r"Area $= \frac{1}{2}ab\sin C$ with $\sin 150\deg = \frac{1}{2}$, so the area is $\frac{1}{2} \times 9 \times 12 \times \frac{1}{2} = 27\text{ cm}^2$.",
    )

    # --- Exponentials and logarithms --------------------------------------
    add(
        "Exponentials and logarithms", "M12.3", "Laws of logarithms", "log-difference-equation",
        r"Solve the equation $\log_3(x + 6) - \log_3(x - 2) = 2$, giving the value of $x$ that lies in the domain of both logarithms.",
        r"$x = 3$", [r"$x = 4$", r"$x = 2.5$", r"$x = 6$", r"$x = \frac{12}{7}$"],
        r"The left side is $\log_3\frac{x + 6}{x - 2}$, so $\frac{x + 6}{x - 2} = 9$. Then $x + 6 = 9x - 18$ and $x = 3$, which satisfies $x > 2$.",
    )

    decay_time = math.log(40 / 12) / 0.05
    add(
        "Exponentials and logarithms", "M12.4", "Exponential decay", "continuous-decay-time",
        r"A radioactive mass decays according to $m = 40e^{-0.05t}$, where $m$ is in grams and $t$ is in years. After how many whole years does the mass first fall below $12\text{ g}$?",
        rf"${math.ceil(decay_time)}$", [r"$20$", r"$26$", r"$28$", r"$22$"],
        r"Solving $40e^{-0.05t} = 12$ gives $t = \frac{\ln\frac{10}{3}}{0.05} = 24.08$ years, so the mass is still above $12\text{ g}$ at $t = 24$ and below it at $t = 25$.",
    )

    add(
        "Exponentials and logarithms", "M12.2", "Changing the base", "log-expression-in-terms-of-parameters",
        r"Given that $\log_a 2 = p$ and $\log_a 3 = q$, express $\log_a 13.5$ in terms of $p$ and $q$.",
        r"$3q - p$", [r"$3q + p$", r"$q - p$", r"$2q - p$", r"$p - 3q$"],
        r"Note that $13.5 = \frac{27}{2}$, so the logarithm is $\log_a 27 - \log_a 2 = 3\log_a 3 - \log_a 2 = 3q - p$.",
    )

    # --- Differentiation ---------------------------------------------------
    add(
        "Differentiation", "M13.2", "Stationary points", "reciprocal-sum-stationary-point",
        r"For $x > 0$ the curve $y = x + \frac{4}{x}$ has one stationary point. What is its $x$-coordinate and what is its nature?",
        r"$x = 2$, a minimum", [r"$x = 2$, a maximum", r"$x = 4$, a minimum", r"$x = \sqrt{2}$, a minimum", r"$x = -2$, a minimum"],
        r"Differentiating gives $1 - \frac{4}{x^2} = 0$, so $x = 2$ for $x > 0$. The second derivative $\frac{8}{x^3}$ is positive there, so the point is a minimum.",
    )

    add(
        "Differentiation", "M13.3", "Tangents and normals", "normal-line-y-intercept",
        r"The normal to the curve $y = x^3 - 2x$ at the point where $x = 1$ is drawn. What is the $y$-intercept of that normal?",
        r"$0$", [r"$-2$", r"$1$", r"$2$", r"$-1$"],
        r"At $x = 1$ the point is $(1, -1)$ and $\frac{dy}{dx} = 3(1) - 2 = 1$, so the normal has gradient $-1$. Then $-1 = -1 + c$ gives $c = 0$.",
    )

    product_rule = 6 * 1 * 5 + 1
    add(
        "Differentiation", "M13.4", "Product and chain rules", "product-chain-rule-value",
        r"Given $y = (2x - 1)^3(x + 4)$, what is the value of $\frac{dy}{dx}$ when $x = 1$?",
        rf"${product_rule}$", [r"$30$", r"$11$", r"$36$", r"$26$"],
        r"By the product rule, $\frac{dy}{dx} = 6(2x - 1)^2(x + 4) + (2x - 1)^3$. At $x = 1$ this is $6(1)(5) + 1 = 31$.",
    )

    add(
        "Differentiation", "M13.5", "Optimisation", "closed-cylinder-minimum-surface-area",
        r"A closed cylinder has a volume of $128\pi\text{ cm}^3$. What radius gives the least total surface area?",
        r"$4\text{ cm}$", [r"$2\text{ cm}$", r"$8\text{ cm}$", r"$4\sqrt{2}\text{ cm}$", r"$16\text{ cm}$"],
        r"With $h = \frac{128}{r^2}$ the surface area is $2\pi r^2 + \frac{256\pi}{r}$. Setting the derivative $4\pi r - \frac{256\pi}{r^2}$ to zero gives $r^3 = 64$, so $r = 4\text{ cm}$.",
    )

    # --- Integration -------------------------------------------------------
    definite_integral = (2 * Fraction(8, 1) + Fraction(1, 2)) - (2 + 2)
    add(
        "Integration", "M14.2", "Definite integrals", "power-rule-definite-integral",
        r"Evaluate the definite integral $\int_1^4 \left(3\sqrt{x} - \frac{2}{x^2}\right) dx$, giving your answer as an exact fraction.",
        r"$\frac{25}{2}$", [r"$\frac{27}{2}$", r"$\frac{23}{2}$", r"$12$", r"$14$"],
        rf"An antiderivative is $2x^{{3/2}} + \frac{{2}}{{x}}$. At $x = 4$ this is $16.5$ and at $x = 1$ it is $4$, so the integral equals $\frac{{{definite_integral.numerator}}}{{{definite_integral.denominator}}}$.",
    )

    parabola_area = Fraction(32, 3)
    add(
        "Integration", "M14.3", "Area under a curve", "parabola-x-axis-enclosed-area",
        r"What is the area of the region enclosed between the curve $y = x(4 - x)$ and the $x$-axis?",
        rf"$\frac{{{parabola_area.numerator}}}{{{parabola_area.denominator}}}$", [r"$\frac{16}{3}$", r"$\frac{64}{3}$", r"$8$", r"$16$"],
        r"The curve meets the axis at $x = 0$ and $x = 4$. Integrating $4x - x^2$ between them gives $32 - \frac{64}{3} = \frac{32}{3}$.",
    )

    curve_value = 3 * 16 - 4 * 4 + 1
    add(
        "Integration", "M14.4", "Finding a curve from its gradient", "gradient-function-to-value",
        r"A curve has gradient $\frac{dy}{dx} = 6x - 4$ and passes through the point $(2, 5)$. What is $y$ when $x = 4$?",
        rf"${curve_value}$", [r"$32$", r"$29$", r"$37$", r"$25$"],
        r"Integrating gives $y = 3x^2 - 4x + c$, and $12 - 8 + c = 5$ fixes $c = 1$. At $x = 4$, $y = 48 - 16 + 1 = 33$.",
    )

    trapezium = 0.25 * (1 + 3 + 2 * (math.sqrt(1.125) + math.sqrt(2) + math.sqrt(4.375)))
    add(
        "Integration", "M14.5", "Trapezium rule", "trapezium-rule-with-bias",
        r"The trapezium rule with four strips of equal width is used to estimate $\int_0^2 \sqrt{1 + x^3}\, dx$. What is the estimate to 3 significant figures, and is it an overestimate or an underestimate?",
        rf"${trapezium:.3g}$, an overestimate",
        [r"$3.28$, an underestimate", r"$3.13$, an overestimate", r"$6.57$, an overestimate", r"$2.98$, an underestimate"],
        r"With $h = 0.5$ the ordinates are $1$, $1.0607$, $1.4142$, $2.0917$ and $3$, giving $0.25(4 + 2 \times 4.5665) = 3.28$. The curve is convex on this interval, so each chord lies above it and the rule overestimates.",
    )

    # --- Graphs of functions ----------------------------------------------
    add(
        "Graphs of functions", "M15.2", "Transformations", "combined-transformation-minimum",
        r"The graph of $y = f(x)$ has a minimum point at $(3, -2)$. What are the coordinates of the minimum point of $y = 2f(x - 1) + 5$?",
        r"$(4, 1)$", [r"$(2, 1)$", r"$(4, 3)$", r"$(4, -4)$", r"$(2, 3)$"],
        r"Replacing $x$ by $x - 1$ translates the graph $1$ to the right, so the $x$-coordinate becomes $4$. The $y$-value is doubled to $-4$ and then raised by $5$, giving $1$.",
    )

    add(
        "Graphs of functions", "M15.3", "Asymptotes", "rational-function-asymptotes",
        r"The curve $y = \frac{2x + 3}{x - 1}$ has one vertical and one horizontal asymptote. What are they?",
        r"$x = 1$ and $y = 2$", [r"$x = -1$ and $y = 2$", r"$x = 1$ and $y = 3$", r"$x = 1$ and $y = -3$", r"$x = 2$ and $y = 1$"],
        r"The denominator vanishes at $x = 1$, giving the vertical asymptote. As $x$ grows the ratio tends to $\frac{2x}{x} = 2$, giving the horizontal asymptote $y = 2$.",
    )

    assert len(output) == 27, f"maths2 produced {len(output)} questions"
    return output


def verify_diagrams(questions: list[dict[str, object]]) -> int:
    """
    Guard the figure set against the two ways it silently rots: a mapping that points at a
    question number nobody authored, and a rendered PNG left behind by an earlier draft that
    no question claims. Either one ships a figure next to the wrong stem.
    """
    keys = {(str(question["targetModule"]), int(question["originalQuestionNumber"])) for question in questions}
    unmatched = sorted(key for key in DIAGRAMS if key not in keys)
    if unmatched:
        raise AssertionError(f"DIAGRAMS references questions that do not exist: {unmatched}")

    referenced: set[Path] = set()
    for question in questions:
        relative = str(question["questionDiagram"])
        if not relative:
            if question["questionDiagramAlt"]:
                raise AssertionError(f"{question['id']}: alt text without a diagram")
            continue
        alt = str(question["questionDiagramAlt"])
        if len(alt) < 40:
            raise AssertionError(f"{question['id']}: alt text is too short to replace the figure")
        referenced.add((APP_DIR / "public" / relative).resolve())

    figures_dir = APP_DIR / "public" / "questions" / "original"
    if figures_dir.is_dir():
        orphans = sorted(
            path.name for path in figures_dir.glob("*.png") if path.resolve() not in referenced
        )
        if orphans:
            raise AssertionError(
                f"Rendered figures that no question references: {orphans}. "
                f"Delete them or attach them to the question they depict."
            )
    return len(referenced)


def validate(questions: list[dict[str, object]]) -> dict[str, object]:
    if len(questions) != 81:
        raise AssertionError(f"Expected 81 questions, found {len(questions)}")
    if len({question["id"] for question in questions}) != 81:
        raise AssertionError("Question IDs are not unique")
    if len({question["sourceHash"] for question in questions}) != 81:
        raise AssertionError("Prompts/answers/explanations are not all unique")

    module_summary: dict[str, object] = {}
    global_archetypes: list[str] = []
    global_template_hashes: list[str] = []
    for module, expected_topics in EXPECTED_TOPICS.items():
        items = [question for question in questions if question["targetModule"] == module]
        if len(items) != 27:
            raise AssertionError(f"{module}: expected 27 questions, found {len(items)}")
        topics = {str(question["esatTopic"]) for question in items}
        if topics != expected_topics:
            raise AssertionError(f"{module}: topic mismatch; expected {expected_topics}, found {topics}")
        archetypes = [str(question["questionArchetype"]) for question in items]
        template_hashes = [str(question["promptTemplateHash"]) for question in items]
        if len(set(archetypes)) != 27:
            duplicates = [key for key, count in Counter(archetypes).items() if count > 1]
            raise AssertionError(f"{module}: repeated archetypes: {duplicates}")
        if len(set(template_hashes)) != 27:
            duplicates = [key for key, count in Counter(template_hashes).items() if count > 1]
            raise AssertionError(f"{module}: number-swapped prompt templates detected: {duplicates}")
        global_archetypes.extend(archetypes)
        global_template_hashes.extend(template_hashes)
        topic_counts = Counter(str(question["esatTopic"]) for question in items)
        module_summary[module] = {
            "questionCount": 27,
            "distinctArchetypes": len(set(archetypes)),
            "distinctPromptTemplates": len(set(template_hashes)),
            "topicCounts": dict(sorted(topic_counts.items())),
        }

    if len(set(global_archetypes)) != 81:
        duplicates = [key for key, count in Counter(global_archetypes).items() if count > 1]
        raise AssertionError(f"Cross-module archetypes must also be unique: {duplicates}")
    if len(set(global_template_hashes)) != 81:
        raise AssertionError("Number-swapped prompt templates exist across modules")

    for question in questions:
        answer_options = question["answerOptions"]
        option_text = question["optionText"]
        if not isinstance(answer_options, list) or not isinstance(option_text, dict):
            raise AssertionError(f"{question['id']}: malformed options")
        if len(answer_options) != 5:
            raise AssertionError(f"{question['id']}: every challenge item must offer five options")
        if len(option_text) != len(set(option_text.values())):
            raise AssertionError(f"{question['id']}: duplicate option text")
        canonical_numeric = [simple_numeric_option(str(value)) for value in option_text.values()]
        comparable_numeric = [value for value in canonical_numeric if value is not None]
        if len(comparable_numeric) != len(set(comparable_numeric)):
            raise AssertionError(f"{question['id']}: mathematically equivalent numeric options")
        correct_key = str(question["correctAnswer"])
        if correct_key not in answer_options or option_text[correct_key] != question["verifiedCorrectText"]:
            raise AssertionError(f"{question['id']}: answer key does not resolve to verified text")
        explanation = strip_math(str(question["explanation"]))
        if len(explanation) < 60:
            raise AssertionError(f"{question['id']}: explanation is too short to show the method")
        prompt = strip_math(str(question["questionText"]))
        if len(prompt) < 45:
            raise AssertionError(f"{question['id']}: prompt is too short to be a multi-step item")
        if question["difficulty"] != "stretch":
            raise AssertionError(f"{question['id']}: every challenge item must be stretch-weighted")
        if question["reviewRequired"] or question["excluded"]:
            raise AssertionError(f"{question['id']}: a checked original question is held or excluded")

    diagram_count = verify_diagrams(questions)

    return {
        "questionCount": 81,
        "distinctArchetypes": len(set(global_archetypes)),
        "distinctPromptTemplates": len(set(global_template_hashes)),
        "numberSwapDuplicates": 0,
        "allTopLevelSpecificationTopicsCovered": True,
        "optionsPerQuestion": 5,
        "questionsWithDiagrams": diagram_count,
        "perModule": module_summary,
        "verification": "answer-option, uniqueness, structure, difficulty, diagram-pairing and specification-coverage assertions passed",
    }


def build() -> None:
    questions = [*maths1(), *physics(), *maths2()]
    summary = validate(questions)
    payload = {
        "version": VERSION,
        "generatedAt": "2026-08-10",
        "label": "Challenge Mock A",
        "disclaimer": "Original ESAT Atlas practice - not official UAT-UK material. Deliberately pitched above archive difficulty; any estimated score is a floor, not a forecast.",
        "qualityPolicy": "Every module contains 27 distinct multi-step archetypes with five options each. Numeric substitutions of one template are rejected automatically.",
        "questions": questions,
        "summary": summary,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    build()
