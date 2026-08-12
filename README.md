# ESAT Atlas

A Cambridge Engineering ESAT preparation platform: sit real past papers by year, take
harder-than-exam original mocks, and get a section-level breakdown with an estimated
1.0–9.0 score for every attempt.

It is a **single static site** with **Firebase (Google) authentication** and per-user
Firestore storage. There is no server to run and no other authentication path.

## What is included

- **Past papers by year.** 517 validated archive questions across NSAA Section 1,
  uncrossed ENGAA Part B and TMUA Paper 1 (2016–2023). Pick a module, a source and a
  year and sit that paper in its printed question order at ESAT pace.
- **Original challenge mocks.** 81 authored questions — one 27-question module each for
  Mathematics 1, Physics and Mathematics 2 — deliberately pitched above archive
  difficulty, with five options per question and code-derived answers.
- **Strict simulation.** 27-question, 40-minute modules and a sequential three-module
  Engineering mock. Timestamp-derived timing, automatic submission, reload recovery and
  multi-tab warnings.
- **Result history and analysis.** Every completion keeps its paper, raw score, accuracy,
  estimated score, standing, per-section (topic) breakdown, pacing analysis and a full
  question-by-question log.
- **Mistake diagnosis and spaced retrieval** on a transparent 1–3–7–14–30 day schedule.
- **Data portability.** JSON and CSV export of every attempt, response and note.

ENGAA Part A is ignored because it duplicates NSAA material. The crossed-out
even-numbered Part B questions are excluded as outside ESAT; 27 remaining Part B
questions that duplicate NSAA are linked as alternate sources rather than shipped twice.
TMUA intake is restricted to Paper 1.

## Scoring: what is measured and what is estimated

Raw marks are exact. The 1.0–9.0 figure is an **ESAT Atlas estimate**, never an official
score. UAT-UK equates each live form with a Rasch model and does not publish the
conversion tables, so the estimate is anchored only on published facts — a typical
candidate scores about 4.5, and about 10% of candidates score above 7.0 — plus one
stated modelling assumption. The full curve and the cohort model are shown in the
application under **Settings → Methodology** and on every attempt breakdown. The estimate
can be switched off entirely in Settings.

## Run locally

```bash
npm install
npm run dev
```

Firebase client configuration is public by design and is bundled. In the Firebase
console: enable the Google sign-in provider, add each deployed hostname under
**Authentication → Settings → Authorized domains**, and deploy `firestore.rules`.

## Build

```bash
npm run build
```

This produces `dist/` — a standalone `index.html`, compiled CSS/JavaScript, the complete
question bank, the original mocks and every question image. All paths are relative, so it
works from a repository sub-path. Source maps are not published.

Do not open `dist/index.html` over a `file://` URL: browsers block module and Firebase
requests there. Serve it over HTTP(S) — `npm run preview` does this locally.

## Publish with GitHub Pages

See `GITHUB-PAGES.md`. The included workflow builds on every push to `main` and publishes
`dist/`.

## Quality checks

```bash
npm test
```

That runs, in order: question-bank validation, TypeScript, ESLint, unit tests, the
production build, and assertions against the built output. Individual steps are available
as `validate:bank`, `typecheck`, `lint`, `test:unit` and `test:build`.

`validate:bank` independently checks shipped images and answers against the supplied
official keys and worked solutions, source/year/module totals, duplicate policy, file
inventory, IDs and hashes. Contact sheets under `public/qa` support full visual crop
review. The original mocks run deterministic answer, option, difficulty and
specification-coverage assertions during generation, and the published answer key is
snapshot-tested.

## Rebuild generated data

```bash
npm run build:bank
npm run build:mocks
```

Python 3.12+ with `requirements.txt` installed is required for these two commands and for
`validate:bank` — nothing else needs Python. `scripts/run_python.mjs` picks the first
interpreter that can import the required packages; set `ESAT_PYTHON` to point it at a
specific one:

```bash
python -m pip install -r requirements.txt
```

The supplied PDFs remain authoritative. OCR-derived text is
used only for indexing, duplicate detection and conservative topic tagging; learners see
the rendered source question. The original mocks are labelled as authored practice and
never as official UAT-UK material.

## Layout

```
app/          application code (esat-app.tsx, lib/core.ts, lib/scoring.ts, lib/firebase.ts)
static/       the single HTML entry point and its React root
public/       question bank, original mocks, question images, QA contact sheets
scripts/      Python builders and the independent bank validator
tests/        unit tests and built-output assertions
```
