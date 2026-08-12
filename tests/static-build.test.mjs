import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const distUrl = new URL("../dist/", import.meta.url);

async function readDist(relativePath) {
  return readFile(new URL(relativePath, distUrl), "utf8");
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
