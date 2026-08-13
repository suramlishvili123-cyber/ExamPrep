"""Generate original, exam-style diagrams for the ESAT Atlas Physics mock.

The illustrations are deliberately produced from geometric primitives rather than
copied from a paper or specimen test.  Rendering at twice the intended CSS size
keeps labels and line work crisp on high-density displays while the single-channel
PNG output guarantees a restrained grayscale presentation.

Run from any directory with::

    python scripts/build_original_diagrams.py

The generator contains no random or time-dependent input.  Given the same Pillow
version and installed font it writes byte-for-byte deterministic assets.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Callable, Iterable, Sequence

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin


APP_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = APP_DIR / "public" / "questions" / "original"

SCALE = 2
WIDTH = 800
HEIGHT = 450
PIXEL_SIZE = (WIDTH * SCALE, HEIGHT * SCALE)

WHITE = 255
PAPER = 250
PALE = 238
GRID = 218
MID = 126
INK = 28

FONT_CANDIDATES = {
    "regular": (
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/Library/Fonts/Arial.ttf"),
    ),
    "bold": (
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/Library/Fonts/Arial Bold.ttf"),
    ),
}


def px(value: float) -> int:
    """Convert a logical coordinate or width to a Retina pixel measurement."""
    return round(value * SCALE)


def point(value: tuple[float, float]) -> tuple[int, int]:
    return px(value[0]), px(value[1])


def points(values: Iterable[tuple[float, float]]) -> list[tuple[int, int]]:
    return [point(value) for value in values]


@lru_cache(maxsize=None)
def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    family = "bold" if bold else "regular"
    for candidate in FONT_CANDIDATES[family]:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), px(size))
    # This fallback is intentionally last: it keeps the generator functional on a
    # minimal machine, although production builds should have one candidate above.
    return ImageFont.load_default(size=px(size))


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("L", PIXEL_SIZE, WHITE)
    return image, ImageDraw.Draw(image)


def line(
    draw: ImageDraw.ImageDraw,
    values: Sequence[tuple[float, float]],
    *,
    fill: int = INK,
    width: float = 2,
    joint: str = "curve",
) -> None:
    draw.line(points(values), fill=fill, width=px(width), joint=joint)


def rectangle(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    *,
    fill: int | None = None,
    outline: int = INK,
    width: float = 2,
    radius: float = 0,
) -> None:
    scaled = tuple(px(value) for value in box)
    if radius:
        draw.rounded_rectangle(scaled, radius=px(radius), fill=fill, outline=outline, width=px(width))
    else:
        draw.rectangle(scaled, fill=fill, outline=outline, width=px(width))


def ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    *,
    fill: int | None = None,
    outline: int = INK,
    width: float = 2,
) -> None:
    draw.ellipse(tuple(px(value) for value in box), fill=fill, outline=outline, width=px(width))


def label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    value: str,
    *,
    size: int = 15,
    bold: bool = False,
    anchor: str = "mm",
    fill: int = INK,
) -> None:
    draw.text(point(xy), value, font=font(size, bold), fill=fill, anchor=anchor)


def vertical_label(image: Image.Image, xy: tuple[float, float], value: str, *, size: int = 14) -> None:
    face = font(size)
    probe = ImageDraw.Draw(image)
    box = probe.textbbox((0, 0), value, font=face)
    tile = Image.new("L", (box[2] - box[0] + px(12), box[3] - box[1] + px(12)), WHITE)
    ImageDraw.Draw(tile).text((px(6), px(6)), value, font=face, fill=INK, anchor="la")
    rotated = tile.rotate(90, expand=True, fillcolor=WHITE)
    image.paste(rotated, (px(xy[0]) - rotated.width // 2, px(xy[1]) - rotated.height // 2))


def dashed_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    fill: int = MID,
    width: float = 1.5,
    dash: float = 7,
    gap: float = 5,
) -> None:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    distance = math.hypot(dx, dy)
    if distance == 0:
        return
    ux, uy = dx / distance, dy / distance
    cursor = 0.0
    while cursor < distance:
        finish = min(distance, cursor + dash)
        line(
            draw,
            [
                (start[0] + ux * cursor, start[1] + uy * cursor),
                (start[0] + ux * finish, start[1] + uy * finish),
            ],
            fill=fill,
            width=width,
        )
        cursor += dash + gap


def arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    fill: int = INK,
    width: float = 3,
    head: float = 12,
) -> None:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    distance = math.hypot(dx, dy)
    if distance == 0:
        return
    ux, uy = dx / distance, dy / distance
    base = (end[0] - ux * head, end[1] - uy * head)
    perpendicular = (-uy * head * 0.48, ux * head * 0.48)
    line(draw, [start, base], fill=fill, width=width)
    draw.polygon(
        points(
            [
                end,
                (base[0] + perpendicular[0], base[1] + perpendicular[1]),
                (base[0] - perpendicular[0], base[1] - perpendicular[1]),
            ]
        ),
        fill=fill,
    )


def junction(draw: ImageDraw.ImageDraw, xy: tuple[float, float]) -> None:
    x, y = xy
    ellipse(draw, (x - 3.5, y - 3.5, x + 3.5, y + 3.5), fill=INK, outline=INK, width=1)


def resistor_horizontal(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    value: str,
    *,
    label_above: bool = True,
) -> None:
    x1, y = start
    x2, _ = end
    body_width = min(82.0, max(52.0, (x2 - x1) * 0.55))
    body_left = (x1 + x2 - body_width) / 2
    body_right = body_left + body_width
    line(draw, [(x1, y), (body_left, y)])
    rectangle(draw, (body_left, y - 15, body_right, y + 15), fill=WHITE, width=2.2)
    line(draw, [(body_right, y), (x2, y)])
    label(draw, ((x1 + x2) / 2, y - 29 if label_above else y + 31), value, size=15)


def resistor_vertical(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    value: str,
    *,
    thermistor: bool = False,
) -> None:
    x, y1 = start
    _, y2 = end
    body_height = min(80.0, max(52.0, (y2 - y1) * 0.55))
    body_top = (y1 + y2 - body_height) / 2
    body_bottom = body_top + body_height
    line(draw, [(x, y1), (x, body_top)])
    rectangle(draw, (x - 15, body_top, x + 15, body_bottom), fill=WHITE, width=2.2)
    line(draw, [(x, body_bottom), (x, y2)])
    if thermistor:
        line(draw, [(x - 31, body_bottom + 9), (x + 27, body_top - 9)], width=1.8)
        line(draw, [(x - 31, body_bottom + 9), (x - 31, body_bottom - 3)], width=1.8)
    label(draw, (x + 44, (y1 + y2) / 2), value, size=15, anchor="lm")


def battery_vertical(draw: ImageDraw.ImageDraw, x: float, y1: float, y2: float, voltage: str) -> None:
    centre = (y1 + y2) / 2
    line(draw, [(x, y1), (x, centre - 22)])
    line(draw, [(x, centre + 22), (x, y2)])
    line(draw, [(x - 24, centre - 12), (x + 24, centre - 12)], width=2.4)
    line(draw, [(x - 14, centre + 12), (x + 14, centre + 12)], width=3)
    label(draw, (x - 38, centre), voltage, size=15, anchor="rm")
    label(draw, (x + 31, centre - 18), "+", size=16)


def graph_frame(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    plot: tuple[float, float, float, float],
    *,
    x_label: str,
    y_label: str,
    x_ticks: Sequence[tuple[float, str]],
    y_ticks: Sequence[tuple[float, str]],
    x_map: Callable[[float], float],
    y_map: Callable[[float], float],
) -> None:
    left, top, right, bottom = plot
    for value, _ in x_ticks:
        x = x_map(value)
        line(draw, [(x, top), (x, bottom)], fill=GRID, width=1)
    for value, _ in y_ticks:
        y = y_map(value)
        line(draw, [(left, y), (right, y)], fill=GRID, width=1)
    arrow(draw, (left, bottom), (right + 10, bottom), width=2.2, head=10)
    arrow(draw, (left, bottom), (left, top - 10), width=2.2, head=10)
    for value, text in x_ticks:
        x = x_map(value)
        line(draw, [(x, bottom - 4), (x, bottom + 5)], width=1.5)
        label(draw, (x, bottom + 18), text, size=13)
    for value, text in y_ticks:
        y = y_map(value)
        line(draw, [(left - 5, y), (left + 4, y)], width=1.5)
        label(draw, (left - 13, y), text, size=13, anchor="rm")
    label(draw, ((left + right) / 2, bottom + 48), x_label, size=15)
    vertical_label(image, (left - 63, (top + bottom) / 2), y_label, size=15)


def monotone_curve(xs: Sequence[float], ys: Sequence[float], samples_per_interval: int = 30) -> list[tuple[float, float]]:
    """Return a shape-preserving cubic interpolation through monotonic points."""
    if len(xs) != len(ys) or len(xs) < 2:
        raise ValueError("A curve requires matching x/y sequences with at least two points")
    delta = [(ys[index + 1] - ys[index]) / (xs[index + 1] - xs[index]) for index in range(len(xs) - 1)]
    slopes = [delta[0]]
    for index in range(1, len(xs) - 1):
        previous, following = delta[index - 1], delta[index]
        if previous == 0 or following == 0 or previous * following < 0:
            slopes.append(0.0)
        else:
            slopes.append(2 * previous * following / (previous + following))
    slopes.append(delta[-1])

    output: list[tuple[float, float]] = []
    for index in range(len(xs) - 1):
        x0, x1 = xs[index], xs[index + 1]
        y0, y1 = ys[index], ys[index + 1]
        interval = x1 - x0
        for sample in range(samples_per_interval):
            t = sample / samples_per_interval
            h00 = 2 * t**3 - 3 * t**2 + 1
            h10 = t**3 - 2 * t**2 + t
            h01 = -2 * t**3 + 3 * t**2
            h11 = t**3 - t**2
            output.append((x0 + interval * t, h00 * y0 + h10 * interval * slopes[index] + h01 * y1 + h11 * interval * slopes[index + 1]))
    output.append((xs[-1], ys[-1]))
    return output


def build_q01() -> Image.Image:
    image, draw = canvas()
    label(draw, (400, 30), "resistor network", size=15, bold=True)
    battery_vertical(draw, 100, 100, 370, "24 V")
    line(draw, [(100, 100), (170, 100)])
    resistor_horizontal(draw, (170, 100), (350, 100), "4 Ω")
    line(draw, [(350, 100), (390, 100), (390, 190)])
    line(draw, [(390, 190), (390, 345)])
    line(draw, [(680, 190), (680, 370), (100, 370)])
    resistor_horizontal(draw, (390, 225), (680, 225), "6 Ω")
    resistor_horizontal(draw, (390, 315), (680, 315), "12 Ω", label_above=False)
    line(draw, [(390, 190), (390, 225)])
    line(draw, [(390, 315), (390, 345)])
    line(draw, [(680, 190), (680, 225)])
    line(draw, [(680, 315), (680, 345)])
    for xy in ((390, 225), (390, 315), (680, 225), (680, 315)):
        junction(draw, xy)
    return image


def build_q02() -> Image.Image:
    image, draw = canvas()
    plot = (105.0, 52.0, 720.0, 365.0)
    x_map = lambda value: plot[0] + value / 8 * (plot[2] - plot[0])
    y_map = lambda value: plot[3] - value / 2 * (plot[3] - plot[1])
    x_ticks = [(value, str(value)) for value in (0, 2, 4, 6, 8)]
    y_ticks = [(value, f"{value:g}") for value in (0, 0.5, 1.0, 1.5, 2.0)]
    graph_frame(
        image,
        draw,
        plot,
        x_label="potential difference / V",
        y_label="current / A",
        x_ticks=x_ticks,
        y_ticks=y_ticks,
        x_map=x_map,
        y_map=y_map,
    )
    xs = [0, 2, 4, 6, 8]
    ys = [0, 0.8, 1.3, 1.6, 1.8]
    curve = monotone_curve(xs, ys)
    line(draw, [(x_map(x), y_map(y)) for x, y in curve], width=3)
    for x, y in zip(xs, ys, strict=True):
        ellipse(draw, (x_map(x) - 4, y_map(y) - 4, x_map(x) + 4, y_map(y) + 4), fill=WHITE, width=2.2)
    label(draw, (610, 92), "filament lamp", size=15, bold=True)
    return image


def build_q03() -> Image.Image:
    image, draw = canvas()
    label(draw, (400, 30), "potential divider", size=15, bold=True)
    battery_vertical(draw, 110, 85, 405, "9 V")
    line(draw, [(110, 85), (500, 85), (500, 115)])
    resistor_vertical(draw, (500, 115), (500, 250), "3 kΩ fixed")
    resistor_vertical(draw, (500, 250), (500, 390), "NTC thermistor", thermistor=True)
    line(draw, [(500, 390), (500, 405), (110, 405)])
    junction(draw, (500, 250))

    # An ideal voltmeter is connected across only the fixed resistor.
    line(draw, [(500, 115), (655, 115), (655, 151)])
    line(draw, [(500, 250), (655, 250), (655, 219)])
    ellipse(draw, (621, 151, 689, 219), fill=WHITE, width=2.2)
    label(draw, (655, 185), "V", size=20, bold=True)
    label(draw, (655, 275), "p.d. across fixed resistor", size=13)
    junction(draw, (500, 115))
    return image


def build_q09() -> Image.Image:
    image, draw = canvas()
    label(draw, (400, 30), "forces on the car", size=15, bold=True)

    # Vectors are drawn first so that the car body cleanly masks their origins.
    arrow(draw, (520, 255), (730, 255), width=4, head=15)
    label(draw, (625, 228), "driving force 4.4 kN", size=14)
    arrow(draw, (300, 255), (75, 255), width=4, head=15)
    label(draw, (183, 228), "resistance 2.0 kN", size=14)
    arrow(draw, (410, 230), (410, 72), width=3, head=13)
    label(draw, (430, 82), "normal contact 12 kN", size=13, anchor="lm")
    arrow(draw, (410, 260), (410, 405), width=3, head=13)
    label(draw, (430, 394), "weight 12 kN", size=13, anchor="lm")

    line(draw, [(45, 335), (755, 335)], fill=MID, width=2)
    draw.polygon(points([(290, 246), (340, 190), (474, 190), (535, 246)]), fill=PAPER, outline=INK)
    rectangle(draw, (260, 235, 560, 302), fill=PAPER, width=2.5, radius=9)
    line(draw, [(354, 193), (354, 235), (462, 235), (462, 193)], fill=MID, width=2)
    ellipse(draw, (292, 277, 348, 333), fill=WHITE, width=3)
    ellipse(draw, (474, 277, 530, 333), fill=WHITE, width=3)
    ellipse(draw, (310, 295, 330, 315), fill=MID, outline=MID, width=1)
    ellipse(draw, (492, 295, 512, 315), fill=MID, outline=MID, width=1)
    label(draw, (410, 269), "mass = 1200 kg", size=14, bold=True)
    return image


def build_q12() -> Image.Image:
    image, draw = canvas()
    plot = (110.0, 50.0, 715.0, 360.0)
    x_map = lambda value: plot[0] + value / 12 * (plot[2] - plot[0])
    y_map = lambda value: plot[3] - value / 30 * (plot[3] - plot[1])
    graph_frame(
        image,
        draw,
        plot,
        x_label="extension / cm",
        y_label="force / N",
        x_ticks=[(value, str(value)) for value in (0, 2, 4, 6, 8, 10, 12)],
        y_ticks=[(value, str(value)) for value in (0, 5, 10, 15, 20, 25, 30)],
        x_map=x_map,
        y_map=y_map,
    )
    draw.polygon(
        points([(x_map(0), y_map(0)), (x_map(10), y_map(0)), (x_map(10), y_map(25))]),
        fill=PALE,
    )
    line(draw, [(x_map(0), y_map(0)), (x_map(12), y_map(30))], width=3)
    for x, y in ((4, 10), (10, 25)):
        ellipse(draw, (x_map(x) - 4, y_map(y) - 4, x_map(x) + 4, y_map(y) + 4), fill=WHITE, width=2.2)
    label(draw, (x_map(4) + 11, y_map(10) - 14), "(4.0, 10)", size=13, anchor="lm")
    label(draw, (x_map(10) - 10, y_map(25) - 14), "(10, 25)", size=13, anchor="rm")
    label(draw, (505, 303), "area represents elastic energy", size=13, fill=MID)
    return image


def build_q14() -> Image.Image:
    image, draw = canvas()
    plot = (110.0, 50.0, 715.0, 360.0)
    x_map = lambda value: plot[0] + value / 5.2 * (plot[2] - plot[0])
    y_map = lambda value: plot[3] - value / 24 * (plot[3] - plot[1])
    graph_frame(
        image,
        draw,
        plot,
        x_label="time after hazard appears / s",
        y_label="speed / m/s",
        x_ticks=[(0, "0"), (0.7, "0.70"), (2, "2.0"), (3, "3.0"), (4, "4.0"), (4.7, "4.70")],
        y_ticks=[(value, str(value)) for value in (0, 5, 10, 15, 20)],
        x_map=x_map,
        y_map=y_map,
    )
    draw.polygon(
        points([(x_map(0), y_map(0)), (x_map(0), y_map(20)), (x_map(0.7), y_map(20)), (x_map(0.7), y_map(0))]),
        fill=PALE,
    )
    draw.polygon(
        points([(x_map(0.7), y_map(0)), (x_map(0.7), y_map(20)), (x_map(4.7), y_map(0))]),
        fill=PAPER,
    )
    line(draw, [(x_map(0), y_map(20)), (x_map(0.7), y_map(20)), (x_map(4.7), y_map(0))], width=3)
    dashed_line(draw, (x_map(0.7), y_map(20)), (x_map(0.7), y_map(0)), fill=MID)
    label(draw, ((x_map(0) + x_map(0.7)) / 2, y_map(8)), "reaction", size=12, fill=MID)
    label(draw, ((x_map(0.7) + x_map(4.7)) / 2, y_map(6)), "braking", size=13, fill=MID)
    return image


GAS_PARTICLES = (
    (0.14, 0.14), (0.35, 0.12), (0.62, 0.17), (0.82, 0.11),
    (0.23, 0.30), (0.48, 0.32), (0.75, 0.34),
    (0.11, 0.49), (0.34, 0.51), (0.60, 0.48), (0.87, 0.53),
    (0.20, 0.69), (0.47, 0.67), (0.72, 0.73),
    (0.10, 0.87), (0.36, 0.86), (0.61, 0.88), (0.88, 0.84),
)


def piston_state(
    draw: ImageDraw.ImageDraw,
    *,
    left: float,
    right: float,
    piston_y: float,
    base_y: float,
    state: str,
    pressure: str,
    volume: str,
) -> None:
    top = 90.0
    line(draw, [(left, top), (left, base_y), (right, base_y), (right, top)], width=2.5)
    rectangle(draw, (left - 4, piston_y - 8, right + 4, piston_y + 8), fill=MID, outline=INK, width=1.5)
    arrow(draw, ((left + right) / 2, 48), ((left + right) / 2, piston_y - 13), width=3, head=11)
    gas_top = piston_y + 14
    gas_height = base_y - gas_top - 8
    gas_width = right - left - 16
    for x_fraction, y_fraction in GAS_PARTICLES:
        x = left + 8 + x_fraction * gas_width
        y = gas_top + y_fraction * gas_height
        ellipse(draw, (x - 2.6, y - 2.6, x + 2.6, y + 2.6), fill=INK, outline=INK, width=1)
    label(draw, ((left + right) / 2, 25), state, size=16, bold=True)
    label(draw, ((left + right) / 2, base_y + 27), pressure, size=14, bold=True)
    label(draw, ((left + right) / 2, base_y + 48), volume, size=14)


def build_q18() -> Image.Image:
    image, draw = canvas()
    piston_state(draw, left=55, right=205, piston_y=125, base_y=345, state="state A", pressure="150 kPa", volume="400 cm³")
    piston_state(draw, left=255, right=405, piston_y=230, base_y=345, state="state B", pressure="300 kPa", volume="200 cm³")

    plot = (520.0, 105.0, 750.0, 345.0)
    x_map = lambda value: plot[0] + value / 450 * (plot[2] - plot[0])
    y_map = lambda value: plot[3] - value / 350 * (plot[3] - plot[1])
    for value in (100, 200, 300, 400):
        line(draw, [(x_map(value), plot[1]), (x_map(value), plot[3])], fill=GRID, width=1)
    for value in (100, 200, 300):
        line(draw, [(plot[0], y_map(value)), (plot[2], y_map(value))], fill=GRID, width=1)
    arrow(draw, (plot[0], plot[3]), (plot[2] + 8, plot[3]), width=2, head=8)
    arrow(draw, (plot[0], plot[3]), (plot[0], plot[1] - 8), width=2, head=8)
    curve = []
    for volume in range(175, 451, 2):
        curve.append((x_map(volume), y_map(60_000 / volume)))
    line(draw, curve, width=2.5)
    for volume, pressure, state in ((400, 150, "A"), (200, 300, "B")):
        x, y = x_map(volume), y_map(pressure)
        ellipse(draw, (x - 4, y - 4, x + 4, y + 4), fill=WHITE, width=2)
        label(draw, (x + 9, y - 9), state, size=13, bold=True, anchor="lm")
    label(draw, ((plot[0] + plot[2]) / 2, plot[3] + 31), "volume / cm³", size=13)
    vertical_label(image, (plot[0] - 39, (plot[1] + plot[3]) / 2), "pressure / kPa", size=13)
    label(draw, ((plot[0] + plot[2]) / 2, 63), "constant temperature", size=14, bold=True)
    return image


def build_q26() -> Image.Image:
    image, draw = canvas()
    plot = (115.0, 50.0, 715.0, 360.0)
    x_map = lambda value: plot[0] + value / 20 * (plot[2] - plot[0])
    y_map = lambda value: plot[3] - value / 1000 * (plot[3] - plot[1])
    graph_frame(
        image,
        draw,
        plot,
        x_label="time / days",
        y_label="activity / Bq",
        x_ticks=[(value, f"{value:g}") for value in (0, 4.5, 9, 13.5, 18)],
        y_ticks=[(value, str(value)) for value in (0, 240, 480, 720, 960)],
        x_map=x_map,
        y_map=y_map,
    )
    curve = [(x_map(time / 50), y_map(960 * 0.5 ** ((time / 50) / 4.5))) for time in range(0, 1001)]
    line(draw, curve, width=3)
    for index, (time, activity) in enumerate(((0, 960), (4.5, 480), (9, 240), (13.5, 120), (18, 60))):
        x, y = x_map(time), y_map(activity)
        ellipse(draw, (x - 4, y - 4, x + 4, y + 4), fill=WHITE, width=2.2)
        if index in (0, 4):
            x_offset = 12 if index == 0 else -12
            anchor = "lm" if index == 0 else "rm"
            label(draw, (x + x_offset, y - 14), f"{activity} Bq", size=13, bold=True, anchor=anchor)
    dashed_line(draw, (x_map(18), y_map(60)), (x_map(18), y_map(0)), fill=MID)
    dashed_line(draw, (x_map(0), y_map(60)), (x_map(18), y_map(60)), fill=MID)
    return image


# The filename carries the question number the figure belongs to, so it must track the
# authored bank rather than the order these builders were written. build_q12 draws the
# force-extension line for the Hooke's law item, which is physics Q22.
#
# build_q02 (filament lamp I-V), build_q09 (car free-body diagram) and build_q18 (Boyle's
# law pistons) are correct drawings with no matching question: Q2 is an internal-resistance
# calculation, Q9 derives force from an acceleration rather than from stated forces, and Q18
# is the constant-volume pressure law, which a constant-temperature figure would contradict.
# They stay unregistered until a question is authored for them.
DIAGRAMS: tuple[tuple[str, str, Callable[[], Image.Image]], ...] = (
    ("physics-q01-resistor-network.png", "Circuit containing a 4 ohm resistor in series with 6 ohm and 12 ohm parallel branches across a 24 volt supply.", build_q01),
    ("physics-q03-thermistor-potential-divider.png", "Nine volt potential divider containing a 3 kilo-ohm fixed resistor and an NTC thermistor, with a voltmeter across the fixed resistor.", build_q03),
    ("physics-q14-speed-time-graph.png", "Speed-time graph with a 0.70 second reaction interval followed by uniform braking from 20 metres per second to rest.", build_q14),
    ("physics-q22-force-extension-graph.png", "Straight-line force-extension graph through 4 centimetres and 10 newtons and 10 centimetres and 25 newtons.", build_q12),
    ("physics-q26-radioactive-decay-graph.png", "Radioactive activity decreasing from 960 becquerels to 60 becquerels over 18 days.", build_q26),
)


def save_diagram(filename: str, description: str, builder: Callable[[], Image.Image]) -> dict[str, object]:
    image = builder()
    if image.mode != "L" or image.size != PIXEL_SIZE:
        raise AssertionError(f"{filename}: expected L {PIXEL_SIZE}, got {image.mode} {image.size}")
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Title", filename.removesuffix(".png").replace("-", " ").title())
    metadata.add_text("Description", description)
    metadata.add_text("Copyright", "Original ESAT Atlas illustration")
    metadata.add_text("Software", "ESAT Atlas deterministic Pillow diagram generator")
    destination = OUTPUT_DIR / filename
    image.save(destination, format="PNG", compress_level=9, optimize=False, pnginfo=metadata)
    return {
        "path": destination.relative_to(APP_DIR).as_posix(),
        "width": image.width,
        "height": image.height,
        "mode": image.mode,
        "description": description,
    }


def build() -> list[dict[str, object]]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = [save_diagram(filename, description, builder) for filename, description, builder in DIAGRAMS]
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return manifest


if __name__ == "__main__":
    build()
