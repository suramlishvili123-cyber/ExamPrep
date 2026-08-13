import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const distUrl = new URL("../dist/", import.meta.url);
const publicUrl = new URL("../public/", import.meta.url);

async function readDist(relativePath) {
  return readFile(new URL(relativePath, distUrl), "utf8");
}

async function listDistFiles(directoryUrl = distUrl, prefix = "") {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listDistFiles(new URL(`${entry.name}/`, directoryUrl), `${relativePath}/`));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

async function sha256(url) {
  return createHash("sha256").update(await readFile(url)).digest("hex");
}

test("the published bundle is a self-contained static site", async () => {
  const html = await readDist("index.html");
  assert.match(html, /<title>ESAT Atlas \| Cambridge Engineering Preparation<\/title>/i);
  assert.match(html, /<div id="root">/);
  // Every asset reference must be relative so a repository sub-path URL resolves.
  assert.doesNotMatch(html, /(?:src|href)="\/[^/]/);
  assert.match(html, /name="esat-asset-base" content="\.\/"/);
});

test("the data the application fetches at runtime is published", async () => {
  for (const file of ["data/question-bank.json", "data/original-mocks.json"]) {
    const contents = JSON.parse(await readDist(file));
    assert.ok(Array.isArray(contents.questions) && contents.questions.length > 0, file);
  }
});

test("the full local bank matches every shipped archive and solution hash", async () => {
  const bank = JSON.parse(await readFile(new URL("data/question-bank.json", publicUrl), "utf8"));
  let solutionChecks = 0;
  let continuationSolutions = 0;
  for (const question of bank.questions) {
    const questionUrl = new URL(question.questionImage.replace(/^\//, ""), publicUrl);
    assert.equal(await sha256(questionUrl), question.imageHash, `${question.id}: question image hash`);
    if (!question.workedSolutionImage) continue;
    solutionChecks += 1;
    const solutionUrl = new URL(question.workedSolutionImage.replace(/^\//, ""), publicUrl);
    assert.equal(await sha256(solutionUrl), question.workedSolutionImageHash, `${question.id}: solution image hash`);
    assert.equal(question.workedSolutionSourcePages.length, question.workedSolutionPageCount, question.id);
    if (question.workedSolutionPageCount > 1) continuationSolutions += 1;
  }
  assert.equal(solutionChecks, 160);
  assert.equal(continuationSolutions, 10);
});

test("worked-solution assets and the Quick Tricks learning surface ship", async () => {
  const bank = JSON.parse(await readDist("data/question-bank.json"));
  const worked = bank.questions.filter((question) => question.workedSolutionImage);
  assert.equal(worked.length, 160);
  for (const question of worked) {
    const asset = await stat(new URL(question.workedSolutionImage.replace(/^\//, ""), distUrl));
    assert.ok(asset.isFile() && asset.size > 1_000, question.id);
  }

  const assets = await readdir(new URL("assets/", distUrl));
  const bundle = await readDist(`assets/${assets.find((name) => name.endsWith(".js"))}`);
  assert.match(bundle, /Quick tricks/);
  assert.match(bundle, /Fastest valid route/);
  assert.match(bundle, /Verified key \+ matched example/);
});

test("internal QA and provenance manifests are excluded from production", async () => {
  await assert.rejects(stat(new URL("qa/", distUrl)), { code: "ENOENT" });
  await assert.rejects(stat(new URL("data/source-inventory.json", distUrl)), { code: "ENOENT" });
});

test("the local source inventory is portable and sanitized", async () => {
  const inventory = JSON.parse(await readFile(new URL("data/source-inventory.json", publicUrl), "utf8"));
  assert.equal(Object.hasOwn(inventory, "sourceDirectory"), false);
  assert.equal(inventory.files.length, 46);
  for (const source of inventory.files) {
    assert.equal(Object.hasOwn(source, "sourcePath"), false, source.sourceFilename);
    assert.match(source.sha256, /^[0-9a-f]{64}$/, source.sourceFilename);
    assert.ok(["NSAA", "ENGAA", "TMUA"].includes(source.sourceExam), source.sourceFilename);
  }
});

test("published text assets never expose a developer machine path", async () => {
  const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt", ".webmanifest", ".xml"]);
  const textFiles = (await listDistFiles()).filter((file) => {
    const dot = file.lastIndexOf(".");
    return dot >= 0 && textExtensions.has(file.slice(dot).toLowerCase());
  });
  const machinePath = /[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]|\/(?:Users|home)\/[^/\s"']+/i;
  for (const file of textFiles) {
    assert.doesNotMatch(await readDist(file), machinePath, `${file} contains an absolute machine path`);
  }
});

test("no source maps or development artefacts are published", async () => {
  const assets = await readdir(new URL("assets/", distUrl));
  assert.equal(assets.filter((name) => name.endsWith(".map")).length, 0, "source maps must not ship");
  assert.ok(assets.some((name) => name.endsWith(".js")), "a bundle must exist");
  assert.ok(assets.some((name) => name.endsWith(".css")), "a stylesheet must exist");
});

test("a GitHub Pages deep-link fallback exists", async () => {
  const fallback = await stat(new URL("404.html", distUrl));
  assert.ok(fallback.isFile());
});

test("Firebase is the only authentication path in the bundle", async () => {
  const assets = await readdir(new URL("assets/", distUrl));
  const bundle = await readDist(`assets/${assets.find((name) => name.endsWith(".js"))}`);
  assert.match(bundle, /identitytoolkit\.googleapis\.com|firebaseapp\.com/);
  assert.doesNotMatch(bundle, /oai-authenticated-user-id|signin-with-chatgpt/);
});
