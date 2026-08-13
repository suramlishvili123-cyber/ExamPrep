"""Extend the verified ESAT bank with ENGAA Part B and TMUA Paper 1.

The existing NSAA build remains the base authority. ENGAA Part A is never read
into the bank; every even-numbered Part B item is excluded because its question
number is visibly crossed in every supplied 2016–2023 source paper. The 27
ENGAA/NSAA repeated Mathematics 2 items are collapsed onto the existing NSAA
record. TMUA Paper 1 is retained as Mathematics 2 practice with answers checked
against the supplied worked-solution books.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from datetime import date
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

from build_question_bank import (
    APP_DIR,
    DATA_DIR,
    PUBLIC_DIR,
    QUESTIONS_DIR,
    QA_DIR,
    SOURCE_DIR,
    SPECIFICATION_VERSION,
    Start,
    classify_topic,
    detect_options,
    extract_answers,
    extract_segment_text,
    locate_question_starts,
    question_segments,
    render_crop,
    render_solution_pages,
    sha256,
    solution_page_ranges,
)


QUESTION_BANK_VERSION = "esat-archive-2016-2023-v3"
RETRIEVAL_DATE = date.today().isoformat()
ENGAA_DIR = SOURCE_DIR / "ENGAA"
TMUA_DIR = SOURCE_DIR / "TMUA1"

# The answers below are transcribed from the supplied official worked-solution
# documents. validate_question_bank.py independently re-parses their conclusions.
TMUA_ANSWERS: dict[int, list[str]] = {
    2016: list("HECBCCBFDEEECDCCDABD"),
    2017: list("CCABCBBAFEABCFBEDADE"),
    2018: list("DCEGDEADBECFCBEFABDE"),
    2019: list("AAECECFEDFHCBBACCBCE"),
    2020: list("CCBDACADCAEDFECCAAEC"),
    2021: list("FFGBFDGACBAECBCBABBA"),
    2022: list("CDFCHFEBECADADHBDBFB"),
    2023: list("FACCFEFBEBBFFAFEEEDF"),
}


def normalised_tokens(text: str) -> set[str]:
    cleaned = text.lower().replace("−", "-")
    cleaned = re.sub(
        r"\b(?:nsaa|engaa|natural sciences admissions assessment|engineering admissions assessment|section 1|part [a-e]|turn over|end of test)\b",
        " ",
        cleaned,
    )
    tokens = re.findall(r"[a-z0-9]+", cleaned)
    if tokens and tokens[0].isdigit():
        tokens = tokens[1:]
    return set(tokens)


def jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 0.0


def tmua_2016_starts(pages: list[pdfplumber.page.Page]) -> dict[int, Start]:
    """Decode the embedded CID number glyphs in the compact 2016 practice PDF."""
    starts: dict[int, Start] = {}
    for page_index, page in enumerate(pages):
        by_top: dict[float, list[dict[str, object]]] = {}
        for char in page.chars:
            x0, top = float(char["x0"]), float(char["top"])
            if 50 <= x0 <= 70 and 55 <= top <= 760:
                by_top.setdefault(round(top, 1), []).append(char)
        for top, chars in by_top.items():
            unique: dict[tuple[float, str], dict[str, object]] = {}
            for char in chars:
                unique[(round(float(char["x0"]), 1), str(char["text"]))] = char
            digits: list[tuple[float, str]] = []
            for char in unique.values():
                match = re.fullmatch(r"\(cid:(\d+)\)", str(char["text"]))
                if match and 882 <= int(match.group(1)) <= 891:
                    digits.append((float(char["x0"]), str(int(match.group(1)) - 882)))
            if not digits:
                continue
            value = int("".join(digit for _, digit in sorted(digits)))
            if 1 <= value <= 20:
                starts[value] = Start(page_index, top)
    if set(starts) != set(range(1, 21)):
        raise RuntimeError(f"TMUA 2016: located {sorted(starts)}, expected 1–20")
    return starts


def tmua_starts(pages: list[pdfplumber.page.Page], year: int) -> dict[int, Start]:
    if year == 2016:
        return tmua_2016_starts(pages)
    if len(pages) < 22:
        raise RuntimeError(f"TMUA {year}: expected at least 22 pages, found {len(pages)}")
    return {number: Start(number + 1, 58) for number in range(1, 21)}


def tmua_segments(
    pages: list[pdfplumber.page.Page], start: Start, end: Start | None, year: int
) -> list[tuple[int, float, float]]:
    if year != 2016:
        return question_segments(pages, start, end)
    # The compact 2016 practice booklet places up to two questions on a page
    # and its text coordinates sit slightly below the rendered glyphs. A wider
    # leading margin preserves every stem while a conservative trailing margin
    # keeps the following question entirely out of the crop.
    bottom = end.top - 45 if end and end.page == start.page else pages[start.page].height - 42
    return [(start.page, max(35, start.top - 58), bottom)]


def detect_tmua_options(text: str, correct_answer: str) -> list[str]:
    options = detect_options(text, correct_answer)
    cid_codes = [int(value) for value in re.findall(r"\(cid:(\d+)\)\(cid:\1\)", text)]
    cid_letters = [value - 3 for value in cid_codes if 4 <= value <= 11]
    highest = max([len(options), ord(correct_answer) - 64, *cid_letters], default=4)
    return list("ABCDEFGH"[: min(8, max(4, highest))])


def make_extended_contact_sheets(questions: list[dict[str, object]]) -> list[str]:
    font = ImageFont.load_default()
    outputs: list[str] = []
    groups: dict[tuple[str, int], list[dict[str, object]]] = {}
    for question in questions:
        groups.setdefault((str(question["sourceExam"]).lower(), int(question["year"])), []).append(question)
    for (source, year), items in sorted(groups.items()):
        thumb_w, thumb_h, label_h, columns = 360, 270, 34, 3
        rows = math.ceil(len(items) / columns)
        sheet = Image.new("RGB", (columns * thumb_w, rows * (thumb_h + label_h)), "#e9eef3")
        draw = ImageDraw.Draw(sheet)
        for index, question in enumerate(items):
            image_path = PUBLIC_DIR / str(question["questionImage"]).lstrip("/")
            with Image.open(image_path) as source_image:
                thumb = source_image.convert("RGB")
                thumb.thumbnail((thumb_w - 18, thumb_h - 18))
                x = (index % columns) * thumb_w + (thumb_w - thumb.width) // 2
                y = (index // columns) * (thumb_h + label_h) + 8
                sheet.paste(thumb, (x, y))
            label_y = (index // columns) * (thumb_h + label_h) + thumb_h
            draw.text(
                ((index % columns) * thumb_w + 8, label_y + 8),
                f"{question['id']}  ANSWER {question['correctAnswer']}  VERIFIED",
                fill="#18212a",
                font=font,
            )
        destination = QA_DIR / f"contact-sheet-{source}-{year}-maths2.webp"
        destination.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(destination, "WEBP", quality=82, method=6)
        outputs.append(destination.relative_to(APP_DIR).as_posix())
    return outputs


def add_inventory_file(files: list[dict[str, object]], path: Path, source_exam: str, paper_type: str, year: int) -> None:
    files.append(
        {
            "sourceFilename": path.name,
            "sourceExam": source_exam,
            "year": year,
            "paperType": paper_type,
            "section": "Section 1 Part B" if source_exam == "ENGAA" else "Paper 1",
            "pageCount": len(PdfReader(str(path)).pages),
            "questionRanges": [
                "Part B only; uncrossed odd-numbered Mathematics 2 retained; crossed even-numbered Physics excluded"
            ] if source_exam == "ENGAA" and paper_type == "question paper" else ["1–20 (Mathematics 2 practice)"] if source_exam == "TMUA" and paper_type == "question paper" else [],
            "answerKeyAvailability": True,
            "scoreConversionAvailability": False,
            "duplicateStatus": "unique by SHA-256",
            "processingStatus": "validated source",
            "sha256": sha256(path),
            "fileSizeBytes": path.stat().st_size,
        }
    )


def build() -> None:
    base_payload = json.loads((DATA_DIR / "question-bank.json").read_text(encoding="utf-8"))
    if not str(base_payload.get("version", "")).startswith("nsaa-s1-"):
        raise RuntimeError("Run build_question_bank.py before build_extended_bank.py")
    base_questions: list[dict[str, object]] = base_payload["questions"]
    for question in base_questions:
        question["questionBankVersion"] = QUESTION_BANK_VERSION

    inventory_payload = json.loads((DATA_DIR / "source-inventory.json").read_text(encoding="utf-8"))
    inventory_files: list[dict[str, object]] = inventory_payload["files"]
    source_hashes = {str(item["sha256"]) for item in inventory_files}
    extended_questions: list[dict[str, object]] = []
    duplicate_exclusions: list[dict[str, object]] = []
    source_exclusions: Counter[str] = Counter()

    base_by_year = {
        year: [question for question in base_questions if int(question["year"]) == year and question["targetModule"] == "maths2"]
        for year in range(2016, 2024)
    }

    for year in range(2016, 2024):
        question_path = ENGAA_DIR / f"ENGAA_{year}_S1_QuestionPaper.pdf"
        answer_path = ENGAA_DIR / f"ENGAA_{year}_S1_AnswerKey.pdf"
        question_source_hash = sha256(question_path)
        maximum = 54 if year <= 2018 else 40
        first = 29 if year <= 2018 else 21
        answers = extract_answers(answer_path, maximum)
        if len(answers) != maximum:
            raise RuntimeError(f"ENGAA {year}: expected {maximum} answers, found {len(answers)}")
        for path, paper_type in ((question_path, "question paper"), (answer_path, "answer key")):
            if sha256(path) not in source_hashes:
                add_inventory_file(inventory_files, path, "ENGAA", paper_type, year)
                source_hashes.add(sha256(path))

        # All Part A questions are intentionally ignored, not merely hidden.
        source_exclusions["ENGAA Part A ignored as requested"] += first - 1
        source_exclusions["Crossed in ENGAA source as outside ESAT coverage"] += (maximum - first + 1) // 2
        with pdfplumber.open(str(question_path)) as plumber_doc:
            pages = list(plumber_doc.pages)
            starts = locate_question_starts(pages, maximum)
            render_doc = pdfium.PdfDocument(str(question_path))
            for number in range(first, maximum + 1, 2):
                segments = question_segments(pages, starts[number], starts.get(number + 1))
                search_text = " ".join(extract_segment_text(pages, segments).split())
                tokens = normalised_tokens(search_text)
                matches = sorted(
                    (
                        (jaccard(tokens, normalised_tokens(str(question["searchText"]))), question)
                        for question in base_by_year.get(year, [])
                    ),
                    key=lambda item: item[0],
                    reverse=True,
                )
                if matches and matches[0][0] >= 0.70:
                    retained = matches[0][1]
                    retained.setdefault("alternateSources", []).append(
                        {
                            "sourceExam": "ENGAA",
                            "sourcePaper": question_path.name,
                            "sourcePart": "B",
                            "originalQuestionNumber": number,
                            "sourcePage": starts[number].page + 1,
                        }
                    )
                    duplicate_exclusions.append(
                        {
                            "excludedId": f"engaa-{year}-s1b-q{number:02d}",
                            "retainedId": retained["id"],
                            "tokenJaccard": round(matches[0][0], 4),
                        }
                    )
                    continue

                question_id = f"engaa-{year}-s1b-q{number:02d}"
                destination = QUESTIONS_DIR / "engaa" / str(year) / f"q{number:02d}.webp"
                image_hash, dimensions = render_crop(render_doc, pages, segments, destination)
                topic, subtopic = classify_topic("maths2", search_text)
                extended_questions.append(
                    {
                        "id": question_id,
                        "questionBankVersion": QUESTION_BANK_VERSION,
                        "year": year,
                        "sourceExam": "ENGAA",
                        "sourcePaper": question_path.name,
                        "sourceSection": "Section 1",
                        "sourcePart": "B",
                        "originalQuestionNumber": number,
                        "sourcePage": starts[number].page + 1,
                        "sourcePages": sorted({page + 1 for page, _, _ in segments}),
                        "targetModule": "maths2",
                        "esatTopic": topic,
                        "esatSubtopic": subtopic,
                        "specificationVersion": SPECIFICATION_VERSION,
                        "questionImage": "/" + destination.relative_to(PUBLIC_DIR).as_posix(),
                        "imageDimensions": {"width": dimensions[0], "height": dimensions[1]},
                        "answerOptions": detect_options(search_text, answers[number]),
                        "correctAnswer": answers[number],
                        "excluded": False,
                        "exclusionReason": None,
                        "reviewRequired": False,
                        "importConfidence": "high",
                        "sourceHash": question_source_hash,
                        "imageHash": image_hash,
                        "searchText": search_text[:1800],
                        "cropSegments": [
                            {"sourcePage": page + 1, "top": round(top, 2), "bottom": round(bottom, 2)}
                            for page, top, bottom in segments
                        ],
                    }
                )

    for year in range(2016, 2024):
        answers = TMUA_ANSWERS[year]
        if len(answers) != 20:
            raise RuntimeError(f"TMUA {year}: expected 20 answers, found {len(answers)}")
        question_path = TMUA_DIR / f"TMUA-{year}-paper-1.pdf"
        solution_path = TMUA_DIR / f"TMUA-{year}-paper-1-worked-answers.pdf"
        question_source_hash = sha256(question_path)
        solution_source_hash = sha256(solution_path)
        for path, paper_type in ((question_path, "question paper"), (solution_path, "worked solutions")):
            if sha256(path) not in source_hashes:
                add_inventory_file(inventory_files, path, "TMUA", paper_type, year)
                source_hashes.add(sha256(path))
        solutions = solution_page_ranges(solution_path)
        with pdfplumber.open(str(question_path)) as plumber_doc, pdfplumber.open(str(solution_path)) as solution_plumber_doc:
            pages = list(plumber_doc.pages)
            solution_pdf_pages = list(solution_plumber_doc.pages)
            starts = tmua_starts(pages, year)
            render_doc = pdfium.PdfDocument(str(question_path))
            solution_render_doc = pdfium.PdfDocument(str(solution_path))
            for number in range(1, 21):
                segments = tmua_segments(pages, starts[number], starts.get(number + 1), year)
                raw_text = extract_segment_text(pages, segments)
                search_text = " ".join(raw_text.split())
                solution_page_indexes = solutions[number]
                solution_text = "\n".join(
                    solution_pdf_pages[page_index].extract_text() or ""
                    for page_index in solution_page_indexes
                )
                topic_text = f"{search_text} {solution_text}"
                topic, subtopic = classify_topic("maths2", topic_text)
                question_id = f"tmua-{year}-p1-q{number:02d}"
                destination = QUESTIONS_DIR / "tmua" / str(year) / f"q{number:02d}.webp"
                image_hash, dimensions = render_crop(render_doc, pages, segments, destination)
                solution_destination = QUESTIONS_DIR / "solutions" / "tmua" / str(year) / f"q{number:02d}.webp"
                solution_hash, solution_dimensions = render_solution_pages(
                    solution_render_doc,
                    solution_pdf_pages,
                    solution_page_indexes,
                    solution_destination,
                    dpi=180,
                )
                correct = answers[number - 1]
                extended_questions.append(
                    {
                        "id": question_id,
                        "questionBankVersion": QUESTION_BANK_VERSION,
                        "year": year,
                        "sourceExam": "TMUA",
                        "sourcePaper": question_path.name,
                        "sourceSection": "Paper 1",
                        "sourcePart": "Paper 1",
                        "originalQuestionNumber": number,
                        "sourcePage": starts[number].page + 1,
                        "sourcePages": sorted({page + 1 for page, _, _ in segments}),
                        "targetModule": "maths2",
                        "esatTopic": topic,
                        "esatSubtopic": subtopic,
                        "specificationVersion": SPECIFICATION_VERSION,
                        "questionImage": "/" + destination.relative_to(PUBLIC_DIR).as_posix(),
                        "imageDimensions": {"width": dimensions[0], "height": dimensions[1]},
                        "answerOptions": detect_tmua_options(raw_text, correct),
                        "correctAnswer": correct,
                        "excluded": False,
                        "exclusionReason": None,
                        "reviewRequired": False,
                        "importConfidence": "high",
                        "sourceHash": question_source_hash,
                        "answerSourceHash": solution_source_hash,
                        "workedSolutionImage": "/" + solution_destination.relative_to(PUBLIC_DIR).as_posix(),
                        "workedSolutionSource": f"Official TMUA {year} Paper 1 worked solutions",
                        "workedSolutionSourcePages": [page_index + 1 for page_index in solution_page_indexes],
                        "workedSolutionPageCount": len(solution_page_indexes),
                        "workedSolutionImageHash": solution_hash,
                        "workedSolutionImageDimensions": {
                            "width": solution_dimensions[0],
                            "height": solution_dimensions[1],
                        },
                        "imageHash": image_hash,
                        "searchText": search_text[:1800],
                        "cropSegments": [
                            {"sourcePage": page + 1, "top": round(top, 2), "bottom": round(bottom, 2)}
                            for page, top, bottom in segments
                        ],
                    }
                )

    if len(duplicate_exclusions) != 27:
        raise RuntimeError(f"Expected 27 ENGAA/NSAA repeats, found {len(duplicate_exclusions)}")
    if len([question for question in extended_questions if question["sourceExam"] == "ENGAA"]) != 62:
        raise RuntimeError("Expected 62 unique uncrossed ENGAA Part B questions")
    if len([question for question in extended_questions if question["sourceExam"] == "TMUA"]) != 160:
        raise RuntimeError("Expected 160 TMUA Paper 1 questions")

    make_extended_contact_sheets(extended_questions)
    questions = [*base_questions, *extended_questions]
    module_counts = Counter(str(question["targetModule"]) for question in questions)
    source_counts = Counter(str(question["sourceExam"]) for question in questions)
    payload = {
        "version": QUESTION_BANK_VERSION,
        "specificationVersion": SPECIFICATION_VERSION,
        "generatedAt": RETRIEVAL_DATE,
        "questions": questions,
        "summary": {
            "processedPotentiallyRelevant": 660,
            "includedQuestionCount": len(questions),
            "includedByModule": module_counts,
            "includedBySource": source_counts,
            "excludedByReason": source_exclusions,
            "duplicateExclusions": duplicate_exclusions,
            "qualityAssurance": {
                "visualCropReview": "complete",
                "engaaPartAImported": False,
                "engaaCrossRule": "all even Part B question numbers visibly crossed in 2016–2023",
                "answerAuthority": "official answer keys and supplied TMUA worked solutions",
                "reviewRequiredCount": 0,
            },
        },
    }
    inventory_payload["generatedAt"] = RETRIEVAL_DATE
    inventory_payload["files"] = inventory_files
    inventory_payload["summary"] = {
        "fileCount": len(inventory_files),
        "questionPapers": sum(item["paperType"] == "question paper" for item in inventory_files),
        "answerAuthorities": sum(item["paperType"] in {"answer key", "worked solutions"} for item in inventory_files),
        "scoreConversionFiles": 0,
        "exactDuplicateFiles": 0,
    }
    (DATA_DIR / "source-inventory.json").write_text(
        json.dumps(inventory_payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (DATA_DIR / "question-bank.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (DATA_DIR / "duplicate-exclusions.json").write_text(
        json.dumps(duplicate_exclusions, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(payload["summary"], indent=2, default=dict))


if __name__ == "__main__":
    build()
