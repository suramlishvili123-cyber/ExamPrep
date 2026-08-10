"""Generate and self-check three original 27-question ESAT challenge modules.

Every value is produced from an explicit formula below. The questions are
deliberately multi-step and time-pressured, but are labelled as original practice,
never as official ESAT material or as a source of a scaled score.
"""

from __future__ import annotations

import hashlib
import json
import math
from fractions import Fraction
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
OUTPUT = APP_DIR / "public" / "data" / "original-mocks.json"
VERSION = "esat-atlas-original-challenge-a-v1"
LETTERS = "ABCDEFGH"


def fmt(value: int | Fraction | float) -> str:
    if isinstance(value, Fraction):
        return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def make_question(
    module: str,
    number: int,
    topic: str,
    subtopic: str,
    prompt: str,
    correct: str,
    distractors: list[str],
    explanation: str,
) -> dict[str, object]:
    values: list[str] = []
    for value in [correct, *distractors]:
        if value not in values:
            values.append(value)
    if len(values) < 4:
        raise ValueError(f"{module} Q{number}: fewer than four unique options")
    values = values[:6]
    shift = (number * 3 + len(module)) % len(values)
    values = values[shift:] + values[:shift]
    correct_index = values.index(correct)
    answer_options = list(LETTERS[: len(values)])
    question_id = f"atlas-challenge-a-{module}-q{number:02d}"
    digest = hashlib.sha256(f"{prompt}|{correct}|{explanation}".encode()).hexdigest()
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
        "specificationVersion": "ESAT-2026-v7.1.1",
        "questionImage": "",
        "questionText": prompt,
        "optionText": dict(zip(answer_options, values, strict=True)),
        "answerOptions": answer_options,
        "correctAnswer": answer_options[correct_index],
        "explanation": explanation,
        "difficulty": "stretch",
        "authored": True,
        "excluded": False,
        "exclusionReason": None,
        "reviewRequired": False,
        "importConfidence": "high",
        "sourceHash": digest,
        "imageHash": digest,
        "searchText": prompt,
    }


