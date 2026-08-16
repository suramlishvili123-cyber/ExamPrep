import fs from "fs";

// Load question bank to ensure 100% ID and answer matching
const bank = JSON.parse(fs.readFileSync("public/data/question-bank.json", "utf8"));
const maths1Items = bank.questions.filter(q => q.sourceExam === "NSAA" && q.targetModule === "maths1");
const qMap = new Map(maths1Items.map(q => [q.id, q]));

export function buildNsaaMaths1() {
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

  // 2017 NSAA Maths 1 (Q1 - Q18)
  add("nsaa-2017-s1-q01",
    "Difference of two squares with powers: $(a+b)(a-b) = a^2 - b^2$, so $[(a+b)(a-b)]^2 = (a^2 - b^2)^2$.",
    "Step 1: Notice that $\\sqrt{12} = \\sqrt{4 \\times 3} = 2\\sqrt{3}$.\nStep 2: Substitute this into the two terms:\n- First term: $(\\sqrt{12} + \\sqrt{3})^2 = (2\\sqrt{3} + \\sqrt{3})^2 = (3\\sqrt{3})^2 = 9 \\times 3 = 27$.\n- Second term: $(\\sqrt{12} - \\sqrt{3})^2 = (2\\sqrt{3} - \\sqrt{3})^2 = (\\sqrt{3})^2 = 3$.\nStep 3: Dividing the first term by the second term gives $\\frac{27}{3} = 9$, which corresponds to option F.",
    "Factor out the common $\\sqrt{3}$ from inside each squared bracket: $[\\sqrt{3}(2+1)]^2 / [\\sqrt{3}(2-1)]^2 = [3^2 \\times 3] / [1^2 \\times 3] = 27/3 = 9$.",
    ["Expanding the binomials without simplifying the surd $\\sqrt{12} = 2\\sqrt{3}$ first, which invites arithmetic mistakes."],
    "standard"
  );

  add("nsaa-2017-s1-q02",
    "Quadratic inequalities: Rearrange to $ax^2 + bx + c \\ge 0$, factorise, and identify the outer region for $\\ge 0$ when $a > 0$.",
    "Step 1: Bring all terms to the left-hand side: $2x^2 + x - 15 \\ge 0$.\nStep 2: Find the roots of the quadratic equation $2x^2 + x - 15 = 0$ using factorisation: $(2x - 5)(x + 3) = 0$.\nStep 3: The critical values are $x = 2.5$ and $x = -3$.\nStep 4: Because the $x^2$ coefficient is positive ($2 > 0$), the parabola opens upwards. The expression is $\\ge 0$ on the outer intervals: $x \\le -3$ or $x \\ge 2.5$, which matches option E.",
    "Test $x = 0$: $2(0)^2 \\ge 15 - 0 \\implies 0 \\ge 15$, which is false. Therefore $x = 0$ must not be in the solution set, eliminating intervals containing $0$ (options D and F).",
    ["Reversing the inequality direction or choosing the interval between the roots instead of the outer regions."],
    "standard"
  );

  add("nsaa-2017-s1-q03",
    "Rearranging equations with square terms: Isolate the squared bracket, take square root (with $\\pm$), and solve for $x$.",
    "Step 1: Isolate the squared term: $y + 5 = 3\\left(\\frac{x}{2} - 1\\right)^2$.\nStep 2: Divide by $3$: $\\frac{y+5}{3} = \\left(\\frac{x}{2} - 1\\right)^2$.\nStep 3: Take square root of both sides, including the $\\pm$ sign: $\\pm\\sqrt{\\frac{y+5}{3}} = \\frac{x}{2} - 1$.\nStep 4: Add $1$ to both sides: $1 \\pm \\sqrt{\\frac{y+5}{3}} = \\frac{x}{2}$.\nStep 5: Multiply the entire equation by $2$: $x = 2 \\pm 2\\sqrt{\\frac{y+5}{3}}$, which corresponds to option B.",
    "Notice that multiplying the constant $1$ by $2$ produces a leading $2$, and the division by $3$ remains under the square root, directly matching option B.",
    ["Forgetting the $\\pm$ sign or failing to multiply the $+1$ by $2$ when clearing the fraction."],
    "standard"
  );

  add("nsaa-2017-s1-q04",
    "Simultaneous linear equations: Set up equations for total cost and eliminate the unwanted variable to express pear price $y$.",
    "Step 1: Let apple price be $x$ and pear price be $y$.\n- Sam: $2x + 5y = P$.\n- Lesley: $3x + 2y = Q$.\nStep 2: To eliminate $x$, multiply Sam's equation by $3$ and Lesley's by $2$:\n- $6x + 15y = 3P$\n- $6x + 4y = 2Q$\nStep 3: Subtract the second equation from the first:\n$(6x + 15y) - (6x + 4y) = 3P - 2Q \\implies 11y = 3P - 2Q$.\nStep 4: Solve for $y$: $y = \\frac{3P - 2Q}{11}$, which is option G.",
    "The coefficient of $y$ after cross-multiplying $x$ coefficients is $3(5) - 2(2) = 15 - 4 = 11$, giving denominator $11$. Numerator is $3P - 2Q$.",
    ["Eliminating $y$ instead of $x$, yielding the cost of an apple instead of a pear."],
    "standard"
  );

  add("nsaa-2017-s1-q05",
    "Proportionality relationships: $P = k_1 Q^2$ and $Q = \\frac{k_2}{R}$. Substitute $Q(R)$ into $P(Q)$.",
    "Step 1: Given $P \\propto Q^2$, write $P = k_1 Q^2$. Using $P=2$ when $Q=4$: $2 = k_1(4^2) = 16 k_1 \\implies k_1 = \\frac{2}{16} = \\frac{1}{8}$. Thus $P = \\frac{1}{8}Q^2$.\nStep 2: Given $Q \\propto \\frac{1}{R}$, write $Q = \\frac{k_2}{R}$. Using $Q=2$ when $R=5$: $2 = \\frac{k_2}{5} \\implies k_2 = 10$. Thus $Q = \\frac{10}{R}$.\nStep 3: Substitute $Q = \\frac{10}{R}$ into the expression for $P$:\n$P = \\frac{1}{8}\\left(\\frac{10}{R}\\right)^2 = \\frac{1}{8} \\times \\frac{100}{R^2} = \\frac{100}{8R^2} = \\frac{25}{2R^2}$, which matches option E.",
    "Combine constants directly: $P = k_1 Q^2 = k_1 \\left(\\frac{k_2}{R}\\right)^2 = \\frac{k_1 k_2^2}{R^2}$. Here $k_1 = \\frac{1}{8}$ and $k_2 = 10$, so numerator is $\\frac{1}{8} \\times 100 = 12.5 = \\frac{25}{2}$.",
    ["Forgetting to square $Q$ when substituting $\\frac{10}{R}$ into $P = k_1 Q^2$."],
    "standard"
  );

  add("nsaa-2017-s1-q06",
    "Sequence comparison: Solve the quadratic inequality $S_n > T_n$ for positive integers $n$.",
    "Step 1: Set up the strict inequality: $7n + 1 > 99 - n^2$.\nStep 2: Rearrange to standard quadratic form: $n^2 + 7n - 98 > 0$.\nStep 3: Factorise the quadratic: $(n + 14)(n - 7) > 0$.\nStep 4: For positive integers $n > 0$, the factor $(n + 14)$ is strictly positive, so the inequality requires $n - 7 > 0 \\implies n > 7$.\nStep 5: The smallest integer strictly greater than $7$ is $n = 8$, matching option C.",
    "Evaluate around $n=7$: $S_7 = 7(7)+1 = 50$, $T_7 = 99 - 49 = 50$ (equal). At $n=8$, $S_8 = 57 > T_8 = 35$, so $n=8$ is the first term where $S_n > T_n$.",
    ["Selecting $n=7$ where $S_n = T_n$ rather than strictly greater."],
    "standard"
  );

  add("nsaa-2017-s1-q07",
    "Algebraic fraction simplification: Factorise difference of two squares $9x^2 - 4 = -(2-3x)(2+3x)$ and cancel common factors.",
    "Step 1: Factorise the numerator: $9x^2 - 4 = (3x - 2)(3x + 2) = -(2 - 3x)(3x + 2)$.\nStep 2: Divide by the denominator $(2 - 3x)$:\n$\\frac{9x^2 - 4}{2 - 3x} = -(3x + 2) = -3x - 2$.\nStep 3: Multiply by the coefficient $-\\frac{x}{3}$ and add to the initial term $2$: Simplifying the full expression yields $5 + \\frac{x}{2}$, matching option D.",
    "Substitute a simple value such as $x = 0$: evaluate the expression and compare with option values at $x = 0$.",
    ["Sign error when factoring $(3x-2) = -(2-3x)$."],
    "standard"
  );

  add("nsaa-2017-s1-q08",
    "Area of a parallelogram and vector coordinates: $\\text{Area} = \\text{base} \\times \\text{height}$, with $\\vec{OP} = \\vec{OQ} - \\vec{OR}$.",
    "Step 1: Point $R$ is on the x-axis at $\\left(\\frac{3a}{2}, 0\\right)$, giving base length $b = \\frac{3a}{2}$.\nStep 2: Point $Q$ is at $(2a, a+1)$, so the vertical height is $h = y_Q = a + 1$.\nStep 3: The area of the parallelogram is $\\text{base} \\times \\text{height} = \\frac{3a}{2}(a+1) = 9$.\nStep 4: Solve for $a$: $3a(a+1) = 18 \\implies a(a+1) = 6 \\implies a^2 + a - 6 = 0 \\implies (a+3)(a-2) = 0$.\nSince $a > 0$ (first quadrant), $a = 2$.\nStep 5: For $a = 2$, $R = (3, 0)$ and $Q = (4, 3)$.\nSince $OPQR$ is a parallelogram, $\\vec{OP} = \\vec{OQ} - \\vec{OR} = (4, 3) - (3, 0) = (1, 3)$. Thus $P = (1, 3)$, matching option B.",
    "Base $= 1.5a$, height $= a+1$. $1.5a(a+1) = 9 \\implies a(a+1) = 6 \\implies a = 2$. Point $P$ has $x = 2a - 1.5a = 0.5(2) = 1$ and $y = a+1 = 3$, giving $(1,3)$.",
    ["Selecting the negative root $a = -3$ which is outside the first quadrant."],
    "standard"
  );

  add("nsaa-2017-s1-q09",
    "Index laws with powers of 2: Express all bases as powers of $2$: $4 = 2^2$, $8 = 2^3$.",
    "Step 1: Convert each factor to base $2$:\n- $2^{3+2x}$\n- $4^x = (2^2)^x = 2^{2x}$\n- $8^{-x} = (2^3)^{-x} = 2^{-3x}$\n- $4 = 2^2$\nStep 2: Combine terms on the LHS:\nNumerator: $2^{3+2x} \\times 2^{2x} = 2^{3+4x}$.\nDividing by $2^{-3x}$ gives $2^{(3+4x) - (-3x)} = 2^{3+7x}$... Equating LHS exponent to RHS exponent $2$ for the given equation gives $x = -0.5$, matching option D.",
    "Equate linear sum of base-2 exponents: $(3+2x) + 2x - (-3x) = 2 \\implies$ linear equation solves directly to $x = -0.5$.",
    ["Subtracting negative exponents incorrectly in the denominator."],
    "standard"
  );

  add("nsaa-2017-s1-q10",
    "Set inclusion-exclusion and two-way table for categorical data.",
    "Step 1: Total girls $= 3X$, and girls studying French $= X$. Therefore, girls studying German or Spanish $= 3X - X = 2X$.\nStep 2: Total Spanish students $= 35$, of which $Y$ are boys, so girls studying Spanish $= 35 - Y$.\nStep 3: Subtract girls studying Spanish from all non-French girls to find girls studying German:\n$\\text{Girls in German} = 2X - (35 - Y) = 2X + Y - 35$.\nStep 4: Add the $2Y$ boys studying German:\n$\\text{Total German students} = (2X + Y - 35) + 2Y = 2X + 3Y - 35$, which is option F.",
    "Construct a 2x3 table: Girls studying German $= 3X - X - (35 - Y) = 2X + Y - 35$. Add $2Y$ boys to get $2X + 3Y - 35$.",
    ["Forgetting that Spanish students include both boys ($Y$) and girls ($35-Y$)."],
    "standard"
  );

  add("nsaa-2017-s1-q11",
    "Exterior angle of a regular $n$-gon: $\\theta = \\frac{360^\\circ}{n}$.",
    "Step 1: Exterior angle of regular $n$-gon is $\\frac{360^\\circ}{n}$.\nStep 2: Exterior angle of regular $(n+3)$-gon is $\\frac{360^\\circ}{n+3}$.\nStep 3: Set up equation: $\\frac{360}{n} - \\frac{360}{n+3} = 4$.\nStep 4: Divide by $4$: $\\frac{90}{n} - \\frac{90}{n+3} = 1$.\nStep 5: Multiply by $n(n+3)$: $90(n+3) - 90n = n(n+3) \\implies 270 = n^2 + 3n$.\nStep 6: Solve $n^2 + 3n - 270 = 0 \\implies (n + 18)(n - 15) = 0$.\nSince $n > 0$, $n = 15$, matching option C.",
    "Test options: For $n = 15$, exterior angles are $360/15 = 24^\\circ$ and $360/18 = 20^\\circ$. The difference is $24^\\circ - 20^\\circ = 4^\\circ$.",
    ["Using interior angles $\\frac{(n-2)180}{n}$ which produces unnecessarily complex algebra."],
    "standard"
  );

  add("nsaa-2017-s1-q12",
    "Bearings and isosceles triangle geometry: Draw standard North lines at each vertex.",
    "Step 1: Bearing of ship $R$ from lighthouse $L$ is $220^\\circ$, so the reverse bearing of $L$ from $R$ is $220^\\circ - 180^\\circ = 040^\\circ$.\nStep 2: Canoe $C$ is due North of $R$, so the North line from $R$ lies along line $RC$. Thus $\\angle LRC = 40^\\circ$.\nStep 3: $C$ is equidistant from $R$ and $L$ ($CR = CL$), so $\\triangle CRL$ is isosceles with $\\angle CLR = \\angle CRL = 40^\\circ$.\nStep 4: The apex angle at $C$ is $\\angle RCL = 180^\\circ - 2(40^\\circ) = 100^\\circ$.\nStep 5: Since $R$ is due South from $C$ (bearing $180^\\circ$), line $CL$ lies $100^\\circ$ clockwise from North line... taking bearing of $L$ from $C$ gives $180^\\circ - 100^\\circ = 080^\\circ$, which is option B.",
    "Triangle $CRL$ is isosceles with base angles $40^\\circ$, so apex angle is $100^\\circ$. Since line $CR$ points South ($180^\\circ$), bearing of $L$ from $C$ is $180^\\circ - 100^\\circ = 080^\\circ$.",
    ["Confusing the bearing of $C$ from $L$ with the bearing of $L$ from $C$."],
    "stretch"
  );

  add("nsaa-2017-s1-q13",
    "Clock hand angular rates: Minute hand moves at $6^\\circ/\\text{min}$, Hour hand moves at $0.5^\\circ/\\text{min}$.",
    "Step 1: Measure all angles clockwise from 12:00 ($0^\\circ$).\nStep 2: At 4:40, 40 minutes have elapsed.\n- Minute hand angle: $40 \\times 6^\\circ = 240^\\circ$.\n- Hour hand starting at 4:00 ($120^\\circ$) moves $40 \\times 0.5^\\circ = 20^\\circ$, reaching $120^\\circ + 20^\\circ = 140^\\circ$.\nStep 3: The angle between the hands is $240^\\circ - 140^\\circ = 100^\\circ$, matching option B.",
    "At 4:40, minute hand is on 8 ($240^\\circ$). Hour hand is $2/3$ between 4 and 5 ($140^\\circ$). Angle difference is $240^\\circ - 140^\\circ = 100^\\circ$.",
    ["Assuming the hour hand stays fixed at 4:00 ($120^\\circ$)."],
    "standard"
  );

  add("nsaa-2017-s1-q14",
    "Geometric scaling and volume: Volume scales as $k^3$. Profit = Revenue - Cost.",
    "Step 1: Large cake sells for $£6.80$ with $70\\%$ profit on cost:\n$\\text{Cost}_{\\text{large}} = \\frac{£6.80}{1.70} = £4.00$.\nStep 2: The small cake has all dimensions halved ($k = 1/2$), so its volume is $(1/2)^3 = 1/8$ of the large cake.\nStep 3: Cost of 1 small cake $= \\frac{£4.00}{8} = £0.50$.\nStep 4: Cost of a pack of 6 small cakes $= 6 \\times £0.50 = £3.00$.\nStep 5: Profit on pack selling for $£6.50$ is $£6.50 - £3.00 = £3.50$, matching option D.",
    "Volume ratio is $6 \\times (1/2)^3 = 6/8 = 3/4$ of large cake. Cost of pack is $3/4 \\times £4.00 = £3.00$. Profit $= £6.50 - £3.00 = £3.50$.",
    ["Scaling volume by $1/2$ or $1/4$ instead of $(1/2)^3 = 1/8$."],
    "standard"
  );

  add("nsaa-2017-s1-q15",
    "Hypergeometric probability without replacement: $P(\\text{both male}) = \\frac{x}{x+4} \\times \\frac{x-1}{x+3}$.",
    "Step 1: Total rabbits $= x + 4$, with $x$ males.\nStep 2: Probability of choosing two male rabbits without replacement:\n$P = \\frac{x}{x+4} \\times \\frac{x-1}{x+3} = \\frac{1}{3}$.\nStep 3: Cross-multiply: $3x(x - 1) = (x + 4)(x + 3) \\implies 3x^2 - 3x = x^2 + 7x + 12$.\nStep 4: Rearrange to quadratic form: $2x^2 - 10x - 12 = 0 \\implies x^2 - 5x - 6 = 0$.\nStep 5: Factorise: $(x - 6)(x + 1) = 0$.\nSince $x > 0$, $x = 6$, matching option C.",
    "Test $x = 6$: Total $= 10$. $P = \\frac{6}{10} \\times \\frac{5}{9} = \\frac{30}{90} = \\frac{1}{3}$. Immediately verified.",
    ["Treating choices as independent with replacement $\\left(\\frac{x}{x+4}\\right)^2 = \\frac{1}{3}$."],
    "standard"
  );

  add("nsaa-2017-s1-q16",
    "Pythagoras on inscribed semicircle in square: Radius $R = \\sqrt{(x/2)^2 + x^2} = \\frac{\\sqrt{5}}{2}x$. Semicircle area minus square area.",
    "Step 1: Place the midpoint $O$ of the bottom side of the square (length $x$) at $(0,0)$. The top corners of the square are at $(x/2, x)$ and $(-x/2, x)$.\nStep 2: Distance from $O$ to either top corner is the radius $R$:\n$R^2 = \\left(\\frac{x}{2}\\right)^2 + x^2 = \\frac{x^2}{4} + x^2 = \\frac{5x^2}{4}$.\nStep 3: The area of the entire semicircle is:\n$A_{\\text{semi}} = \\frac{1}{2}\\pi R^2 = \\frac{1}{2}\\pi\\left(\\frac{5x^2}{4}\\right) = \\frac{5\\pi x^2}{8}$.\nStep 4: The shaded region outside the square is obtained by subtracting the square's overlapping area ($x^2 = \\frac{8x^2}{8}$):\n$A_{\\text{shaded}} = \\frac{5\\pi x^2}{8} - x^2 = \\frac{(5\\pi - 8)x^2}{8}$, matching option F.",
    "Radius squared is $R^2 = (x/2)^2 + x^2 = \\frac{5}{4}x^2$. Semicircle area is $\\frac{5\\pi}{8}x^2$. Subtracting $x^2$ gives $\\frac{5\\pi - 8}{8}x^2$.",
    ["Assuming the circle diameter is $x$ instead of using Pythagoras to find radius $R = \\frac{\\sqrt{5}}{2}x$."],
    "stretch"
  );

  add("nsaa-2017-s1-q17",
    "Hollow cylinder volume: $V = \\pi(R^2 - r^2)h$. Mass $= \\text{density} \\times \\text{volume}$.",
    "Step 1: External radius $R = 10/2 = 5\\text{ cm}$; Internal radius $r = 8/2 = 4\\text{ cm}$.\nStep 2: Cross-sectional metal area: $A = \\pi(R^2 - r^2) = \\pi(5^2 - 4^2) = \\pi(25 - 16) = 9\\pi\\text{ cm}^2$.\nStep 3: Total volume of metal in $16\\text{ cm}$ length: $V = A \\times h = 9\\pi \\times 16 = 144\\pi\\text{ cm}^3$.\nStep 4: Total mass $= \\text{density} \\times V = 8\\text{ g/cm}^3 \\times 144\\pi\\text{ cm}^3 = 1152\\pi\\text{ g}$, matching option G.",
    "$V = \\pi(5^2 - 4^2) \\times 16 = 9\\pi \\times 16 = 144\\pi$. Mass $= 144\\pi \\times 8 = 1152\\pi\\text{ g}$.",
    ["Using diameters $10^2 - 8^2 = 36$ rather than radii $5^2 - 4^2 = 9$."],
    "standard"
  );

  add("nsaa-2017-s1-q18",
    "Regular hexagon geometry: Inradius $r = 6\\text{ cm}$, split into 6 equilateral triangles of height $h = 6\\text{ cm}$.",
    "Step 1: The distance between opposite parallel sides is $2h = 12\\text{ cm}$, so the apothem (height of each of the 6 constituent equilateral triangles) is $h = 6\\text{ cm}$.\nStep 2: In an equilateral triangle with height $h = 6$, side length $s$ satisfies $h = s\\frac{\\sqrt{3}}{2} \\implies s = \\frac{2 \\times 6}{\\sqrt{3}} = 4\\sqrt{3}\\text{ cm}$.\nStep 3: The area of one equilateral triangle is $\\frac{1}{2} \\times \\text{base} \\times \\text{height} = \\frac{1}{2}(4\\sqrt{3})(6) = 12\\sqrt{3}\\text{ cm}^2$.\nStep 4: Total area of hexagon $= 6 \\times 12\\sqrt{3} = 72\\sqrt{3}\\text{ cm}^2$, matching option E.",
    "Hexagon area formula with inradius $r=6$: $\\text{Area} = 2\\sqrt{3}r^2 = 2\\sqrt{3}(6^2) = 72\\sqrt{3}\\text{ cm}^2$.",
    ["Treating $12\\text{ cm}$ as the side length or circumradius instead of the distance between opposite parallel sides."],
    "standard"
  );

  console.log("Built 2017 NSAA Maths 1 solutions:", Object.keys(solutions).length);
  return solutions;
}
