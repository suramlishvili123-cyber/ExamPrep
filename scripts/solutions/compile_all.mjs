import fs from "fs";
import path from "path";
import { generateAllNsaaMaths1 } from "./nsaa_maths1_all.mjs";
import { generateAllNsaaPhysics } from "./nsaa_physics_all.mjs";
import { generateAllNsaaMaths2 } from "./nsaa_maths2_all.mjs";
import { generateAllEngaa } from "./engaa_all.mjs";
import { generateAllTmua } from "./tmua_all.mjs";
import { generateAllMocks } from "./mocks_all.mjs";

const bankPath = path.resolve("public/data/question-bank.json");
const mocksPath = path.resolve("public/data/original-mocks.json");

const bank = JSON.parse(fs.readFileSync(bankPath, "utf8"));
const mocks = JSON.parse(fs.readFileSync(mocksPath, "utf8"));

console.log("Generating all solutions...");
const nsaaM1 = generateAllNsaaMaths1();
const nsaaPhys = generateAllNsaaPhysics();
const nsaaM2 = generateAllNsaaMaths2();
const engaa = generateAllEngaa();
const tmua = generateAllTmua();
const originalMocks = generateAllMocks();

const allSolutions = {
  ...nsaaM1,
  ...nsaaPhys,
  ...nsaaM2,
  ...engaa,
  ...tmua,
  ...originalMocks
};

console.log(`Total generated solutions: ${Object.keys(allSolutions).length} / 598 expected.`);

// Verify each question in bank has a solution and that answers match
let mismatchCount = 0;
for (const q of bank.questions) {
  const sol = allSolutions[q.id];
  if (!sol) {
    console.error(`Missing solution for bank question: ${q.id}`);
    mismatchCount++;
  } else if (sol.correctAnswer !== q.correctAnswer) {
    console.error(`Answer mismatch for ${q.id}: bank=${q.correctAnswer}, sol=${sol.correctAnswer}`);
    mismatchCount++;
  }
}

for (const q of mocks.questions) {
  const sol = allSolutions[q.id];
  if (!sol) {
    console.error(`Missing solution for mock question: ${q.id}`);
    mismatchCount++;
  } else if (sol.correctAnswer !== q.correctAnswer) {
    console.error(`Answer mismatch for ${q.id}: mock=${q.correctAnswer}, sol=${sol.correctAnswer}`);
    mismatchCount++;
  }
}

if (mismatchCount > 0) {
  console.error(`Failed with ${mismatchCount} errors.`);
  process.exit(1);
}

console.log("All 598 solutions verified 100% against answer keys!");

// Helper to write TS module
function writeTs(filename, varName, data) {
  const target = path.resolve("app/lib/solutions", filename);
  const content = `import type { SolutionMap } from "./types";\n\nexport const ${varName}: SolutionMap = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(target, content, "utf8");
  console.log(`Wrote ${filename} (${Object.keys(data).length} items)`);
}

// Ensure dir exists
fs.mkdirSync(path.resolve("app/lib/solutions"), { recursive: true });

writeTs("nsaa-maths1.ts", "NSAA_MATHS1_SOLUTIONS", nsaaM1);
writeTs("nsaa-physics.ts", "NSAA_PHYSICS_SOLUTIONS", nsaaPhys);
writeTs("nsaa-maths2.ts", "NSAA_MATHS2_SOLUTIONS", nsaaM2);
writeTs("engaa.ts", "ENGAA_SOLUTIONS", engaa);
writeTs("tmua.ts", "TMUA_SOLUTIONS", tmua);
writeTs("original-mocks.ts", "ORIGINAL_MOCKS_SOLUTIONS", originalMocks);

// Write unified index.ts
const indexContent = `import type { WorkedSolutionData } from "./types";
import { NSAA_MATHS1_SOLUTIONS } from "./nsaa-maths1";
import { NSAA_PHYSICS_SOLUTIONS } from "./nsaa-physics";
import { NSAA_MATHS2_SOLUTIONS } from "./nsaa-maths2";
import { ENGAA_SOLUTIONS } from "./engaa";
import { TMUA_SOLUTIONS } from "./tmua";
import { ORIGINAL_MOCKS_SOLUTIONS } from "./original-mocks";

export * from "./types";

export const ALL_WORKED_SOLUTIONS: Record<string, WorkedSolutionData> = {
  ...NSAA_MATHS1_SOLUTIONS,
  ...NSAA_PHYSICS_SOLUTIONS,
  ...NSAA_MATHS2_SOLUTIONS,
  ...ENGAA_SOLUTIONS,
  ...TMUA_SOLUTIONS,
  ...ORIGINAL_MOCKS_SOLUTIONS,
};

export function getWorkedSolution(questionId: string): WorkedSolutionData | null {
  return ALL_WORKED_SOLUTIONS[questionId] ?? null;
}
`;
fs.writeFileSync(path.resolve("app/lib/solutions/index.ts"), indexContent, "utf8");
console.log("Wrote app/lib/solutions/index.ts");

// Inject into question-bank.json and original-mocks.json
for (const q of bank.questions) {
  const sol = allSolutions[q.id];
  if (sol) {
    q.explanation = sol.explanation;
    if (sol.methodFast) q.methodFast = sol.methodFast;
    if (sol.keyConcept) q.keyConcept = sol.keyConcept;
    if (sol.traps && sol.traps.length) q.commonTraps = sol.traps;
    if (sol.difficulty) q.difficulty = sol.difficulty;
  }
}

fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2) + "\n", "utf8");
console.log("Updated public/data/question-bank.json with all worked solutions.");

for (const q of mocks.questions) {
  const sol = allSolutions[q.id];
  if (sol) {
    q.explanation = sol.explanation;
    if (sol.methodFast) q.methodFast = sol.methodFast;
    if (sol.keyConcept) q.keyConcept = sol.keyConcept;
    if (sol.traps && sol.traps.length) q.commonTraps = sol.traps;
    if (sol.difficulty) q.difficulty = sol.difficulty;
  }
}

fs.writeFileSync(mocksPath, JSON.stringify(mocks, null, 2) + "\n", "utf8");
console.log("Updated public/data/original-mocks.json with all worked solutions.");

console.log("Compilation complete!");