def maths1() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    number = 0
    for s, p in ((7, 10), (8, 15), (9, 20)):
        number += 1
        answer = s**3 - 3 * p * s
        output.append(make_question("maths1", number, "Algebra", "Roots and identities", f"The roots of x² − {s}x + {p} = 0 are α and β. What is α³ + β³?", str(answer), [str(s**3), str(s * s - 2 * p), str(3 * p * s), str(answer + p)], f"α+β={s} and αβ={p}. Hence α³+β³=(α+β)³−3αβ(α+β)={answer}."))
    for n1, m1, n2, m2 in ((12, 18, 6, 24), (15, 22, 10, 28), (14, 16, 7, 30)):
        number += 1
        answer = Fraction(n1 * m1 + n2 * m2, n1 + n2)
        output.append(make_question("maths1", number, "Statistics", "Combined means", f"Group A has {n1} values with mean {m1}; group B has {n2} values with mean {m2}. What is the mean after the groups are combined?", fmt(answer), [fmt(Fraction(m1 + m2, 2)), fmt(Fraction(n1 * m1 + n2 * m2, n1 + n2 - 1)), fmt(Fraction(n1 + n2, 2)), fmt(answer + 1)], f"The combined total is {n1*m1}+{n2*m2}; divide by {n1+n2} to obtain {fmt(answer)}."))
    for red, blue in ((4, 6), (5, 7), (3, 8)):
        number += 1
        total = red + blue
        answer = Fraction(2 * red * blue, total * (total - 1))
        output.append(make_question("maths1", number, "Probability", "Sampling without replacement", f"A bag contains {red} red and {blue} blue counters. Two are selected without replacement. What is the probability of selecting exactly one red counter?", fmt(answer), [fmt(Fraction(red * blue, total * total)), fmt(Fraction(red, total)), fmt(Fraction(2 * red * blue, total * total)), fmt(1 - answer)], f"Either red then blue or blue then red: 2×{red}/{total}×{blue}/{total-1}={fmt(answer)}."))
    for tangent, external in ((12, 8), (15, 9), (20, 16)):
        number += 1
        whole = Fraction(tangent * tangent, external)
        output.append(make_question("maths1", number, "Geometry", "Circle theorems", f"From point P, a tangent to a circle has length {tangent}. A secant from P has external segment {external}. What is the length of the whole secant?", fmt(whole), [fmt(whole - external), fmt(Fraction(tangent, external)), str(tangent + external), str(tangent * tangent)], f"By the tangent–secant theorem, {tangent}²={external}×(whole secant), so the length is {fmt(whole)}."))
    for a, b, c, d in ((3, 5, 10, 7), (4, 7, 14, 9), (5, 8, 12, 11)):
        number += 1
        ratio = Fraction(a * c, b * d)
        output.append(make_question("maths1", number, "Ratio and proportion", "Linked ratios", f"A:B = {a}:{b} and B:C = {c}:{d}. What is A:C in simplest fractional form A/C?", fmt(ratio), [fmt(Fraction(a, d)), fmt(Fraction(a * d, b * c)), fmt(Fraction(b * d, a * c)), fmt(Fraction(c, b))], f"Choose a common value for B: A/C=({a}/{b})×({c}/{d})={fmt(ratio)}."))
    for up, down in ((25, 20), (20, 10), (50, 40)):
        number += 1
        factor = Fraction(100 + up, 100) * Fraction(100 - down, 100)
        answer = factor * 100
        output.append(make_question("maths1", number, "Ratio and proportion", "Successive percentage change", f"A quantity increases by {up}% and is then reduced by {down}%. Its final value is what percentage of its original value?", f"{fmt(answer)}%", [f"{100+up-down}%", f"{fmt(Fraction(100-down,100+up)*100)}%", f"{100-up+down}%", f"{up*down/100}%"], f"Multiply the scale factors: (1+{up}/100)(1−{down}/100)={fmt(factor)}, giving {fmt(answer)}%."))
    for point, line_points in (((2, 5), ((1, 1), (4, 7))), ((-1, 3), ((0, 4), (3, -2))), ((4, -1), ((-2, 5), (2, 7)))):
        number += 1
        (x, y), ((x1, y1), (x2, y2)) = point, line_points
        slope = Fraction(y2 - y1, x2 - x1)
        perpendicular = -1 / slope
        intercept = Fraction(y) - perpendicular * x
        output.append(make_question("maths1", number, "Geometry", "Coordinate geometry", f"A line passes through ({x}, {y}) and is perpendicular to the line through ({x1}, {y1}) and ({x2}, {y2}). What is its y-intercept?", fmt(intercept), [fmt(-intercept), fmt(slope), fmt(perpendicular), fmt(Fraction(y) - slope * x)], f"The given slope is {fmt(slope)}, so the perpendicular slope is {fmt(perpendicular)}. Substitution into y=mx+c gives c={fmt(intercept)}."))
    for mod1, rem1, mod2, rem2 in ((5, 2, 7, 3), (6, 5, 7, 2), (7, 4, 9, 5)):
        number += 1
        answer = next(value for value in range(1, mod1 * mod2 + 1) if value % mod1 == rem1 and value % mod2 == rem2)
        output.append(make_question("maths1", number, "Number", "Remainders", f"What is the least positive integer n for which n leaves remainder {rem1} on division by {mod1} and remainder {rem2} on division by {mod2}?", str(answer), [str(answer + mod1), str(answer + mod2), str(mod1 * mod2 - answer), str(rem1 * rem2)], f"Testing the arithmetic progression n={rem1} mod {mod1}, the first value also congruent to {rem2} mod {mod2} is {answer}."))
    for threshold in (10, 9, 8):
        number += 1
        outcomes = [(a, b) for a in range(1, 7) for b in range(1, 7) if a + b >= threshold]
        doubles = [(a, b) for a, b in outcomes if a == b]
        answer = Fraction(len(doubles), len(outcomes))
        output.append(make_question("maths1", number, "Probability", "Conditional probability", f"Two fair six-sided dice are rolled. Given that their sum is at least {threshold}, what is the probability that the dice show the same number?", fmt(answer), [fmt(Fraction(len(doubles), 36)), fmt(Fraction(1, 6)), fmt(1 - answer), fmt(Fraction(len(outcomes), 36))], f"There are {len(outcomes)} ordered outcomes meeting the condition and {len(doubles)} are doubles, so the conditional probability is {fmt(answer)}."))
    assert number == 27
    return output


