"""Render provisional ENGAA Part B and TMUA Paper 1 crops for visual QA.

This utility deliberately does not alter the published question bank. It exists so
source-marked crosses, crop boundaries and answer layouts can be reviewed before
the deterministic extended-bank build is allowed to ship any new item.
"""

from __future__ import annotations

import math
import re
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont

from build_question_bank import (
    APP_DIR,
    SOURCE_DIR,
    Start,
    extract_segment_text,
    locate_question_starts,
    question_segments,
    render_crop,
)


REVIEW_DIR = APP_DIR / "public" / "qa" / "extended-source-review"
REVIEW_CROPS_DIR = REVIEW_DIR / "crops"


def contact_sheet(images: list[tuple[Path, str]], destination: Path) -> None:
    font = ImageFont.load_default()
    thumb_w, thumb_h, label_h, columns = 420, 320, 34, 3
    rows = math.ceil(len(images) / columns)
    sheet = Image.new("RGB", (columns * thumb_w, rows * (thumb_h + label_h)), "#e9eef3")
    draw = ImageDraw.Draw(sheet)
    for index, (path, label) in enumerate(images):
        with Image.open(path) as source:
            thumb = source.convert("RGB")
            thumb.thumbnail((thumb_w - 18, thumb_h - 18))
            x = (index % columns) * thumb_w + (thumb_w - thumb.width) // 2
            y = (index // columns) * (thumb_h + label_h) + 8
            sheet.paste(thumb, (x, y))
        label_y = (index // columns) * (thumb_h + label_h) + thumb_h
        draw.text(((index % columns) * thumb_w + 8, label_y + 8), label, fill="#18212a", font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, "WEBP", quality=84, method=6)


def locate_tmua_starts(pages: list[pdfplumber.page.Page], maximum: int) -> dict[int, Start]:
    """2017+ TMUA files have two front pages, then one question per page."""
    if len(pages) < maximum + 2:
        raise RuntimeError("Compact 2016 practice paper requires manual page boundaries")
    return {number: Start(number + 1, 58) for number in range(1, maximum + 1)}


def render_tmua_2016_pages(path: Path) -> None:
    document = pdfium.PdfDocument(str(path))
    images: list[tuple[Path, str]] = []
    for page_index in range(2, 13):
        image = document[page_index].render(scale=170 / 72).to_pil().convert("RGB")
        destination = REVIEW_CROPS_DIR / "tmua-2016-pages" / f"page-{page_index + 1:02d}.webp"
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=88, method=6)
        images.append((destination, f"TMUA 2016 source page {page_index + 1}"))
    contact_sheet(images, REVIEW_DIR / "contact-tmua-2016-pages.webp")


def render_paper(path: Path, first_question: int, maximum: int, prefix: str, tmua: bool = False) -> None:
    with pdfplumber.open(str(path)) as plumber_doc:
        pages = list(plumber_doc.pages)
        starts = locate_tmua_starts(pages, maximum) if tmua else locate_question_starts(pages, maximum)
        render_doc = pdfium.PdfDocument(str(path))
        images: list[tuple[Path, str]] = []
        for number in range(first_question, maximum + 1):
            end = starts.get(number + 1)
            segments = question_segments(pages, starts[number], end)
            text = extract_segment_text(pages, segments)
            destination = REVIEW_CROPS_DIR / prefix / f"q{number:02d}.webp"
            render_crop(render_doc, pages, segments, destination, dpi=170)
            snippet = re.sub(r"\s+", " ", text)[:55]
            images.append((destination, f"{prefix} Q{number}  {snippet}"))
        contact_sheet(images, REVIEW_DIR / f"contact-{prefix}.webp")


def build_review() -> None:
    for year in range(2016, 2024):
        path = SOURCE_DIR / "ENGAA" / f"ENGAA_{year}_S1_QuestionPaper.pdf"
        maximum = 54 if year <= 2018 else 40
        first = 29 if year <= 2018 else 21
        prefix = f"engaa-{year}-part-b"
        if not (REVIEW_DIR / f"contact-{prefix}.webp").exists():
            render_paper(path, first, maximum, prefix)

    for year in range(2016, 2024):
        path = SOURCE_DIR / "TMUA1" / f"TMUA-{year}-paper-1.pdf"
        if year == 2016:
            render_tmua_2016_pages(path)
        else:
            render_paper(path, 1, 20, f"tmua-{year}-paper-1", tmua=True)

    print(f"Rendered 16 contact sheets to {REVIEW_DIR}")


if __name__ == "__main__":
    build_review()
