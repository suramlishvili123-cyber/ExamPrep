import { readFile, rm, writeFile } from "node:fs/promises";

const distUrl = new URL("../dist/", import.meta.url);
const bankUrl = new URL("data/question-bank.json", distUrl);

// The source bank deliberately carries crop coordinates, OCR text and cryptographic
// provenance for local QA. None of those fields are used by the browser. Publishing a
// compact projection cuts the initial archive download substantially while the complete
// record remains available to the local validator.
const runtimeQuestionFields = [
  "id",
  "questionBankVersion",
  "year",
  "sourceExam",
  "sourcePaper",
  "sourceSection",
  "sourcePart",
  "originalQuestionNumber",
  "targetModule",
  "esatTopic",
  "esatSubtopic",
  "specificationVersion",
  "questionImage",
  "questionText",
  "questionDiagram",
  "questionDiagramAlt",
  "optionText",
  "explanation",
  "workedSolutionImage",
  "workedSolutionImages",
  "workedSolutionSource",
  "difficulty",
  "authored",
  "answerOptions",
  "correctAnswer",
  "excluded",
  "exclusionReason",
  "reviewRequired",
  "importConfidence",
  "alternateSources",
];

const sourceBank = JSON.parse(await readFile(bankUrl, "utf8"));
const runtimeBank = {
  version: sourceBank.version,
  specificationVersion: sourceBank.specificationVersion,
  generatedAt: sourceBank.generatedAt,
  questions: sourceBank.questions.map((question) => Object.fromEntries(
    runtimeQuestionFields
      .filter((field) => Object.hasOwn(question, field))
      .map((field) => [field, question[field]]),
  )),
  summary: {
    processedPotentiallyRelevant: sourceBank.summary?.processedPotentiallyRelevant ?? sourceBank.questions.length,
    includedByModule: sourceBank.summary?.includedByModule ?? {},
    excludedByReason: sourceBank.summary?.excludedByReason ?? {},
    contactSheets: [],
  },
};

await writeFile(bankUrl, JSON.stringify(runtimeBank), "utf8");

// These are build-time evidence, not application assets. Keeping them out of the Pages
// artifact avoids leaking workstation metadata and saves users from downloading or
// indexing internal QA material.
for (const relativePath of [
  "qa",
  "data/source-inventory.json",
  "data/duplicate-exclusions.json",
  "data/validation-report.json",
  "data/spec-topics.json",
  "data/research-sources.json",
]) {
  await rm(new URL(relativePath, distUrl), { recursive: true, force: true });
}

console.log(JSON.stringify({
  runtimeQuestions: runtimeBank.questions.length,
  compactBankBytes: Buffer.byteLength(JSON.stringify(runtimeBank)),
}));
