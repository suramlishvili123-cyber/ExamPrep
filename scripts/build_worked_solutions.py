"""Render and attach the official TMUA worked-solution pages to the built bank.

This targeted builder is intentionally separate from question cropping so a content-only
solution refresh does not need to re-render all 517 archive questions. The full extended
bank builder also performs the same work, so both fresh and incremental builds converge.
"""

from __future__ import annotations

import json
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium

from build_question_bank import render_solution_pages, sha256, solution_page_ranges


APP_DIR = Path(__file__).resolve().parents[1]
PUBLIC_DIR = APP_DIR / "public"
DATA_PATH = PUBLIC_DIR / "data" / "question-bank.json"
TMUA_DIR = APP_DIR.parent / "TMUA1"
QUESTIONS_DIR = PUBLIC_DIR / "questions"


def build() -> None:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    questions: list[dict[str, object]] = payload["questions"]
    tmua_questions = [question for question in questions if question.get("sourceExam") == "TMUA"]
    if len(tmua_questions) != 160:
        raise RuntimeError(f"Expected 160 TMUA questions in the built bank, found {len(tmua_questions)}")

    rendered_count = 0
    for year in range(2016, 2024):
        solution_path = TMUA_DIR / f"TMUA-{year}-paper-1-worked-answers.pdf"
        page_ranges = solution_page_ranges(solution_path)
        solution_source_hash = sha256(solution_path)
        year_questions = sorted(
            (question for question in tmua_questions if int(question["year"]) == year),
            key=lambda question: int(question["originalQuestionNumber"]),
        )
        if len(year_questions) != 20:
            raise RuntimeError(f"TMUA {year}: expected 20 bank questions, found {len(year_questions)}")

        with pdfplumber.open(str(solution_path)) as plumber_doc:
            pages = list(plumber_doc.pages)
            render_doc = pdfium.PdfDocument(str(solution_path))
            for question in year_questions:
                number = int(question["originalQuestionNumber"])
                page_indexes = page_ranges[number]
                destination = QUESTIONS_DIR / "solutions" / "tmua" / str(year) / f"q{number:02d}.webp"
                image_hash, dimensions = render_solution_pages(
                    render_doc,
                    pages,
                    page_indexes,
                    destination,
                    dpi=180,
                )
                question.update(
                    {
                        "answerSourceHash": solution_source_hash,
                        "workedSolutionImage": "/" + destination.relative_to(PUBLIC_DIR).as_posix(),
                        "workedSolutionSource": f"Official TMUA {year} Paper 1 worked solutions",
                        "workedSolutionSourcePages": [page_index + 1 for page_index in page_indexes],
                        "workedSolutionPageCount": len(page_indexes),
                        "workedSolutionImageHash": image_hash,
                        "workedSolutionImageDimensions": {
                            "width": dimensions[0],
                            "height": dimensions[1],
                        },
                    }
                )
                rendered_count += 1

    payload.setdefault("summary", {}).setdefault("qualityAssurance", {}).update(
        {
            "officialWorkedSolutionAssets": rendered_count,
            "workedSolutionPolicy": "Official TMUA solution pages; answer-key-only NSAA/ENGAA items use labelled topic examples in the interface",
        }
    )
    temporary_path = DATA_PATH.with_suffix(".json.tmp")
    temporary_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(DATA_PATH)
    print(json.dumps({"workedSolutionAssets": rendered_count, "bank": str(DATA_PATH)}, indent=2))


if __name__ == "__main__":
    build()
