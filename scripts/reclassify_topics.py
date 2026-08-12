"""Re-label archive questions onto the ESAT 2026 specification topic taxonomy.

Why this exists
---------------
The original bank builder classified every mathematics question with one GCSE-level
topic list and picked the first rule whose keyword appeared anywhere in the OCR text.
That produced two defects:

  1. Mathematics 2 is A-level content (TMUA Paper 1 and NSAA Part E) but was labelled
     with the Mathematics 1 vocabulary, so it had no Differentiation, Integration,
     Coordinate geometry or Trigonometry at all - 159 of its 249 questions landed in
     "Geometry".
  2. Matching was on raw substrings and first-rule-wins, so a single incidental token
     decided the label and later, more specific rules never got a chance.

This script re-labels from the stored OCR text using one taxonomy per module - the same
taxonomy the original mocks use, so the topic breakdown compares like with like - and
scores every topic by how many distinct whole-word keywords it matches rather than
stopping at the first hit. It rewrites only esatTopic and esatSubtopic; images, answers,
hashes and provenance are untouched.

Keyword classification of OCR text remains a heuristic. Labels are a study aid, not a
claim about the official specification mapping of any individual question.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
BANK = APP_DIR / "public" / "data" / "question-bank.json"

# (topic, subtopic, keywords). Keywords are matched on whole-word boundaries.
MATHS1_TOPICS = [
    ("Probability", "Combined events and counting", ("probability", "probabilities", "random", "dice", "die", "coin", "counter", "counters", "outcome", "outcomes", "replacement")),
    ("Statistics", "Data, averages and spread", ("mean", "median", "mode", "histogram", "frequency", "quartile", "interquartile", "cumulative", "average", "spread")),
    ("Ratio and proportion", "Rates and proportional change", ("ratio", "percentage", "percent", "proportion", "proportional", "rate", "scale", "interest", "share", "shared")),
    ("Units", "Compound units and conversion", ("units", "unit", "convert", "conversion", "density", "pressure", "kilometres", "litres", "grams")),
    ("Geometry", "Shape, measure and trigonometry", ("triangle", "triangles", "circle", "circles", "angle", "angles", "polygon", "sphere", "cylinder", "cone", "cuboid", "pyramid", "area", "volume", "perimeter", "radius", "diameter", "arc", "sector", "tangent", "bearing", "bearings", "similar", "congruent", "pythagoras")),
    ("Algebra", "Expressions, equations and sequences", ("equation", "equations", "solve", "quadratic", "expand", "factorise", "simplify", "inequality", "inequalities", "sequence", "sequences", "term", "expression", "graph", "gradient", "roots", "root")),
    ("Number", "Number, surds and standard form", ("surd", "surds", "sqrt", "integer", "integers", "prime", "primes", "fraction", "fractions", "decimal", "recurring", "standard form", "indices", "index", "bound", "bounds", "significant")),
]

MATHS2_TOPICS = [
    ("Differentiation", "Rates of change and stationary points", ("differentiate", "differentiation", "derivative", "dy", "stationary", "turning point", "tangent", "normal", "maximum", "minimum", "optimis", "rate of change")),
    ("Integration", "Integration and area under a curve", ("integrate", "integration", "integral", "antiderivative", "area under", "trapezium", "definite", "indefinite")),
    ("Exponentials and logarithms", "Exponential and logarithmic functions", ("logarithm", "logarithms", "log", "logs", "ln", "exponential", "exponentials", "exp", "decay", "growth")),
    ("Trigonometry", "Trigonometric functions and identities", ("sin", "cos", "tan", "sine", "cosine", "tangent", "trigonometric", "trigonometry", "radians", "identity", "identities", "degrees")),
    ("Sequences and series", "Sequences, series and the binomial expansion", ("sequence", "sequences", "series", "arithmetic", "geometric", "binomial", "sum to infinity", "nth term", "convergent", "expansion")),
    ("Coordinate geometry", "Lines, circles and the coordinate plane", ("coordinate", "coordinates", "midpoint", "perpendicular", "parallel", "circle", "centre", "radius", "chord", "straight line", "intersect", "intersection")),
    ("Graphs of functions", "Curve sketching, transformations and asymptotes", ("sketch", "asymptote", "asymptotes", "transformation", "translate", "translated", "stretch", "reflect", "reflected", "curve", "graph")),
    ("Algebra and functions", "Polynomials, functions and proof", ("polynomial", "factor", "remainder", "discriminant", "inverse", "composite", "modulus", "function", "functions", "prove", "proof", "inequality", "inequalities", "quadratic", "roots", "simultaneous")),
]

PHYSICS_TOPICS = [
    ("Radioactivity", "Atomic structure and radioactivity", ("radioactive", "radioactivity", "nuclear", "nucleus", "nuclide", "isotope", "isotopes", "decay", "alpha", "beta", "gamma", "half-life", "activity", "becquerel")),
    ("Magnetism", "Magnetic fields, motors and induction", ("magnet", "magnets", "magnetic", "induction", "induced", "solenoid", "transformer", "flux", "motor", "dynamo")),
    ("Waves", "Wave behaviour, sound and light", ("wave", "waves", "wavelength", "frequency", "amplitude", "light", "sound", "echo", "lens", "diffraction", "refraction", "reflection", "spectrum", "ultraviolet", "infrared")),
    ("Thermal physics", "Temperature, gases and energy transfer", ("thermal", "temperature", "heat", "heated", "gas", "gases", "kelvin", "specific heat", "latent", "boiling", "melting", "evaporation", "conduction", "convection")),
    ("Electricity", "Circuits and electrical quantities", ("circuit", "circuits", "current", "voltage", "potential difference", "resistance", "resistor", "resistors", "ammeter", "voltmeter", "charge", "electrical", "ohm", "ohms", "battery", "cell", "capacitor")),
    ("Matter", "Density, pressure and material behaviour", ("density", "densities", "pressure", "fluid", "liquid", "solid", "spring", "hooke", "elastic", "stress", "strain", "extension", "floats", "upthrust")),
    ("Mechanics", "Motion, forces, energy and momentum", ("force", "forces", "mass", "velocity", "speed", "acceleration", "momentum", "energy", "work", "power", "projectile", "gravity", "weight", "friction", "moment", "moments", "pivot", "newton", "newtons", "kinetic", "collision")),
]

TAXONOMIES = {"maths1": MATHS1_TOPICS, "maths2": MATHS2_TOPICS, "physics": PHYSICS_TOPICS}
FALLBACKS = {
    "maths1": ("Number", "Number, surds and standard form"),
    "maths2": ("Algebra and functions", "Polynomials, functions and proof"),
    "physics": ("Mechanics", "Motion, forces, energy and momentum"),
}


def build_matchers() -> dict[str, list[tuple[str, str, list[re.Pattern[str]]]]]:
    compiled: dict[str, list[tuple[str, str, list[re.Pattern[str]]]]] = {}
    for module, rules in TAXONOMIES.items():
        compiled[module] = [
            (topic, subtopic, [re.compile(rf"(?<![A-Za-z]){re.escape(word)}(?![A-Za-z])") for word in keywords])
            for topic, subtopic, keywords in rules
        ]
    return compiled


MATCHERS = build_matchers()


def classify(module: str, text: str) -> tuple[str, str]:
    """Pick the topic matching the most distinct whole-word keywords."""
    lowered = " ".join(text.lower().split())
    best_topic, best_subtopic = FALLBACKS[module]
    best_score = 0
    for topic, subtopic, patterns in MATCHERS[module]:
        score = sum(1 for pattern in patterns if pattern.search(lowered))
        # Strictly greater keeps the declared order as the tie-break, so the more
        # specific topics listed first win a draw against broader ones.
        if score > best_score:
            best_topic, best_subtopic, best_score = topic, subtopic, score
    return best_topic, best_subtopic


def main() -> None:
    payload = json.loads(BANK.read_text(encoding="utf-8"))
    before = Counter(f"{q['targetModule']} · {q['esatTopic']}" for q in payload["questions"])
    changed = 0
    for question in payload["questions"]:
        module = str(question["targetModule"])
        if module not in MATCHERS:
            continue
        topic, subtopic = classify(module, str(question.get("searchText", "")))
        if topic != question.get("esatTopic"):
            changed += 1
        question["esatTopic"] = topic
        question["esatSubtopic"] = subtopic
    after = Counter(f"{q['targetModule']} · {q['esatTopic']}" for q in payload["questions"])

    payload["topicTaxonomyVersion"] = "esat-2026-module-taxonomy-v2"
    BANK.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"relabelled {changed} of {len(payload['questions'])} questions\n")
    print("before:")
    for key in sorted(before):
        print(f"  {before[key]:4d}  {key}")
    print("\nafter:")
    for key in sorted(after):
        print(f"  {after[key]:4d}  {key}")


if __name__ == "__main__":
    main()
