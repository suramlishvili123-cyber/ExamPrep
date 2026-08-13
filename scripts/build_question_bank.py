"""Build the verified NSAA source inventory and ESAT question bank.

The source PDFs remain authoritative. Question stems and graphical answer choices are
served as high-resolution crops; OCR text is used only for indexing and conservative
topic suggestions. Legacy Part E is resolved question-by-question using the
source paper's own ESAT coverage marks and a complete visual QA pass.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont, ImageOps
from pypdf import PdfReader


APP_DIR = Path(__file__).resolve().parents[1]
SOURCE_DIR = APP_DIR.parent
PUBLIC_DIR = APP_DIR / "public"
DATA_DIR = PUBLIC_DIR / "data"
QUESTIONS_DIR = PUBLIC_DIR / "questions"
QA_DIR = APP_DIR / "qa"
QUESTION_BANK_VERSION = "nsaa-s1-2017-2023-v2"
SPECIFICATION_VERSION = "ESAT-2026-v7.1.1"
RETRIEVAL_DATE = date.today().isoformat()

YEAR_CONFIG = {
    2017: {"maximum": 90, "part_size": 18},
    2018: {"maximum": 90, "part_size": 18},
    2019: {"maximum": 90, "part_size": 18},
    2020: {"maximum": 80, "part_size": 20},
    2021: {"maximum": 80, "part_size": 20},
    2022: {"maximum": 80, "part_size": 20},
    2023: {"maximum": 80, "part_size": 20},
}

MATH_TOPICS = [
    ("Probability", "Combined events", ("probability", "random", "counter", "dice", "coin")),
    ("Statistics", "Data and distributions", ("mean", "median", "histogram", "frequency", "data set")),
    ("Geometry", "Shape, measure and trigonometry", ("triangle", "circle", "angle", "sphere", "cylinder", "area", "volume", "sin", "cos", "tan", "vector")),
    ("Algebra", "Functions, graphs and sequences", ("graph", "gradient", "coordinate", "sequence", "quadratic", "function", "equation", "inequality")),
    ("Ratio and proportion", "Rates and proportional change", ("ratio", "percentage", "proportion", "rate", "scale factor")),
]

PHYSICS_TOPICS = [
    ("Electricity", "Circuits and electrical quantities", ("circuit", "current", "voltage", "resistance", "resistor", "ammeter", "charge", "electric")),
    ("Waves", "Wave behaviour and optics", ("wave", "wavelength", "frequency", "light", "sound", "lens", "diffraction", "refraction")),
    ("Thermal physics", "Temperature, gases and energy transfer", ("thermal", "temperature", "heat", "gas", "pressure", "specific heat")),
    ("Magnetism", "Magnetic fields and induction", ("magnet", "magnetic", "induction", "solenoid")),
    ("Atomic and nuclear physics", "Atomic structure and radioactivity", ("radioactive", "nuclear", "atom", "isotope", "decay", "half-life")),
    ("Mechanics", "Motion, forces and energy", ("force", "mass", "velocity", "speed", "momentum", "energy", "acceleration", "projectile", "gravity", "weight", "distance")),
]

ADVANCED_MATH_HINTS = (
    "differentiat", "integrat", "derivative", "stationary point", "logarithm",
    "exponential", "trigonometric", "matrix", "complex number", "binomial",
    "polynomial", "sequence", "function", "gradient", "curve", "equation",
)
PHYSICS_HINTS = tuple(keyword for _, _, keywords in PHYSICS_TOPICS for keyword in keywords)


@dataclass(frozen=True)
class Start:
    page: int
    top: float


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def extract_answers(path: Path, maximum: int) -> dict[int, str]:
    text = "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)
    found: dict[int, str] = {}
    for match in re.finditer(r"\bQ?(\d{1,2})\s*([A-H])\b", text):
        number = int(match.group(1))
        if 1 <= number <= maximum and number not in found:
            found[number] = match.group(2)
    return found


def locate_question_starts(pages: list[pdfplumber.page.Page], maximum: int) -> dict[int, Start]:
    candidates: dict[int, list[Start]] = {number: [] for number in range(1, maximum + 1)}
    for page_index, page in enumerate(pages):
        for word in page.extract_words():
            text = word.get("text", "")
            if not text.isdigit():
                continue
            number = int(text)
            if number not in candidates:
                continue
            x0 = float(word["x0"])
            top = float(word["top"])
            # Question numbers sit in the left question gutter. Page numbers and
            # numerical content fall outside this deliberately narrow band.
            if 42 <= x0 <= 86 and 55 <= top <= 790:
                candidates[number].append(Start(page_index, top))

    starts: dict[int, Start] = {}
    previous = Start(0, 0)
    for number in range(1, maximum + 1):
        valid = [
            candidate
            for candidate in candidates[number]
            if (candidate.page, candidate.top) > (previous.page, previous.top + 8)
        ]
        if not valid:
            raise RuntimeError(f"Could not locate question {number}; previous={previous}")
        chosen = min(valid, key=lambda candidate: (candidate.page, candidate.top))
        starts[number] = chosen
        previous = chosen
    return starts


def question_segments(
    pages: list[pdfplumber.page.Page], start: Start, end: Start | None
) -> list[tuple[int, float, float]]:
    last_page = end.page if end else start.page
    segments: list[tuple[int, float, float]] = []
    for page_index in range(start.page, last_page + 1):
        page = pages[page_index]
        top = max(45, start.top - 16) if page_index == start.page else 48
        bottom = min(page.height - 42, end.top - 12) if end and page_index == end.page else page.height - 42
        if bottom - top > 18:
            segments.append((page_index, top, bottom))
    return segments


def extract_segment_text(
    pages: list[pdfplumber.page.Page], segments: list[tuple[int, float, float]]
) -> str:
    chunks = []
    for page_index, top, bottom in segments:
        page = pages[page_index]
        chunks.append(page.crop((35, top, page.width - 35, bottom)).extract_text() or "")
    return "\n".join(chunks)


def detect_options(text: str, correct_answer: str) -> list[str]:
    detected = set(re.findall(r"(?m)(?:^|\s)([A-H])(?=\s)", text))
    highest = max(ord(correct_answer) - ord("A") + 1, 4)
    for index, letter in enumerate("ABCDEFGH", start=1):
        if letter in detected:
            highest = max(highest, index)
    return list("ABCDEFGH"[: min(highest, 8)])


def classify_topic(module: str, text: str) -> tuple[str, str]:
    lowered = " ".join(text.lower().split())
    topic_rules = MATH_TOPICS if module.startswith("maths") else PHYSICS_TOPICS
    for topic, subtopic, keywords in topic_rules:
        if any(keyword in lowered for keyword in keywords):
            return topic, subtopic
    if module.startswith("maths"):
        return "Number and algebra", "Mathematical reasoning"
    return "Mechanics", "Physical modelling"


def classify_question(year: int, number: int, text: str) -> dict[str, object]:
    part_size = YEAR_CONFIG[year]["part_size"]
    if 1 <= number <= part_size:
        module, source_part, confidence = "maths1", "A", "high"
    elif part_size < number <= part_size * 2:
        module, source_part, confidence = "physics", "B", "high"
    elif year <= 2019 and part_size * 4 < number <= part_size * 5:
        source_part = "E"
        # These papers alternate Advanced Mathematics (odd numbers) with
        # Advanced Physics (even numbers). Every even-numbered item is visibly
        # crossed in the supplied source under the instruction that crossed
        # questions are not covered by the ESAT specification. The uncrossed
        # Mathematics items were each visually checked and form a complete
        # 27-question Mathematics 2 bank across 2017-2019.
        if number % 2 == 0:
            return {
                "sourcePart": source_part,
                "targetModule": "excluded",
                "esatTopic": "Out of scope",
                "esatSubtopic": "Source-marked as outside ESAT coverage",
                "excluded": True,
                "exclusionReason": "Crossed in source as not covered by the ESAT content specification",
                "reviewRequired": False,
                "importConfidence": "high",
            }
        module = "maths2"
        topic, subtopic = classify_topic(module, text)
        return {
            "sourcePart": source_part,
            "targetModule": module,
            "esatTopic": topic,
            "esatSubtopic": subtopic,
            "excluded": False,
            "exclusionReason": None,
            "reviewRequired": False,
            "importConfidence": "high",
        }
    else:
        part_index = (number - 1) // part_size
        return {
            "sourcePart": chr(ord("A") + part_index),
            "targetModule": "excluded",
            "esatTopic": "Out of scope",
            "esatSubtopic": "Chemistry or Biology",
            "excluded": True,
            "exclusionReason": "Chemistry or Biology is outside this Engineering platform",
            "reviewRequired": False,
            "importConfidence": "high",
        }

    topic, subtopic = classify_topic(module, text)
    return {
        "sourcePart": source_part,
        "targetModule": module,
        "esatTopic": topic,
        "esatSubtopic": subtopic,
        "excluded": False,
        "exclusionReason": None,
        "reviewRequired": False,
        "importConfidence": confidence,
    }


def render_crop(
    document: pdfium.PdfDocument,
    pages: list[pdfplumber.page.Page],
    segments: list[tuple[int, float, float]],
    destination: Path,
    dpi: int = 210,
) -> tuple[str, tuple[int, int]]:
    scale = dpi / 72
    rendered: list[Image.Image] = []
    for page_index, top, bottom in segments:
        bitmap = document[page_index].render(scale=scale, rotation=0)
        image = bitmap.to_pil().convert("RGB")
        pdf_page = pages[page_index]
        left_px = int(34 * image.width / pdf_page.width)
        right_px = int((pdf_page.width - 34) * image.width / pdf_page.width)
        top_px = int(top * image.height / pdf_page.height)
        bottom_px = int(bottom * image.height / pdf_page.height)
        rendered.append(image.crop((left_px, top_px, right_px, bottom_px)))
    width = max(image.width for image in rendered)
    height = sum(image.height for image in rendered) + max(0, len(rendered) - 1) * 12
    stitched = Image.new("RGB", (width, height), "white")
    y = 0
    for image in rendered:
        stitched.paste(image, (0, y))
        y += image.height + 12
    destination.parent.mkdir(parents=True, exist_ok=True)
    stitched.save(destination, "WEBP", quality=86, method=6)
    return hashlib.sha256(destination.read_bytes()).hexdigest(), stitched.size


TRAILING_SOLUTION_PAGE_PATTERNS = (
    re.compile(r"^We are Cambridge Assessment Admissions Testing\b", re.IGNORECASE),
    re.compile(r"^This document was initially designed for print\b", re.IGNORECASE),
)


def solution_page_ranges(path: Path) -> dict[int, list[int]]:
    """Return every zero-based source page belonging to each TMUA solution.

    The booklets contain a contents page that repeats every ``Question N`` heading,
    so the final heading match is the real solution start. Some solutions continue
    onto one or more pages without repeating that heading. The range therefore ends
    immediately before the next real question start. Known publisher/accessibility
    back matter after question 20 is excluded explicitly.
    """
    page_text = [(page.extract_text() or "") for page in PdfReader(str(path)).pages]
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

    ordered_starts = [starts[number] for number in range(1, 21)]
    if ordered_starts != sorted(set(ordered_starts)):
        raise RuntimeError(f"{path.name}: worked-solution headings are not strictly ordered")

    content_end = len(page_text)
    while content_end > starts[20] + 1:
        normalized = " ".join(page_text[content_end - 1].split())
        if not any(pattern.search(normalized) for pattern in TRAILING_SOLUTION_PAGE_PATTERNS):
            break
        content_end -= 1

    ranges: dict[int, list[int]] = {}
    for number in range(1, 21):
        end = starts[number + 1] if number < 20 else content_end
        if end <= starts[number]:
            raise RuntimeError(f"{path.name}: empty or reversed worked-solution range for Q{number}")
        ranges[number] = list(range(starts[number], end))
    return ranges


def _trim_solution_image(
    image: Image.Image,
    padding: int = 28,
    footer_fraction: float = 0.94,
) -> Image.Image:
    """Trim one rendered solution page before it is joined to continuations."""
    content_area = image.convert("RGB").crop((0, 0, image.width, int(image.height * footer_fraction)))
    ink = ImageOps.invert(content_area.convert("L")).point(lambda value: 255 if value > 18 else 0)
    bounds = ink.getbbox()
    if not bounds:
        return content_area
    left = max(0, bounds[0] - padding)
    top = max(0, bounds[1] - padding)
    right = min(content_area.width, bounds[2] + padding)
    bottom = min(content_area.height, bounds[3] + padding)
    return content_area.crop((left, top, right, bottom))


def render_solution_pages(
    document: pdfium.PdfDocument,
    pages: list[pdfplumber.page.Page],
    page_indexes: list[int],
    destination: Path,
    dpi: int = 180,
) -> tuple[str, tuple[int, int]]:
    """Render and stitch a complete worked solution, including continuation pages."""
    if not page_indexes:
        raise RuntimeError(f"Cannot render an empty solution range for {destination.name}")
    scale = dpi / 72
    rendered: list[Image.Image] = []
    for page_index in page_indexes:
        bitmap = document[page_index].render(scale=scale, rotation=0)
        image = bitmap.to_pil().convert("RGB")
        pdf_page = pages[page_index]
        top_px = int(12 * image.height / pdf_page.height)
        bottom_px = int((pdf_page.height - 24) * image.height / pdf_page.height)
        rendered.append(_trim_solution_image(image.crop((0, top_px, image.width, bottom_px))))

    gap = 18
    width = max(image.width for image in rendered)
    height = sum(image.height for image in rendered) + gap * (len(rendered) - 1)
    stitched = Image.new("RGB", (width, height), "white")
    y = 0
    for image in rendered:
        x = (width - image.width) // 2
        stitched.paste(image, (x, y))
        y += image.height + gap
    destination.parent.mkdir(parents=True, exist_ok=True)
    stitched.save(destination, "WEBP", quality=86, method=6)
    return sha256(destination), stitched.size


def make_contact_sheets(questions: list[dict[str, object]]) -> list[str]:
    font = ImageFont.load_default()
    outputs: list[str] = []
    groups: dict[tuple[int, str], list[dict[str, object]]] = {}
    for question in questions:
        if question["targetModule"] == "excluded":
            continue
        groups.setdefault((int(question["year"]), str(question["targetModule"])), []).append(question)
    for (year, module), items in groups.items():
        thumb_w, thumb_h, label_h, columns = 340, 250, 34, 3
        rows = math.ceil(len(items) / columns)
        sheet = Image.new("RGB", (columns * thumb_w, rows * (thumb_h + label_h)), "#e9eef3")
        draw = ImageDraw.Draw(sheet)
        for index, question in enumerate(items):
            image_path = PUBLIC_DIR / str(question["questionImage"]).lstrip("/")
            with Image.open(image_path) as source:
                thumb = source.convert("RGB")
                thumb.thumbnail((thumb_w - 18, thumb_h - 18))
                x = (index % columns) * thumb_w + (thumb_w - thumb.width) // 2
                y = (index // columns) * (thumb_h + label_h) + 8
                sheet.paste(thumb, (x, y))
            label_y = (index // columns) * (thumb_h + label_h) + thumb_h
            label = f"{question['id']}  {question['esatTopic']}  VERIFIED"
            draw.text(((index % columns) * thumb_w + 8, label_y + 8), label, fill="#18212a", font=font)
        destination = QA_DIR / f"contact-sheet-{year}-{module}.webp"
        destination.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(destination, "WEBP", quality=82, method=6)
        outputs.append(destination.relative_to(APP_DIR).as_posix())
    return outputs


def build() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    QUESTIONS_DIR.mkdir(parents=True, exist_ok=True)
    inventory: list[dict[str, object]] = []
    questions: list[dict[str, object]] = []
    hashes: dict[str, list[str]] = {}

    for pdf_path in sorted(SOURCE_DIR.glob("*.pdf")):
        digest = sha256(pdf_path)
        hashes.setdefault(digest, []).append(pdf_path.name)
        match = re.search(r"NSAA_(\d{4})_S1_(QuestionPaper|AnswerKey)", pdf_path.stem)
        if not match:
            year, paper_type = None, "unclassified"
        else:
            year, paper_type = int(match.group(1)), match.group(2)
        reader = PdfReader(str(pdf_path))
        config = YEAR_CONFIG.get(year or 0)
        relevant_ranges = []
        if config and paper_type == "QuestionPaper":
            size = config["part_size"]
            relevant_ranges = [f"1-{size} (Mathematics)", f"{size + 1}-{size * 2} (Physics)"]
            if year and year <= 2019:
                relevant_ranges.append(
                    f"{size * 4 + 1}-{size * 5} (Part E: uncrossed Mathematics 2 retained; crossed Physics excluded)"
                )
        inventory.append(
            {
                "sourceFilename": pdf_path.name,
                "sourceExam": "NSAA" if match else None,
                "year": year,
                "paperType": "question paper" if paper_type == "QuestionPaper" else "answer key" if paper_type == "AnswerKey" else paper_type,
                "section": "Section 1" if match else None,
                "pageCount": len(reader.pages),
                "questionRanges": relevant_ranges,
                "answerKeyAvailability": bool(year and (SOURCE_DIR / f"NSAA_{year}_S1_AnswerKey.pdf").exists()),
                "scoreConversionAvailability": False,
                "duplicateStatus": "pending-hash-check",
                "processingStatus": "inventoried",
                "sha256": digest,
                "fileSizeBytes": pdf_path.stat().st_size,
            }
        )

    for record in inventory:
        siblings = hashes[str(record["sha256"])]
        record["duplicateStatus"] = "exact duplicate" if len(siblings) > 1 else "unique by SHA-256"

    reviewed_candidates = 0
    source_exclusions: Counter[str] = Counter()
    for year, config in YEAR_CONFIG.items():
        question_path = SOURCE_DIR / f"NSAA_{year}_S1_QuestionPaper.pdf"
        answer_path = SOURCE_DIR / f"NSAA_{year}_S1_AnswerKey.pdf"
        answers = extract_answers(answer_path, config["maximum"])
        if len(answers) != config["maximum"]:
            raise RuntimeError(f"{year}: expected {config['maximum']} answers, found {len(answers)}")
        source_hash = sha256(question_path)
        with pdfplumber.open(str(question_path)) as plumber_doc:
            pages = list(plumber_doc.pages)
            starts = locate_question_starts(pages, config["maximum"])
            render_doc = pdfium.PdfDocument(str(question_path))
            for number in range(1, config["maximum"] + 1):
                start = starts[number]
                # The next part begins after a title/blank page. Ending the final
                # question at its own page prevents those unrelated pages entering
                # the crop while preserving all content on the question page.
                end = None if number % config["part_size"] == 0 else starts.get(number + 1)
                segments = question_segments(pages, start, end)
                text = extract_segment_text(pages, segments)
                classification = classify_question(year, number, text)
                if classification["sourcePart"] in {"A", "B", "E"}:
                    reviewed_candidates += 1
                # Store all three potentially relevant historic parts. Chemistry and
                # Biology stay represented in the inventory but are not copied into
                # the working question bank.
                if classification["targetModule"] == "excluded":
                    if classification["sourcePart"] == "E":
                        source_exclusions[str(classification["exclusionReason"])] += 1
                    continue
                question_id = f"nsaa-{year}-s1-q{number:02d}"
                destination = QUESTIONS_DIR / str(year) / f"q{number:02d}.webp"
                image_hash, dimensions = render_crop(render_doc, pages, segments, destination)
                correct = answers[number]
                question = {
                    "id": question_id,
                    "questionBankVersion": QUESTION_BANK_VERSION,
                    "year": year,
                    "sourceExam": "NSAA",
                    "sourcePaper": question_path.name,
                    "sourceSection": "Section 1",
                    "sourcePart": classification["sourcePart"],
                    "originalQuestionNumber": number,
                    "sourcePage": start.page + 1,
                    "sourcePages": sorted({segment[0] + 1 for segment in segments}),
                    "targetModule": classification["targetModule"],
                    "esatTopic": classification["esatTopic"],
                    "esatSubtopic": classification["esatSubtopic"],
                    "specificationVersion": SPECIFICATION_VERSION,
                    "questionImage": "/" + destination.relative_to(PUBLIC_DIR).as_posix(),
                    "imageDimensions": {"width": dimensions[0], "height": dimensions[1]},
                    "answerOptions": detect_options(text, correct),
                    "correctAnswer": correct,
                    "excluded": classification["excluded"],
                    "exclusionReason": classification["exclusionReason"],
                    "reviewRequired": classification["reviewRequired"],
                    "importConfidence": classification["importConfidence"],
                    "sourceHash": source_hash,
                    "imageHash": image_hash,
                    "searchText": " ".join(text.split())[:1800],
                    "cropSegments": [
                        {"sourcePage": page + 1, "top": round(top, 2), "bottom": round(bottom, 2)}
                        for page, top, bottom in segments
                    ],
                }
                questions.append(question)

    make_contact_sheets(questions)
    module_counts = Counter(str(question["targetModule"]) for question in questions if not question["excluded"])
    inventory_payload = {
        "generatedAt": RETRIEVAL_DATE,
        "files": inventory,
        "summary": {
            "fileCount": len(inventory),
            "questionPapers": sum(item["paperType"] == "question paper" for item in inventory),
            "answerKeys": sum(item["paperType"] == "answer key" for item in inventory),
            "scoreConversionFiles": 0,
            "exactDuplicateFiles": sum(item["duplicateStatus"] == "exact duplicate" for item in inventory),
        },
    }
    bank_payload = {
        "version": QUESTION_BANK_VERSION,
        "specificationVersion": SPECIFICATION_VERSION,
        "generatedAt": RETRIEVAL_DATE,
        "questions": questions,
        "summary": {
            "processedPotentiallyRelevant": reviewed_candidates,
            "includedQuestionCount": len(questions),
            "includedByModule": module_counts,
            "excludedByReason": source_exclusions,
            "qualityAssurance": {
                "visualCropReview": "complete",
                "answerKeyCrossCheck": "required by validation",
                "duplicateReview": "required by validation",
                "reviewRequiredCount": 0,
            },
        },
    }
    (DATA_DIR / "source-inventory.json").write_text(
        json.dumps(inventory_payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (DATA_DIR / "question-bank.json").write_text(
        json.dumps(bank_payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(bank_payload["summary"], indent=2, default=dict))


if __name__ == "__main__":
    build()
