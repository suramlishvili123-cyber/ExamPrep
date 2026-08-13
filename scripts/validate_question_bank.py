"""Fail closed on broken question-bank metadata, answers, assets and duplicates."""

from __future__ import annotations

import json
import hashlib
from collections import Counter
from pathlib import Path
import re

import pdfplumber
from PIL import Image


APP_DIR = Path(__file__).resolve().parents[1]
PUBLIC_DIR = APP_DIR / "public"
DATA_DIR = PUBLIC_DIR / "data"
SOURCE_DIR = APP_DIR.parent
ENGAA_DIR = SOURCE_DIR / "ENGAA"
TMUA_DIR = SOURCE_DIR / "TMUA1"
KNOWN_NON_DUPLICATES = {
    frozenset(("nsaa-2017-s1-q87", "nsaa-2019-s1-q89")),
    frozenset(("nsaa-2022-s1-q01", "nsaa-2022-s1-q07")),
    # Visually checked on the 2016 contact sheet: a sequence/summation item
    # and an algebraic-roots item with a similar sparse full-page layout.
    frozenset(("tmua-2016-p1-q04", "tmua-2016-p1-q11")),
}

# A small number of worked solutions establish the answer by calculation or a
# labelled graph without ending in a machine-readable "option X" sentence.
# These values were checked directly against the displayed source question.
TMUA_SOLUTION_FALLBACKS: dict[int, dict[int, str]] = {
    2016: {18: "A"},
    2018: {12: "F", 13: "C", 19: "D"},
    2019: {15: "A"},
    2020: {17: "A"},
    2021: {17: "A", 20: "A"},
    2023: {1: "F"},
}

TRAILING_SOLUTION_PAGE_PATTERNS = (
    re.compile(r"^We are Cambridge Assessment Admissions Testing\b", re.IGNORECASE),
    re.compile(r"^This document was initially designed for print\b", re.IGNORECASE),
)
WINDOWS_ABSOLUTE_PATH = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]")
POSIX_HOME_PATH = re.compile(r"(?:^|[\s\"'])/(?:Users|home)/[^/\s\"']+")


