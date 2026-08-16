import type { WorkedSolutionData } from "./types";
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