def physics() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    number = 0
    for u, t, s in ((4, 6, 60), (3, 8, 88), (5, 4, 36)):
        number += 1
        acceleration = Fraction(2 * (s - u * t), t * t)
        output.append(make_question("physics", number, "Mechanics", "Constant acceleration", f"An object moves with constant acceleration. Its initial speed is {u} m s⁻¹ and it travels {s} m in {t} s. What is its acceleration?", f"{fmt(acceleration)} m s⁻²", [f"{fmt(Fraction(s,u))} m s⁻²", f"{fmt(Fraction(s-u*t,t*t))} m s⁻²", f"{fmt(Fraction(s,u*t))} m s⁻²", f"{fmt(acceleration+1)} m s⁻²"], f"Use s=ut+½at²: a=2({s}−{u}×{t})/{t}²={fmt(acceleration)} m s⁻²."))
    for m1, u1, m2, u2 in ((2, 8, 3, 0), (4, 5, 1, -5), (3, 7, 2, 2)):
        number += 1
        v = Fraction(m1*u1 + m2*u2, m1+m2)
        output.append(make_question("physics", number, "Mechanics", "Momentum", f"A {m1} kg trolley moving at {u1} m s⁻¹ collides with a {m2} kg trolley moving at {u2} m s⁻¹. They stick together. What is their common velocity?", f"{fmt(v)} m s⁻¹", [f"{fmt(Fraction(m1*u1-m2*u2,m1+m2))} m s⁻¹", f"{fmt(Fraction(u1+u2,2))} m s⁻¹", f"{fmt(Fraction(m1*u1+m2*u2,m1))} m s⁻¹", f"{fmt(abs(v))} J"], f"Conservation of momentum gives v=({m1}×{u1}+{m2}×{u2})/({m1}+{m2})={fmt(v)} m s⁻¹."))
    for mass, height, input_energy in ((60, 5, 4000), (50, 8, 5000), (75, 4, 4000)):
        number += 1
        useful = mass * 10 * height
        efficiency = Fraction(useful, input_energy) * 100
        output.append(make_question("physics", number, "Mechanics", "Energy and efficiency", f"A lift raises a {mass} kg load through {height} m using {input_energy} J. Take g=10 N kg⁻¹. What is the efficiency?", f"{fmt(efficiency)}%", [f"{fmt(Fraction(input_energy,useful)*100)}%", f"{fmt(Fraction(useful,input_energy))}%", f"{fmt(efficiency-10)}%", f"{useful}%"], f"Useful energy=mgh={useful} J. Efficiency={useful}/{input_energy}×100%={fmt(efficiency)}%."))
    for r1, r2, series in ((6, 3, 2), (12, 4, 5), (8, 8, 3)):
        number += 1
        parallel = Fraction(r1*r2, r1+r2)
        total = parallel + series
        output.append(make_question("physics", number, "Electricity", "Series and parallel resistance", f"Resistors of {r1} Ω and {r2} Ω are in parallel; this combination is in series with {series} Ω. What is the total resistance?", f"{fmt(total)} Ω", [f"{r1+r2+series} Ω", f"{fmt(parallel)} Ω", f"{fmt(Fraction(r1+r2,2)+series)} Ω", f"{fmt(Fraction(r1*r2,r1+r2+series))} Ω"], f"The parallel pair has resistance {fmt(parallel)} Ω; adding {series} Ω gives {fmt(total)} Ω."))
    for frequency, wavelength, factor in ((50, Fraction(12,5), Fraction(3,4)), (80, Fraction(3,2), Fraction(5,6)), (120, Fraction(5,4), Fraction(2,3))):
        number += 1
        speed1 = frequency*wavelength
        speed2 = speed1*factor
        wavelength2 = Fraction(speed2, frequency)
        output.append(make_question("physics", number, "Waves", "Wave speed and refraction", f"A wave has frequency {frequency} Hz and wavelength {fmt(wavelength)} m. It enters a medium where its speed is {fmt(factor)} of its original speed. What is its new wavelength?", f"{fmt(wavelength2)} m", [f"{fmt(wavelength/factor)} m", f"{fmt(speed2)} m", f"{fmt(Fraction(frequency, speed2))} m", f"{fmt(wavelength2*frequency)} m"], f"Frequency is unchanged. The new wavelength is ({fmt(factor)})×{fmt(wavelength)}={fmt(wavelength2)} m."))
    for hot_mass, hot_temp, cold_mass, cold_temp in ((2, 80, 3, 20), (1, 90, 2, 30), (3, 70, 2, 20)):
        number += 1
        final = Fraction(hot_mass*hot_temp+cold_mass*cold_temp,hot_mass+cold_mass)
        output.append(make_question("physics", number, "Thermal physics", "Thermal equilibrium", f"{hot_mass} kg of a liquid at {hot_temp}°C is mixed with {cold_mass} kg of the same liquid at {cold_temp}°C in an insulated container. What is the final temperature?", f"{fmt(final)}°C", [f"{fmt(Fraction(hot_temp+cold_temp,2))}°C", f"{fmt(final+5)}°C", f"{fmt(Fraction(hot_mass*hot_temp-cold_mass*cold_temp,hot_mass+cold_mass))}°C", f"{hot_temp-cold_temp}°C"], f"Equal specific heat capacities cancel: T=({hot_mass}×{hot_temp}+{cold_mass}×{cold_temp})/({hot_mass+cold_mass})={fmt(final)}°C."))
    for half_lives, initial in ((3, 640), (4, 960), (5, 1600)):
        number += 1
        remaining = Fraction(initial,2**half_lives)
        output.append(make_question("physics", number, "Radioactivity", "Half-life", f"A pure radioactive sample initially has activity {initial} Bq. What is its activity after {half_lives} half-lives?", f"{fmt(remaining)} Bq", [f"{fmt(Fraction(initial,2*half_lives))} Bq", f"{initial-half_lives*2} Bq", f"{fmt(Fraction(initial,half_lives))} Bq", f"{fmt(remaining*2)} Bq"], f"After {half_lives} half-lives the activity is {initial}/2^{half_lives}={fmt(remaining)} Bq."))
    for load, load_distance, effort_distance in ((120, Fraction(3,5), Fraction(4,5)), (150, Fraction(2,5), Fraction(3,4)), (90, Fraction(7,10), Fraction(9,10))):
        number += 1
        effort = Fraction(load)*load_distance/effort_distance
        output.append(make_question("physics", number, "Mechanics", "Moments", f"A uniform light beam pivots in equilibrium. A {load} N load acts {fmt(load_distance)} m to the left of the pivot. What force acting {fmt(effort_distance)} m to the right balances it?", f"{fmt(effort)} N", [f"{fmt(Fraction(load)*effort_distance/load_distance)} N", f"{fmt(Fraction(load)*(effort_distance-load_distance))} N", f"{load} N", f"{fmt(effort+10)} N"], f"Equate moments: F×{fmt(effort_distance)}={load}×{fmt(load_distance)}, so F={fmt(effort)} N."))
    for field, current, length in ((Fraction(2,5), 3, Fraction(1,2)), (Fraction(3,5), 4, Fraction(1,4)), (Fraction(4,5), 5, Fraction(3,10))):
        number += 1
        force = field*current*length
        output.append(make_question("physics", number, "Magnetism", "Force on a conductor", f"A straight wire of length {fmt(length)} m carries {current} A perpendicular to a uniform magnetic field of flux density {fmt(field)} T. What force acts on the wire?", f"{fmt(force)} N", [f"{fmt(field*current/length)} N", f"{fmt(field*length/current)} N", f"{fmt(Fraction(current)*length)} N", f"{fmt(force*10)} N"], f"F=BIL={fmt(field)}×{current}×{fmt(length)}={fmt(force)} N."))
    assert number == 27
    return output


