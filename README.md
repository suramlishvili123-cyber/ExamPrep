# ESAT Atlas

An independent Cambridge Engineering ESAT preparation platform: sit historic papers by
year, take harder-than-exam original mocks, and get a section-level breakdown with an
estimated 1.0–9.0 score only when a result is sufficiently representative.

It is a **single static site** with **Firebase (Google) authentication** and per-user
Firestore storage. There is no server to run and no other authentication path.

## What is included

- **Past papers by year.** 517 validated archive questions across NSAA Section 1,
  uncrossed ENGAA Part B and TMUA Paper 1 (2016–2023). Pick a module, a source and a
  year and sit that paper in its printed question order at ESAT pace.
- **Original challenge mocks.** 81 authored questions — one 27-question module each for
  Mathematics 1, Physics and Mathematics 2 — deliberately pitched above archive
  difficulty, with five options per question and code-derived answers. Twelve items carry
  a generated figure, each shipped with alt text that restates every value the figure
  shows, so the question is answerable without seeing it.
- **Strict simulation.** 27-question, 40-minute modules and a sequential three-module
  Engineering mock. Timestamp-derived timing, automatic submission, reload recovery and
  multi-tab warnings.
- **Result history and analysis.** Every completion keeps its paper, raw score, accuracy,
  estimated score, standing, per-section (topic) breakdown, pacing analysis and a full
  question-by-question log.
- **Per-question timing.** Finishing a session — including a single-question retry —
  reports the seconds spent on each question against the 89-second ESAT reference,
  coloured by outcome. Time spent on the review list belongs to no question and is
  excluded from that attribution, though it still counts towards session length.
- **Mistake diagnosis and one-pass retrieval.** A missed question returns the next day —
  overnight, so the redo tests recall rather than working memory. Answer it correctly
  once and it clears for good; miss it again and it comes back tomorrow, so nothing
  unresolved is quietly dropped. The queue is grouped into what is ready to redo now and
  what returns tomorrow.
- **Mistake-cause analytics.** The causes recorded against missed questions are
  summarised by frequency, module and topic, with a trend that is withheld until enough
  mistakes are diagnosed. Self-reported, so it guides revision and never feeds readiness.
- **Study consistency.** A streak and a 26-week calendar built from completed sessions,
  shaded on fixed minute thresholds so a light week never looks like a heavy one.
- **Worked learning support on every question.** The 81 authored items retain their
  checked derivations, all 160 TMUA items show the supplied publisher worked-solution
  page, and the 357 answer-key-only NSAA/ENGAA items receive a clearly labelled,
  specification-matched worked example with a best method, fastest valid route and
  common traps. Source provenance is never blurred.
- **Quick Tricks learning centre.** Twenty-two topic playbooks and eight universal
  exam tactics teach calculator-free shortcuts together with their validity checks,
  cautions and worked examples.
- **Adaptive daily study plan.** A deterministic, evidence-led plan combines due
  retrieval, missing baselines, first-exposure topic weakness, fresh coverage, exam
  phase and available study time. Every recommendation shows its rationale, launches
  the exact selected questions and keeps retakes separate from readiness evidence.
- **Data portability and control.** JSON and CSV export of every attempt, response and
  note; clearing this device (which signs out and leaves the cloud copy intact); and
  permanent erasure of either the account's stored revision data or the account itself.
  The device copy is a bounded cache — under storage pressure it sheds detail in tiers,
  always keeping the session in progress and the full profile.

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

This produces `dist/` — a standalone `index.html`, compiled CSS/JavaScript, a compact
runtime projection of the question bank, the original mocks and every runtime question
image. QA contact sheets, OCR, crop coordinates and internal provenance manifests remain
local and are not published. All paths are relative, so it works from a repository
sub-path. Source maps are not published.

Do not open `dist/index.html` over a `file://` URL: browsers block module and Firebase
requests there. Serve it over HTTP(S) — `npm run preview` does this locally.

## Publish with GitHub Pages

See `GITHUB-PAGES.md`. The included workflow builds on every push to `main` and publishes
`dist/`.

## Launch gates

The engineering pipeline being green is necessary but not sufficient for public launch.
Before publishing, the operator must:

- obtain written permission or qualified legal clearance for redistribution of the
  historic question and worked-solution crops, and record the applicable attribution;
- replace the operator placeholder in `PRIVACY.md` with a legal identity and contact;
- deploy and test the current `firestore.rules`, Firebase authorised domain and Google
  sign-in provider against the production hostname; and
- complete a keyboard/screen-reader review. The historic publisher material is image-
  based and does not yet have a fully reviewed accessible transcript for every item.

See `PRIVACY.md` and `TERMS.md`. ESAT Atlas is not affiliated with or endorsed by UAT-UK,
Pearson VUE, Cambridge or Imperial.

## Quality checks

```bash
npm test
```

That runs, in order: question-bank validation, TypeScript, ESLint, unit tests, the
production build, and assertions against the built output. Individual steps are available
as `validate:bank`, `typecheck`, `lint`, `test:unit` and `test:build`.

`validate:bank` independently checks shipped images and answers against the supplied
official keys and worked solutions, source/year/module totals, duplicate policy, file
inventory, IDs and hashes. It also verifies all 160 official worked-solution images and
their provenance. Contact sheets under `public/qa` support full local visual crop review
but the production post-build step removes them from `dist/`. The original mocks run
deterministic answer, option, difficulty and
specification-coverage assertions during generation, and the published answer key is
snapshot-tested. Figure pairing is asserted from both ends: generation rejects a mapping
that names a question nobody authored, and it rejects a rendered PNG that no question
references, so a figure can never appear beside the wrong stem.

## Rebuild generated data

```bash
npm run build:bank
npm run build:mocks
npm run build:solutions
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

`build:solutions` is the incremental path for refreshing the official TMUA solution
assets without re-rendering the complete archive. A full `build:bank` also creates those
assets and finishes by restoring the module-specific ESAT topic taxonomy.

## Layout

```
app/          application code (esat-app.tsx, lib/core.ts, lib/scoring.ts, lib/firebase.ts)
static/       the single HTML entry point and its React root
public/       question bank, original mocks, question images, QA contact sheets
scripts/      Python builders and the independent bank validator
tests/        unit tests and built-output assertions
```
