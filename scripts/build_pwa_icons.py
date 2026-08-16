"""Render the installed-application icon set.

An installable PWA needs raster icons: Android's installer, the iOS home screen and the
Windows taskbar all want PNG, and a maskable icon has to survive being cropped to a circle
or a squircle by the host platform. That rules out shipping only the SVG favicon.

The monogram is drawn from geometry rather than set in a typeface. A committed generator
that depends on a font file present on the author's machine produces different icons on
every machine that runs it, which is exactly the kind of silent drift a build script should
not have. Rectangles and stroked polylines render identically everywhere.

    python scripts/build_pwa_icons.py

Outputs are committed under public/icons/ and are not rebuilt during `npm run build`.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

# The brand mark as the interface draws it: `.brand-mark` in app/globals.css is a lime
# tile with a near-black-green monogram, and an installed icon that did not match it would
# read as a different product on the home screen.
LIME = (183, 220, 108, 255)
INK = (23, 53, 41, 255)
TRANSPARENT = (0, 0, 0, 0)

# Everything is drawn on this square and downsampled to the requested size, which is what
# gives the diagonals of the "A" a clean edge without any explicit antialiasing.
CANVAS = 1024

OUTPUT_DIRECTORY = Path(__file__).resolve().parent.parent / "public" / "icons"

# Letterform geometry, expressed in a 568x300 design box that is then scaled and centred.
DESIGN_WIDTH = 568.0
DESIGN_HEIGHT = 300.0
STEM = 74.0


def draw_monogram(
    draw: ImageDraw.ImageDraw,
    scale: float,
    left: float,
    top: float,
    background: tuple[int, int, int, int],
) -> None:
    """Draw "EA" as filled geometry inside the design box mapped to (left, top, scale)."""

    def at(x: float, y: float) -> tuple[float, float]:
        return (left + x * scale, top + y * scale)

    def box(x0: float, y0: float, x1: float, y1: float) -> None:
        draw.rectangle([*at(x0, y0), *at(x1, y1)], fill=INK)

    # E: a stem plus three arms. The middle arm is deliberately shorter, which is what
    # stops the letter reading as a filled block at small sizes.
    box(0, 0, STEM, DESIGN_HEIGHT)
    box(0, 0, 232, STEM)
    box(0, 113, 205, 113 + STEM)
    box(0, DESIGN_HEIGHT - STEM, 232, DESIGN_HEIGHT)

    # A: a solid triangle with its counter punched back out in the tile colour, rather
    # than two stroked lines. A stroked polyline rounds its apex and its feet, and next to
    # the perfectly square E that reads as two letters from two different typefaces.
    draw.polygon([at(420, 0), at(568, DESIGN_HEIGHT), at(272, DESIGN_HEIGHT)], fill=INK)
    draw.polygon([at(420, 104), at(492, DESIGN_HEIGHT), at(348, DESIGN_HEIGHT)], fill=background)
    box(366, 190, 474, 248)


def render(size: int, *, maskable: bool, background: tuple[int, int, int, int] = LIME) -> Image.Image:
    """One icon.

    `maskable` shrinks the monogram into the 80% safe zone the specification guarantees
    will survive any platform mask, and fills the whole square rather than rounding the
    corners — the platform supplies the shape.
    """
    image = Image.new("RGBA", (CANVAS, CANVAS), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    if maskable:
        draw.rectangle([0, 0, CANVAS, CANVAS], fill=background)
        content_width = CANVAS * 0.52
    else:
        # 22.5% matches the 11px radius on the 38px `.brand-mark` tile.
        draw.rounded_rectangle([0, 0, CANVAS - 1, CANVAS - 1], radius=CANVAS * 0.225, fill=background)
        content_width = CANVAS * 0.66

    scale = content_width / DESIGN_WIDTH
    draw_monogram(
        draw,
        scale,
        left=(CANVAS - DESIGN_WIDTH * scale) / 2,
        top=(CANVAS - DESIGN_HEIGHT * scale) / 2,
        background=background,
    )
    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    written = []
    for size in (192, 512):
        for maskable in (False, True):
            name = f"icon-{'maskable-' if maskable else ''}{size}.png"
            render(size, maskable=maskable).save(OUTPUT_DIRECTORY / name, optimize=True)
            written.append(name)

    # iOS ignores the manifest icons for the home screen and never applies transparency,
    # so this one is opaque and full-bleed with iOS's own corner radius in mind.
    apple = render(180, maskable=True)
    apple.save(OUTPUT_DIRECTORY / "apple-touch-icon.png", optimize=True)
    written.append("apple-touch-icon.png")

    print(json.dumps({"directory": str(OUTPUT_DIRECTORY), "icons": written}, indent=2))


if __name__ == "__main__":
    main()
