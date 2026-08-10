"""Regenerate only question crops that sit at historic part boundaries."""

from __future__ import annotations

import hashlib
import json

import pdfplumber
import pypdfium2 as pdfium

from build_question_bank import (
    DATA_DIR,
    PUBLIC_DIR,
    QUESTIONS_DIR,
    SOURCE_DIR,
    YEAR_CONFIG,
    locate_question_starts,
    make_contact_sheets,
    question_segments,
    render_crop,
)


def main() -> None:
    bank_path = DATA_DIR / "question-bank.json"
    bank = json.loads(bank_path.read_text(encoding="utf-8"))
    by_key = {(int(q["year"]), int(q["originalQuestionNumber"])): q for q in bank["questions"]}
    for year, config in YEAR_CONFIG.items():
        boundaries = [config["part_size"], config["part_size"] * 2]
        question_path = SOURCE_DIR / f"NSAA_{year}_S1_QuestionPaper.pdf"
        with pdfplumber.open(str(question_path)) as plumber_doc:
            pages = list(plumber_doc.pages)
            starts = locate_question_starts(pages, config["maximum"])
            render_doc = pdfium.PdfDocument(str(question_path))
            for number in boundaries:
                question = by_key[(year, number)]
                segments = question_segments(pages, starts[number], None)
                destination = QUESTIONS_DIR / str(year) / f"q{number:02d}.webp"
                image_hash, dimensions = render_crop(render_doc, pages, segments, destination)
                question["questionImage"] = "/" + destination.relative_to(PUBLIC_DIR).as_posix()
                question["imageHash"] = image_hash
                question["imageDimensions"] = {"width": dimensions[0], "height": dimensions[1]}
                question["cropSegments"] = [
                    {"sourcePage": page + 1, "top": round(top, 2), "bottom": round(bottom, 2)}
                    for page, top, bottom in segments
                ]
    make_contact_sheets(bank["questions"])
    bank_path.write_text(json.dumps(bank, indent=2), encoding="utf-8")
    print("Boundary crops regenerated and metadata updated")


if __name__ == "__main__":
    main()
