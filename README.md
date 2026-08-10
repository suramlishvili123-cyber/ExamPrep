# ESAT Atlas

An evidence-led Cambridge Engineering ESAT preparation platform built from the supplied NSAA, ENGAA and TMUA archives plus an original stretch mock set.

## What is included

- 517 validated archive questions: 134 Mathematics 1, 134 Physics and 249 Mathematics 2.
- Source-aware history for 295 NSAA questions, 62 unique uncrossed ENGAA Part B questions and 160 TMUA Paper 1 questions.
- 81 original, formula-checked challenge questions: one 27-question module for Mathematics 1, Physics and Mathematics 2.
- Strict 27-question, 40-minute modules and sequential three-module Engineering mocks.
- Custom practice, exact historic source sets, mistake diagnosis, spaced retrieval and fresh-versus-retake analytics.
- Timestamp-derived timing, automatic submission, reload recovery and multi-tab warnings.
- Device-local persistence by default, with optional private Google/Firebase sync.
- Exact raw marks and qualitative practice signals. No invented practice-to-ESAT scaled-score conversion.

ENGAA Part A is ignored because it duplicates NSAA material. The crossed-out even-numbered Part B questions are excluded as outside ESAT; 27 remaining Part B questions that duplicate NSAA are linked as alternate sources rather than shipped twice. TMUA intake is restricted to Paper 1.

## Run locally

```bash
npm install
python -m pip install -r requirements.txt
npm run dev
```

Copy `.env.example` to `.env.local` to enable Firebase sync. In Firebase, enable Google Authentication and deploy `firestore.rules`.

The generated-data commands automatically use the bundled Codex PDF runtime when available. Elsewhere, install `requirements.txt` or set `ESAT_PYTHON` to a compatible interpreter.

## Quality checks

```bash
npm run validate:bank
npm run typecheck
npm run lint
npm test
```

`validate:bank` independently checks shipped images and answers against the supplied official keys/worked solutions, source/year/module totals, duplicate policy, file inventory, IDs and hashes. Contact sheets under `public/qa` support full visual crop review. Original mocks also run deterministic answer and option assertions during generation.

## Rebuild generated data

```bash
npm run build:bank
npm run build:mocks
```

The supplied PDFs remain authoritative. OCR-derived text is used only for indexing, duplicate detection and conservative topic tagging; learners see the rendered source question. The original mocks are clearly labelled as authored practice and never as official UAT-UK material.
