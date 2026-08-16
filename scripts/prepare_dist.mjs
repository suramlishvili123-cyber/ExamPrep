import { createHash } from "node:crypto";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const distUrl = new URL("../dist/", import.meta.url);
const bankUrl = new URL("data/question-bank.json", distUrl);
const mocksUrl = new URL("data/original-mocks.json", distUrl);
const serviceWorkerSourceUrl = new URL("../app/service-worker.js", import.meta.url);

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

/* ------------------------------------------------------------- the service worker -- */

/**
 * The shell the worker precaches during `install`: everything needed to open the
 * application, sign in from a restored session and start a paper with no network at all.
 *
 * Question crops are deliberately absent. They are 34 MB — an install-time download of
 * that size on a phone would be indefensible — so they are cached as they are seen, or in
 * one deliberate batch the candidate asks for. See `app/service-worker.js`.
 */
const shellPatterns = [
  /^index\.html$/,
  /^404\.html$/,
  /^manifest\.webmanifest$/,
  /^favicon\.svg$/,
  /^og\.jpg$/,
  /^icons\/[^/]+\.png$/,
  /^assets\/[^/]+\.(?:js|css|woff2?)$/,
  /^data\/(?:question-bank|original-mocks|offline-library)\.json$/,
];

async function listFiles(directoryUrl = distUrl, prefix = "") {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await listFiles(new URL(`${entry.name}/`, directoryUrl), `${relativePath}/`));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

// Question crops belong to the question bank, not to the deployment. Keying their cache on
// the bank and mock versions means a redeploy keeps a 34 MB offline library that is still
// correct, while a genuine bank rebuild retires it.
const mocks = JSON.parse(await readFile(mocksUrl, "utf8"));
const libraryVersion = createHash("sha256")
  .update(`${runtimeBank.version}|${runtimeBank.specificationVersion}|${mocks.version}`)
  .digest("hex")
  .slice(0, 16);

const builtFiles = await listFiles();
const libraryFiles = builtFiles.filter((file) => file.startsWith("questions/")).sort();
const librarySizes = await Promise.all(libraryFiles.map(async (file) => (await stat(new URL(file, distUrl))).size));
const libraryBytes = librarySizes.reduce((sum, size) => sum + size, 0);

// The manifest the application reads to size, drive and report the offline download. It is
// generated here rather than derived in the browser because the browser cannot enumerate
// what was deployed, and a hand-maintained list would silently rot. It is written before
// the shell is hashed so that it is itself precached: the offline status panel has to be
// readable with no network.
await writeFile(
  new URL("data/offline-library.json", distUrl),
  JSON.stringify({
    libraryVersion,
    fileCount: libraryFiles.length,
    totalBytes: libraryBytes,
    files: libraryFiles.map((file) => `./${file}`),
  }),
  "utf8",
);

const shellFiles = (await listFiles()).filter((file) => shellPatterns.some((pattern) => pattern.test(file))).sort();
if (!shellFiles.includes("index.html")) throw new Error("prepare_dist: the built shell has no index.html to precache.");

// The build identity is derived from the bytes of the shell rather than from a timestamp,
// so an unchanged rebuild produces an unchanged worker and installed clients are never
// told to reload for nothing.
const shellDigest = createHash("sha256");
for (const file of shellFiles) {
  shellDigest.update(file);
  shellDigest.update(await readFile(new URL(file, distUrl)));
}
const buildId = shellDigest.digest("hex").slice(0, 16);

const serviceWorker = (await readFile(serviceWorkerSourceUrl, "utf8"))
  .replace('"__ESAT_BUILD_ID__"', JSON.stringify(buildId))
  .replace('"__ESAT_LIBRARY_VERSION__"', JSON.stringify(libraryVersion))
  .replace('["__ESAT_PRECACHE__"]', JSON.stringify(shellFiles.map((file) => `./${file}`)));
for (const token of ["__ESAT_BUILD_ID__", "__ESAT_LIBRARY_VERSION__", "__ESAT_PRECACHE__"]) {
  if (serviceWorker.includes(token)) throw new Error(`prepare_dist: ${token} was not substituted into the service worker.`);
}
await writeFile(new URL("sw.js", distUrl), serviceWorker, "utf8");

console.log(JSON.stringify({
  runtimeQuestions: runtimeBank.questions.length,
  compactBankBytes: Buffer.byteLength(JSON.stringify(runtimeBank)),
  buildId,
  libraryVersion,
  precachedShellFiles: shellFiles.length,
  offlineLibraryFiles: libraryFiles.length,
  offlineLibraryBytes: libraryBytes,
}));
