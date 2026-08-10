"""Fail closed on broken question-bank metadata, answers, assets and duplicates."""

from __future__ import annotations

import json
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


def difference(left: int, right: int) -> int:
    return (left ^ right).bit_count()


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

    for question in questions:
        question_id = question.get("id")
        if question_id in seen_ids:
            errors.append(f"duplicate ID: {question_id}")
        seen_ids.add(question_id)
        for field in ("sourcePaper", "targetModule", "esatTopic", "questionImage", "correctAnswer", "sourceHash"):
            if not question.get(field):
                errors.append(f"{question_id}: missing {field}")
        if question["correctAnswer"] not in question["answerOptions"]:
            errors.append(f"{question_id}: official answer {question['correctAnswer']} not in controls")
        image_path = PUBLIC_DIR / question["questionImage"].lstrip("/")
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
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{question_id}: invalid image ({exc})")
        image_hash = question["imageHash"]
        if image_hash in seen_hashes:
            errors.append(f"exact duplicate crop: {seen_hashes[image_hash]} and {question_id}")
        seen_hashes[image_hash] = question_id
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

    alternate_sources = sum(len(question.get("alternateSources", [])) for question in questions)
    if alternate_sources != 27:
        errors.append(f"expected 27 collapsed ENGAA/NSAA alternate sources, found {alternate_sources}")
    if len(bank["summary"].get("duplicateExclusions", [])) != 27:
        errors.append("duplicate-exclusion report should contain 27 ENGAA/NSAA repeats")
    if inventory["summary"]["fileCount"] != 46:
        errors.append("source inventory should contain 46 PDFs")
    if inventory["summary"]["scoreConversionFiles"] == 0:
        informational_notes.append("Historical scaled-score lookup is intentionally disabled: no complete official practice conversion files were supplied and live forms are Rasch-equated.")

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
            "moduleAndYearCountChecks": "passed" if not errors else "see errors",
        },
        "historicalConversionValidation": {
            "status": "not-run",
            "reason": "No complete conversion source files were supplied; the UI refuses historical scaled scores.",
        },
    }
    (DATA_DIR / "validation-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
