export interface WorkedSolutionData {
  id: string;
  correctAnswer: string;
  keyConcept: string;
  explanation: string;
  methodFast?: string;
  difficulty?: "standard" | "stretch";
  traps?: string[];
  diagramSvg?: string;
}

export type SolutionMap = Record<string, WorkedSolutionData>;
