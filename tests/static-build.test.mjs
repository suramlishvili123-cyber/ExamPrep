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
  assert.match(bundle, /Checked worked solution|Verified answer key/);
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

test("the built site is installable as an application", async () => {
  const html = await readDist("index.html");
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"/, "iOS reads none of the manifest for the home screen");

  const manifest = JSON.parse(await readDist("manifest.webmanifest"));
  // Everything must be relative, or an installed application on a repository sub-path
  // would start at the domain root and show someone else's site.
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  for (const shortcut of manifest.shortcuts ?? []) assert.match(shortcut.url, /^\.\//, shortcut.name);

  const purposes = new Set(manifest.icons.map((icon) => icon.purpose));
  assert.ok(purposes.has("maskable"), "an installer that crops to a circle needs a maskable icon");
  for (const icon of manifest.icons) {
    assert.doesNotMatch(icon.src, /^\//, icon.src);
    const asset = await stat(new URL(icon.src, distUrl));
    assert.ok(asset.isFile() && asset.size > 500, icon.src);
  }
});

test("the service worker precaches a complete, self-contained application shell", async () => {
  const worker = await readDist("sw.js");
  for (const token of ["__ESAT_BUILD_ID__", "__ESAT_LIBRARY_VERSION__", "__ESAT_PRECACHE__"]) {
    assert.doesNotMatch(worker, new RegExp(token), `${token} must be substituted at build time`);
  }
  // `Cache.match` honours Vary, and a static host sends `Vary: Origin`. Without this the
  // document loads offline but its own module script does not, which is worse than useless.
  assert.match(worker, /ignoreVary:\s*true/);

  const precached = JSON.parse(worker.match(/const PRECACHE_URLS = (\[[^\]]*\]);/)[1]);
  assert.ok(precached.every((url) => url.startsWith("./")), "precached URLs must be relative");
  for (const url of precached) {
    const asset = await stat(new URL(url.replace(/^\.\//, ""), distUrl));
    assert.ok(asset.isFile(), url);
  }

  // The shell has to be enough to open the application and sit a paper end to end.
  const assets = await readdir(new URL("assets/", distUrl));
  for (const required of [
    "./index.html",
    "./manifest.webmanifest",
    "./data/question-bank.json",
    "./data/original-mocks.json",
    "./data/offline-library.json",
    `./assets/${assets.find((name) => name.endsWith(".js"))}`,
    `./assets/${assets.find((name) => name.endsWith(".css"))}`,
  ]) {
    assert.ok(precached.includes(required), `${required} must be precached`);
  }
  // 34 MB of question crops are not precached; they are cached on sight or on request.
  assert.equal(precached.filter((url) => url.startsWith("./questions/")).length, 0);
});

test("the offline library manifest matches what was actually published", async () => {
  const manifest = JSON.parse(await readDist("data/offline-library.json"));
  assert.ok(manifest.fileCount > 600, `expected the full archive, got ${manifest.fileCount}`);
  assert.equal(manifest.files.length, manifest.fileCount);
  assert.ok(manifest.totalBytes > 10_000_000, "the reported download size must be real");

  let measured = 0;
  for (const file of manifest.files) {
    assert.match(file, /^\.\/questions\//, file);
    measured += (await stat(new URL(file.replace(/^\.\//, ""), distUrl))).size;
  }
  assert.equal(measured, manifest.totalBytes, "the advertised size must be the size on disk");
});

test("Firebase is the only authentication path in the bundle", async () => {
  const assets = await readdir(new URL("assets/", distUrl));
  const bundle = await readDist(`assets/${assets.find((name) => name.endsWith(".js"))}`);
  assert.match(bundle, /identitytoolkit\.googleapis\.com|firebaseapp\.com/);
  assert.doesNotMatch(bundle, /oai-authenticated-user-id|signin-with-chatgpt/);
});