def maths2() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    number = 0
    for s, p in ((6, 5), (8, 12), (10, 21)):
        number += 1
        answer = s*s - 2*p
        output.append(make_question("maths2", number, "Algebra and functions", "Polynomial roots", f"The roots of t² − {s}t + {p}=0 are α and β. Find α²+β².", str(answer), [str(s*s), str(s*s-p), str(2*p), str(answer+p)], f"α²+β²=(α+β)²−2αβ={s}²−2×{p}={answer}."))
    for first, ratio in ((12, Fraction(2,3)), (15, Fraction(3,5)), (18, Fraction(5,6))):
        number += 1
        total = Fraction(first,1-ratio)
        output.append(make_question("maths2", number, "Sequences and series", "Infinite geometric series", f"A convergent geometric series has first term {first} and common ratio {fmt(ratio)}. What is its sum to infinity?", fmt(total), [fmt(Fraction(first,1+ratio)), fmt(first*ratio), fmt(total-first), fmt(Fraction(first,ratio))], f"S∞=a/(1−r)={first}/(1−{fmt(ratio)})={fmt(total)}."))
    for radius, point in ((5, (3,4)), (13, (5,12)), (10, (6,8))):
        number += 1
        x, y = point
        # Tangent to x²+y²=r² at (x,y): xx₁+yy₁=r².
        intercept = Fraction(radius*radius,y)
        output.append(make_question("maths2", number, "Coordinate geometry", "Circle tangents", f"The circle x²+y²={radius*radius} has a tangent at ({x},{y}). What is the y-intercept of this tangent?", fmt(intercept), [fmt(Fraction(radius*radius,x)), fmt(Fraction(y,radius*radius)), str(radius), fmt(Fraction(x*x,y))], f"The tangent is {x}x+{y}y={radius*radius}. At x=0, y={radius*radius}/{y}={fmt(intercept)}."))
    for maximum in (4, 6, 8):
        number += 1
        # sin(2x)=0 has x=kπ/2; inclusive 0..maximumπ gives 2*maximum+1.
        answer = 2*maximum+1
        output.append(make_question("maths2", number, "Trigonometry", "Counting solutions", f"How many distinct solutions does sin(2x)=0 have in the inclusive interval 0 ≤ x ≤ {maximum}π?", str(answer), [str(maximum+1), str(2*maximum), str(answer+1), str(4*maximum+1)], f"2x=kπ, so x=kπ/2. Integers k=0,…,{2*maximum} give {answer} solutions."))
    for base, result in ((2, 32), (3, 243), (5, 625)):
        number += 1
        power = round(math.log(result,base))
        answer = power - 1
        output.append(make_question("maths2", number, "Exponentials and logarithms", "Logarithmic equations", f"If log_{base}(x)={power} and y=log_x({result}^{power-1}), what is y?", str(answer), [str(power), str(power+1), fmt(Fraction(power-1,power)), str(base*power)], f"Since x={base}^{power}={result}, log_x(x^{power-1})={power-1}."))
    for a in (2, 3, 4):
        number += 1
        # f=x^3-3a^2 x has stationary points ±a; local max at -a.
        maximum_value = 2*a**3
        output.append(make_question("maths2", number, "Differentiation", "Stationary points", f"For f(x)=x³−{3*a*a}x, what is the value of the local maximum?", str(maximum_value), [str(-maximum_value), str(a), str(a**3), str(3*a*a)], f"f′(x)=3(x²−{a*a}), so x=±{a}. The local maximum is at x=−{a}, where f={maximum_value}."))
    for n in (2, 3, 4):
        number += 1
        # Integral 0..1 x^n(1-x) = 1/(n+1)-1/(n+2).
        answer = Fraction(1,(n+1)*(n+2))
        output.append(make_question("maths2", number, "Integration", "Definite integrals", f"Evaluate ∫₀¹ x^{n}(1−x) dx.", fmt(answer), [fmt(Fraction(1,n+1)), fmt(Fraction(1,n+2)), fmt(Fraction(1,2*n+3)), fmt(answer*2)], f"Integrate x^{n}−x^{n+1}: 1/{n+1}−1/{n+2}={fmt(answer)}."))
    for a, b in ((2,3),(3,-2),(4,1)):
        number += 1
        # f(x)=ax+b, f^-1(x)=(x-b)/a. Evaluate f^-1(f^-1(b+a^2)).
        target = b+a*a
        first = Fraction(target-b,a)
        second = Fraction(first-b,a)
        output.append(make_question("maths2", number, "Algebra and functions", "Inverse functions", f"Let f(x)={a}x{b:+d}. Find f⁻¹(f⁻¹({target})).", fmt(second), [fmt(first), fmt(Fraction(target+b,a)), fmt(Fraction(target-b,a*a)), fmt(second+1)], f"f⁻¹(x)=(x−({b}))/{a}. Applying it twice gives {fmt(first)} then {fmt(second)}."))
    for n, k in ((8,3),(9,4),(10,3)):
        number += 1
        coefficient = math.comb(n,k)*(2**k)
        output.append(make_question("maths2", number, "Algebra and functions", "Binomial expansion", f"What is the coefficient of x^{k} in (1+2x)^{n}?", str(coefficient), [str(math.comb(n,k)), str(math.comb(n,k)*2), str(math.comb(n,k)*(2**(n-k))), str(coefficient//2)], f"The term is C({n},{k})(2x)^{k}, so the coefficient is {math.comb(n,k)}×2^{k}={coefficient}."))
    assert number == 27
    return output


def build() -> None:
    questions = [*maths1(), *physics(), *maths2()]
    assert len(questions) == 81
    assert len({question["id"] for question in questions}) == 81
    for question in questions:
        assert question["correctAnswer"] in question["answerOptions"]
        option_text = question["optionText"]
        assert isinstance(option_text, dict)
        assert len(option_text) == len(set(option_text.values()))
    payload = {
        "version": VERSION,
        "generatedAt": "2026-08-10",
        "label": "Challenge Mock A",
        "disclaimer": "Original ESAT Atlas practice—not official UAT-UK material. Deliberately stretch-weighted; no scaled-score conversion.",
        "questions": questions,
        "summary": {"questionCount": 81, "perModule": {"maths1": 27, "physics": 27, "maths2": 27}, "verification": "formula assertions passed"},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(payload["summary"], indent=2))


if __name__ == "__main__":
    build()