def difference(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dhash(path: Path) -> int:
    with Image.open(path) as source:
        image = source.convert("L").resize((9, 8))
        pixels = list(image.get_flattened_data())
    value = 0
    for row in range(8):
        for column in range(8):
            value = (value << 1) | int(pixels[row * 9 + column] > pixels[row * 9 + column + 1])
    return value


def text_tokens(value: str) -> set[str]:
    # Some older TMUA PDFs expose embedded-font glyphs as repeated ``(cid:N)``
    # placeholders. ``cid`` is layout noise, not semantic evidence of a match.
    return {token for token in re.findall(r"[a-z]{3,}", value.lower()) if token not in {"cid", "which", "following", "answer", "question"}}


def parse_tmua_solution_answers(path: Path) -> dict[int, str]:
    text = "\n".join((page.extract_text() or "") for page in pdfplumber.open(path).pages)
    starts: dict[int, int] = {}
    for number in range(1, 21):
        matches = list(re.finditer(rf"(?m)^Question\s+{number}\s*$", text))
        if not matches:
            continue
        starts[number] = matches[-1].start()
    answers: dict[int, str] = {}
    for number in range(1, 21):
        if number not in starts:
            continue
        section = text[starts[number] : starts.get(number + 1, len(text))]
        found: list[str] = []
        for pattern in (
            r"\boption\s+([A-H])\b",
            r"\b(?:correct\s+)?answer\s+(?:must\s+be|is|as)\s*(?:therefore\s*)?(?:option\s*)?([A-H])\b",
            r"\bcorrect\s+(?:answer|option)\s+is\s*(?:thus\s+|therefore\s+)?(?:option\s*)?([A-H])\b",
            r"\b(?:which|this)\s+is\s+(?:option|graph)\s*([A-H])\b",
            r"\bwhich\s+is\s+graph\s*([A-H])\b",
            r"\banswer\s+must\s+be\s*([A-H])\s*:",
        ):
            found.extend(re.findall(pattern, section, re.IGNORECASE | re.DOTALL))
        if found:
            answers[number] = found[-1].upper()
    year_match = re.search(r"TMUA-(\d{4})", path.name)
    if year_match:
        answers.update(TMUA_SOLUTION_FALLBACKS.get(int(year_match.group(1)), {}))
    return answers


def solution_page_ranges(path: Path) -> dict[int, list[int]]:
    """Independently derive the complete page range for every worked solution."""
    with pdfplumber.open(path) as document:
        page_text = [(page.extract_text() or "") for page in document.pages]
    starts: dict[int, int] = {}
    for number in range(1, 21):
        matches = [
            page_index
            for page_index, text in enumerate(page_text)
            if re.search(rf"\bQuestion\s+{number}\b", text)
        ]
        if not matches:
            raise RuntimeError(f"{path.name}: no worked-solution section for Q{number}")
        starts[number] = matches[-1]
    ordered = [starts[number] for number in range(1, 21)]
    if ordered != sorted(set(ordered)):
        raise RuntimeError(f"{path.name}: worked-solution headings are not strictly ordered")

    content_end = len(page_text)
    while content_end > starts[20] + 1:
        normalized = " ".join(page_text[content_end - 1].split())
        if not any(pattern.search(normalized) for pattern in TRAILING_SOLUTION_PAGE_PATTERNS):
            break
        content_end -= 1
    return {
        number: list(range(starts[number], starts[number + 1] if number < 20 else content_end))
        for number in range(1, 21)
    }


def inventory_source_path(record: dict[str, object]) -> Path:
    source_exam = record.get("sourceExam")
    filename = str(record.get("sourceFilename", ""))
    if source_exam == "ENGAA":
        return ENGAA_DIR / filename
    if source_exam == "TMUA":
        return TMUA_DIR / filename
    return SOURCE_DIR / filename


def iter_strings(value: object):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, child in value.items():
            yield str(key)
            yield from iter_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_strings(child)


def contains_machine_path(value: str) -> bool:
    return bool(WINDOWS_ABSOLUTE_PATH.search(value) or POSIX_HOME_PATH.search(value))


def main() -> None:
    bank = json.loads((DATA_DIR / "question-bank.json").read_text(encoding="utf-8"))
    inventory = json.loads((DATA_DIR / "source-inventory.json").read_text(encoding="utf-8"))
    questions = bank["questions"]
    errors: list[str] = []
    warnings: list[str] = []
    informational_notes: list[str] = []
    seen_ids: set[str] = set()
    seen_hashes: dict[str, str] = {}
    perceptual: list[tuple[str, int, set[str]]] = []
    question_image_hash_checks = 0
    source_file_hash_checks = 0
    source_hash_correspondence_checks = 0
    worked_solution_hash_checks = 0
    worked_solution_continuation_assets = 0
    seen_solution_assets: set[str] = set()
    qa_contact_sheet_checks = 0

    for label, payload in (("question bank", bank), ("source inventory", inventory)):
        leaked_values = sorted({value for value in iter_strings(payload) if contains_machine_path(value)})
        if leaked_values:
            errors.append(f"{label}: machine-specific absolute path leaked into published metadata")
    if "sourceDirectory" in inventory:
        errors.append("source inventory: sourceDirectory must not be published")
    if bank.get("summary", {}).get("contactSheets"):
        errors.append("question bank: internal contact-sheet URLs must not be published")
    published_qa_dir = PUBLIC_DIR / "qa"
    if published_qa_dir.exists() and any(published_qa_dir.rglob("*")):
        errors.append("internal QA files must live in top-level qa/, not public/qa/")
    qa_contact_sheets = sorted((APP_DIR / "qa").glob("contact-sheet-*.webp"))
    if len(qa_contact_sheets) != 33:
        errors.append(f"expected 33 local QA contact sheets, found {len(qa_contact_sheets)}")
    for contact_sheet in qa_contact_sheets:
        try:
            with Image.open(contact_sheet) as image:
                image.verify()
            qa_contact_sheet_checks += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"invalid QA contact sheet {contact_sheet.name}: {exc}")

    inventory_by_filename: dict[str, dict[str, object]] = {}
    for record in inventory.get("files", []):
        filename = str(record.get("sourceFilename", ""))
        if not filename:
            errors.append("source inventory: record without sourceFilename")
            continue
        if filename in inventory_by_filename:
            errors.append(f"source inventory: duplicate filename {filename}")
        inventory_by_filename[filename] = record
        if "sourcePath" in record:
            errors.append(f"source inventory: {filename} exposes sourcePath")
        if record.get("sourceExam") not in {"NSAA", "ENGAA", "TMUA"}:
            errors.append(f"source inventory: {filename} has invalid sourceExam {record.get('sourceExam')}")
        declared_hash = record.get("sha256")
        if not isinstance(declared_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", declared_hash):
            errors.append(f"source inventory: {filename} has invalid SHA-256")
            continue
        source_path = inventory_source_path(record)
        if source_path.exists():
            source_file_hash_checks += 1
            actual_hash = sha256(source_path)
            if actual_hash != declared_hash:
                errors.append(f"source inventory: {filename} SHA-256 disagrees with source file")
        else:
            warnings.append(f"source inventory: source file unavailable for hash check: {filename}")

    for question in questions:
        question_id = question.get("id")
        if question_id in seen_ids:
            errors.append(f"duplicate ID: {question_id}")
        seen_ids.add(question_id)
        for field in (
            "sourcePaper",
            "targetModule",
            "esatTopic",
            "questionImage",
            "correctAnswer",
            "sourceHash",
            "imageHash",
            "imageDimensions",
        ):
            if not question.get(field):
                errors.append(f"{question_id}: missing {field}")
        source_record = inventory_by_filename.get(str(question.get("sourcePaper", "")))
        if not source_record:
            errors.append(f"{question_id}: source paper is absent from source inventory")
        elif question.get("sourceHash") != source_record.get("sha256"):
            errors.append(f"{question_id}: sourceHash disagrees with source inventory")
        else:
            source_hash_correspondence_checks += 1
        if question["correctAnswer"] not in question["answerOptions"]:
            errors.append(f"{question_id}: official answer {question['correctAnswer']} not in controls")
        image_path = (PUBLIC_DIR / str(question["questionImage"]).lstrip("/")).resolve()
        if not image_path.is_relative_to(PUBLIC_DIR.resolve()):
            errors.append(f"{question_id}: question image escapes the public directory")
            continue
        if not image_path.exists():
            errors.append(f"{question_id}: missing asset {image_path}")
            continue
        try:
            with Image.open(image_path) as image:
                image.verify()
            with Image.open(image_path) as image:
                width, height = image.size
            if width < 900 or height < 180:
                errors.append(f"{question_id}: suspicious crop dimensions {width}x{height}")
            declared_dimensions = question.get("imageDimensions")
            if declared_dimensions != {"width": width, "height": height}:
                errors.append(f"{question_id}: image dimensions disagree with asset")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{question_id}: invalid image ({exc})")
            continue
        actual_image_hash = sha256(image_path)
        question_image_hash_checks += 1
        if actual_image_hash != question.get("imageHash"):
            errors.append(f"{question_id}: question image hash mismatch")
        if actual_image_hash in seen_hashes:
            errors.append(f"exact duplicate crop: {seen_hashes[actual_image_hash]} and {question_id}")
        seen_hashes[actual_image_hash] = question_id
        perceptual.append((question_id, dhash(image_path), text_tokens(question.get("searchText", ""))))
        if question["reviewRequired"]:
            errors.append(f"{question_id}: unresolved review flag remains")
        if question["excluded"]:
            errors.append(f"{question_id}: excluded question was shipped in the working bank")
        if question["sourcePart"] in {"C", "D"}:
            errors.append(f"{question_id}: Chemistry/Biology entered working bank")

    potential_duplicates = []
    for index, (left_id, left_hash, left_tokens) in enumerate(perceptual):
        for right_id, right_hash, right_tokens in perceptual[index + 1 :]:
            union = left_tokens | right_tokens
            similarity = len(left_tokens & right_tokens) / len(union) if union else 0
            if (
                difference(left_hash, right_hash) <= 4
                and similarity >= 0.82
                and frozenset((left_id, right_id)) not in KNOWN_NON_DUPLICATES
            ):
                potential_duplicates.append([left_id, right_id])
    if potential_duplicates:
        warnings.append(f"{len(potential_duplicates)} perceptual near-pairs require manual review")

    counts = Counter(question["targetModule"] for question in questions)
    held = sum(question["reviewRequired"] for question in questions)
    if counts != Counter({"maths1": 134, "physics": 134, "maths2": 249}):
        errors.append(f"unexpected approved counts: {dict(counts)}")
    if len(questions) != 517:
        errors.append(f"expected 517 verified in-scope questions, found {len(questions)}")
    if held:
        errors.append(f"expected no unresolved review flags, found {held}")
    expected_by_year = {
        2017: Counter({"maths1": 18, "physics": 18, "maths2": 9}),
        2018: Counter({"maths1": 18, "physics": 18, "maths2": 9}),
        2019: Counter({"maths1": 18, "physics": 18, "maths2": 9}),
        2020: Counter({"maths1": 20, "physics": 20}),
        2021: Counter({"maths1": 20, "physics": 20}),
        2022: Counter({"maths1": 20, "physics": 20}),
        2023: Counter({"maths1": 20, "physics": 20}),
    }
    actual_by_year = {
        year: Counter(question["targetModule"] for question in questions if question["year"] == year and question["sourceExam"] == "NSAA")
        for year in expected_by_year
    }
    for year, expected in expected_by_year.items():
        if actual_by_year[year] != expected:
            errors.append(f"{year}: unexpected module counts {dict(actual_by_year[year])}")

    # Independently parse each official key with pdfplumber and compare every
    # shipped answer against the bank produced through pypdf.
    answer_cross_checks = 0
    for year, maximum in {2017: 90, 2018: 90, 2019: 90, 2020: 80, 2021: 80, 2022: 80, 2023: 80}.items():
        answer_path = SOURCE_DIR / f"NSAA_{year}_S1_AnswerKey.pdf"
        with pdfplumber.open(answer_path) as document:
            key_text = "\n".join((page.extract_text() or "") for page in document.pages)
        independent: dict[int, str] = {}
        for match in re.finditer(r"\bQ?(\d{1,2})\s*([A-H])\b", key_text):
            number = int(match.group(1))
            if 1 <= number <= maximum and number not in independent:
                independent[number] = match.group(2)
        if len(independent) != maximum:
            errors.append(f"{year}: independent answer-key parse found {len(independent)} of {maximum} answers")
        for question in (item for item in questions if item["year"] == year and item["sourceExam"] == "NSAA"):
            answer_cross_checks += 1
            expected = independent.get(question["originalQuestionNumber"])
            if expected != question["correctAnswer"]:
                errors.append(
                    f"{question['id']}: bank answer {question['correctAnswer']} disagrees with independent key {expected}"
                )
    expected_engaa_counts = {2016: 13, 2017: 4, 2018: 4, 2019: 1, 2020: 10, 2021: 10, 2022: 10, 2023: 10}
    for year, expected_count in expected_engaa_counts.items():
        answer_path = ENGAA_DIR / f"ENGAA_{year}_S1_AnswerKey.pdf"
        maximum = 54 if year <= 2018 else 40
        with pdfplumber.open(answer_path) as document:
            key_text = "\n".join((page.extract_text() or "") for page in document.pages)
        independent: dict[int, str] = {}
        for match in re.finditer(r"\bQ?(\d{1,2})\s*([A-H])\b", key_text):
            number = int(match.group(1))
            if 1 <= number <= maximum and number not in independent:
                independent[number] = match.group(2)
        source_questions = [item for item in questions if item["sourceExam"] == "ENGAA" and item["year"] == year]
        if len(source_questions) != expected_count:
            errors.append(f"ENGAA {year}: expected {expected_count} unique uncrossed items, found {len(source_questions)}")
        first = 29 if year <= 2018 else 21
        for question in source_questions:
            answer_cross_checks += 1
            number = question["originalQuestionNumber"]
            if number < first or number % 2 == 0:
                errors.append(f"{question['id']}: ENGAA Part A or crossed even Part B item shipped")
            if independent.get(number) != question["correctAnswer"]:
                errors.append(f"{question['id']}: answer disagrees with independent ENGAA key")

    for year in range(2016, 2024):
        solution_path = TMUA_DIR / f"TMUA-{year}-paper-1-worked-answers.pdf"
        independent = parse_tmua_solution_answers(solution_path)
        expected_solution_pages = solution_page_ranges(solution_path)
        solution_source_filename = solution_path.name
        solution_source_record = inventory_by_filename.get(solution_source_filename)
        if not solution_source_record:
            errors.append(f"TMUA {year}: worked-solution source is absent from source inventory")
        if len(independent) != 20:
            errors.append(f"TMUA {year}: independent worked-solution parse found {len(independent)} of 20 answers")
        source_questions = [item for item in questions if item["sourceExam"] == "TMUA" and item["year"] == year]
        if len(source_questions) != 20:
            errors.append(f"TMUA {year}: expected 20 Paper 1 items, found {len(source_questions)}")
        for question in source_questions:
            answer_cross_checks += 1
            expected = independent.get(question["originalQuestionNumber"])
            if expected != question["correctAnswer"]:
                errors.append(
                    f"{question['id']}: bank answer {question['correctAnswer']} disagrees with worked solution {expected}"
                )
            solution_asset = question.get("workedSolutionImage")
            if not solution_asset:
                errors.append(f"{question['id']}: missing official worked-solution asset")
                continue
            if question.get("workedSolutionSource") != f"Official TMUA {year} Paper 1 worked solutions":
                errors.append(f"{question['id']}: missing or incorrect worked-solution provenance")
            if solution_source_record and question.get("answerSourceHash") != solution_source_record.get("sha256"):
                errors.append(f"{question['id']}: answerSourceHash disagrees with source inventory")
            elif solution_source_record:
                source_hash_correspondence_checks += 1
            number = int(question["originalQuestionNumber"])
            expected_pages = [page_index + 1 for page_index in expected_solution_pages[number]]
            if question.get("workedSolutionSourcePages") != expected_pages:
                errors.append(
                    f"{question['id']}: worked-solution source pages {question.get('workedSolutionSourcePages')} "
                    f"do not cover expected pages {expected_pages}"
                )
            if question.get("workedSolutionPageCount") != len(expected_pages):
                errors.append(f"{question['id']}: worked-solution page count is incorrect")
            if len(expected_pages) > 1:
                worked_solution_continuation_assets += 1
            solution_asset_path = (PUBLIC_DIR / str(solution_asset).lstrip("/")).resolve()
            if not solution_asset_path.is_relative_to(PUBLIC_DIR.resolve()):
                errors.append(f"{question['id']}: worked-solution image escapes the public directory")
                continue
            if not solution_asset_path.exists():
                errors.append(f"{question['id']}: missing worked-solution asset {solution_asset_path}")
                continue
            normalized_solution_asset = solution_asset_path.as_posix().lower()
            if normalized_solution_asset in seen_solution_assets:
                errors.append(f"{question['id']}: worked-solution asset is reused by another question")
            seen_solution_assets.add(normalized_solution_asset)
            try:
                with Image.open(solution_asset_path) as image:
                    image.verify()
                with Image.open(solution_asset_path) as image:
                    solution_width, solution_height = image.size
                if solution_width < 900 or solution_height < 220:
                    errors.append(
                        f"{question['id']}: suspicious worked-solution dimensions {solution_width}x{solution_height}"
                    )
                declared_solution_dimensions = question.get("workedSolutionImageDimensions")
                if declared_solution_dimensions != {"width": solution_width, "height": solution_height}:
                    errors.append(f"{question['id']}: worked-solution dimensions disagree with asset")
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{question['id']}: invalid worked-solution image ({exc})")
                continue
            worked_solution_hash_checks += 1
            if sha256(solution_asset_path) != question.get("workedSolutionImageHash"):
                errors.append(f"{question['id']}: worked-solution image hash mismatch")

    worked_solution_count = sum(bool(question.get("workedSolutionImage")) for question in questions)
    if worked_solution_count != 160:
        errors.append(f"expected 160 official TMUA worked-solution assets, found {worked_solution_count}")
    unexpected_worked_solutions = [
        str(question["id"])
        for question in questions
        if question.get("sourceExam") != "TMUA" and question.get("workedSolutionImage")
    ]
    if unexpected_worked_solutions:
        errors.append(f"non-TMUA questions carry official worked-solution assets: {unexpected_worked_solutions[:5]}")
    if question_image_hash_checks != len(questions):
        errors.append(f"expected {len(questions)} question-image hash checks, completed {question_image_hash_checks}")
    if worked_solution_hash_checks != 160:
        errors.append(f"expected 160 worked-solution image hash checks, completed {worked_solution_hash_checks}")
    if worked_solution_continuation_assets != 10:
        errors.append(
            "expected 10 TMUA solutions with continuation pages, "
            f"found {worked_solution_continuation_assets}"
        )
    if source_file_hash_checks != len(inventory_by_filename):
        errors.append(
            f"expected {len(inventory_by_filename)} source-file hash checks, completed {source_file_hash_checks}"
        )
    if source_hash_correspondence_checks != len(questions) + 160:
        errors.append(
            f"expected {len(questions) + 160} source-hash correspondence checks, "
            f"completed {source_hash_correspondence_checks}"
        )

    alternate_sources = sum(len(question.get("alternateSources", [])) for question in questions)
    if alternate_sources != 27:
        errors.append(f"expected 27 collapsed ENGAA/NSAA alternate sources, found {alternate_sources}")
    if len(bank["summary"].get("duplicateExclusions", [])) != 27:
        errors.append("duplicate-exclusion report should contain 27 ENGAA/NSAA repeats")
    if inventory["summary"]["fileCount"] != len(inventory_by_filename):
        errors.append("source inventory summary fileCount disagrees with files array")
    if len(inventory_by_filename) != 46:
        errors.append("source inventory should contain 46 PDFs")
    if inventory["summary"]["scoreConversionFiles"] == 0:
        informational_notes.append("Official scaled-score reconstruction is intentionally disabled: no complete official conversion files were supplied and live forms are Rasch-equated. The interface shows only a clearly labelled estimate derived from published UAT-UK anchors.")

    report = {
        "status": "failed" if errors else "passed",
        "questionBankVersion": bank["version"],
        "questionCount": len(questions),
        "approvedCounts": dict(counts),
        "heldForReview": held,
        "excludedSourceMarkedOutOfScope": bank["summary"]["excludedByReason"],
        "sourceFileCount": inventory["summary"]["fileCount"],
        "errors": errors,
        "warnings": warnings,
        "informationalNotes": informational_notes,
        "potentialDuplicatePairs": potential_duplicates,
        "manuallyClearedNearPairs": sorted(sorted(pair) for pair in KNOWN_NON_DUPLICATES),
        "qualityAssurance": {
            "visualContactSheetReview": "complete",
            "cropsVisuallyReviewed": bank["summary"]["processedPotentiallyRelevant"],
            "inScopeCropsShipped": len(questions),
            "independentOfficialAnswerChecks": answer_cross_checks,
            "questionImageHashChecks": question_image_hash_checks,
            "sourceFileHashChecks": source_file_hash_checks,
            "sourceHashCorrespondenceChecks": source_hash_correspondence_checks,
            "localQaContactSheetChecks": qa_contact_sheet_checks,
            "officialWorkedSolutionAssets": worked_solution_count,
            "officialWorkedSolutionHashChecks": worked_solution_hash_checks,
            "workedSolutionContinuationAssets": worked_solution_continuation_assets,
            "moduleAndYearCountChecks": "passed" if not errors else "see errors",
        },
        "historicalConversionValidation": {
            "status": "not-run",
            "reason": "No complete conversion source files were supplied, so no official conversion is reproduced; the interface shows a labelled estimate built from published UAT-UK anchors instead.",
        },
    }
    (DATA_DIR / "validation-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
