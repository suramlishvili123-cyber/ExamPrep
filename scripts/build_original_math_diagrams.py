"""Generate deterministic, exam-style diagrams for the original mathematics mock.

The diagrams are deliberately rendered with Pillow instead of copied from third-party
material.  They use a restrained greyscale visual language so they remain legible in the
test player, in print, and for candidates using high-contrast display settings.

Running this file always writes the same pixels for the same Pillow/font environment:

    python scripts/build_original_math_diagrams.py

The generated PNGs are supplemental figures, not complete question screenshots.  The UI
must therefore render them alongside (rather than instead of) the authored question text.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Callable, Sequence

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "questions" / "original"
WIDTH = 1400
HEIGHT = 880

WHITE = "#ffffff"
INK = "#111827"
MID = "#4b5563"
MUTED = "#6b7280"
GRID = "#d1d5db"
PALE = "#f3f4f6"
FILL = "#e5e7eb"


def _font_candidates(bold: bool) -> list[Path]:
    windows = Path("C:/Windows/Fonts")
    return [
        windows / ("segoeuib.ttf" if bold else "segoeui.ttf"),
        windows / ("arialbd.ttf" if bold else "arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in _font_candidates(bold):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


FONT_24 = font(24)
FONT_26 = font(26)
FONT_28 = font(28)
FONT_30 = font(30)
FONT_32 = font(32)
FONT_34_BOLD = font(34, bold=True)
FONT_38_BOLD = font(38, bold=True)


Point = tuple[float, float]


def new_canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    return image, ImageDraw.Draw(image)


def text_center(draw: ImageDraw.ImageDraw, xy: Point, value: str, *, used_font=FONT_28, fill: str = INK) -> None:
    draw.text(xy, value, font=used_font, fill=fill, anchor="mm")


def text_box(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], value: str, *, used_font=FONT_28, fill: str = INK) -> None:
    x1, y1, x2, y2 = box
    text_center(draw, ((x1 + x2) / 2, (y1 + y2) / 2), value, used_font=used_font, fill=fill)


def dashed_line(
    draw: ImageDraw.ImageDraw,
    start: Point,
    end: Point,
    *,
    fill: str = MUTED,
    width: int = 4,
    dash: float = 15,
    gap: float = 11,
) -> None:
    dx, dy = end[0] - start[0], end[1] - start[1]
    distance = math.hypot(dx, dy)
    if not distance:
        return
    ux, uy = dx / distance, dy / distance
    offset = 0.0
    while offset < distance:
        segment_end = min(distance, offset + dash)
        draw.line(
            (
                start[0] + ux * offset,
                start[1] + uy * offset,
                start[0] + ux * segment_end,
                start[1] + uy * segment_end,
            ),
            fill=fill,
            width=width,
        )
        offset += dash + gap


def arrow(
    draw: ImageDraw.ImageDraw,
    start: Point,
    end: Point,
    *,
    fill: str = INK,
    width: int = 5,
    head: float = 18,
) -> None:
    draw.line((*start, *end), fill=fill, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    for delta in (math.pi * 0.82, -math.pi * 0.82):
        tip = (end[0] + head * math.cos(angle + delta), end[1] + head * math.sin(angle + delta))
        draw.line((*end, *tip), fill=fill, width=width)


def point_on_circle(center: Point, radius: float, degrees: float) -> Point:
    angle = math.radians(degrees)
    return center[0] + radius * math.cos(angle), center[1] - radius * math.sin(angle)


def labelled_point(draw: ImageDraw.ImageDraw, point: Point, label: str, offset: Point = (0, -30)) -> None:
    x, y = point
    draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=INK)
    text_center(draw, (x + offset[0], y + offset[1]), label, used_font=FONT_30)


def not_to_scale(draw: ImageDraw.ImageDraw) -> None:
    draw.text((WIDTH - 70, HEIGHT - 45), "Diagram not drawn to scale", font=FONT_24, fill=MUTED, anchor="rs")


def save(image: Image.Image, filename: str) -> dict[str, object]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / filename
    image.save(path, format="PNG", optimize=True, compress_level=9)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {"file": path.relative_to(ROOT).as_posix(), "width": WIDTH, "height": HEIGHT, "sha256": digest}


def speed_time_graph() -> Image.Image:
    image, draw = new_canvas()
    left, top, right, bottom = 160, 100, 1240, 730
    arrow(draw, (left, bottom), (right, bottom), width=5)
    arrow(draw, (left, bottom), (left, top), width=5)
    draw.text((right, bottom + 78), "time, t / s", font=FONT_30, fill=INK, anchor="rs")
    draw.text((left - 70, top - 15), "speed, v / m s⁻¹", font=FONT_30, fill=INK, anchor="lm")

    def chart_point(t: float, velocity: float) -> Point:
        return left + t / 70 * (right - left - 40), bottom - velocity / 34 * (bottom - top - 30)

    p0, p1, p2 = chart_point(0, 30), chart_point(24, 12), chart_point(64, 12)
    draw.polygon([p0, p1, p2, (p2[0], bottom), (p0[0], bottom)], fill=PALE)
    draw.line([p0, p1, p2], fill=INK, width=7, joint="curve")
    for t, p in ((24, p1), (64, p2)):
        dashed_line(draw, (p[0], p[1]), (p[0], bottom), fill=GRID, width=3)
        text_center(draw, (p[0], bottom + 30), str(t), used_font=FONT_26)
    for velocity, p in ((12, p1), (30, p0)):
        dashed_line(draw, (left, p[1]), (p[0], p[1]), fill=GRID, width=3)
        draw.text((left - 22, p[1]), str(velocity), font=FONT_26, fill=INK, anchor="rm")
    draw.text(((p0[0] + p1[0]) / 2 + 30, (p0[1] + p1[1]) / 2 - 38), "uniform deceleration", font=FONT_26, fill=MID, anchor="mm")
    return image


def square_pyramid() -> Image.Image:
    image, draw = new_canvas()
    apex = (700, 105)
    back_left, back_right = (390, 455), (830, 380)
    front_left, front_right = (520, 720), (1070, 590)
    centre = ((back_left[0] + front_right[0]) / 2, (back_left[1] + front_right[1]) / 2)

    draw.polygon([apex, back_left, front_left], fill=PALE)
    draw.polygon([apex, front_left, front_right], fill=FILL)
    draw.polygon([apex, front_right, back_right], fill="#f7f7f7")
    for start, end in ((apex, back_left), (apex, back_right), (apex, front_left), (apex, front_right), (back_left, front_left), (front_left, front_right), (front_right, back_right)):
        draw.line((*start, *end), fill=INK, width=5)
    dashed_line(draw, back_left, back_right, fill=MUTED, width=4)
    dashed_line(draw, apex, centre, fill=MID, width=4)
    dashed_line(draw, centre, ((front_left[0] + front_right[0]) / 2, (front_left[1] + front_right[1]) / 2), fill=MID, width=4)
    cx, cy = centre
    draw.line((cx, cy, cx + 26, cy + 8, cx + 17, cy + 34), fill=MID, width=4, joint="curve")
    draw.text((cx - 32, (apex[1] + cy) / 2), "12 cm", font=FONT_30, fill=INK, anchor="rm")
    edge_mid = ((front_left[0] + front_right[0]) / 2, (front_left[1] + front_right[1]) / 2)
    draw.text((edge_mid[0] + 20, edge_mid[1] + 48), "10 cm", font=FONT_30, fill=INK, anchor="mm")
    draw.text((center_x := (front_right[0] + back_right[0]) / 2 + 65, (front_right[1] + back_right[1]) / 2), "10 cm", font=FONT_30, fill=INK, anchor="lm")
    _ = center_x
    not_to_scale(draw)
    return image


def circle_theorem() -> Image.Image:
    image, draw = new_canvas()
    centre, radius = (700, 500), 225
    a = point_on_circle(centre, radius, 31)
    b = point_on_circle(centre, radius, 149)
    c = point_on_circle(centre, radius, 90)
    # Intersection of the symmetric tangents at A and B.
    p = (centre[0], centre[1] - radius / math.sin(math.radians(31)))
    draw.ellipse((centre[0] - radius, centre[1] - radius, centre[0] + radius, centre[1] + radius), outline=INK, width=6)
    draw.line([a, centre, b], fill=MID, width=5)
    draw.line([a, c, b], fill=INK, width=5)
    draw.line([a, p, b], fill=INK, width=5)
    draw.arc((centre[0] - 92, centre[1] - 92, centre[0] + 92, centre[1] + 92), 211, 329, fill=INK, width=5)
    text_center(draw, (centre[0], centre[1] - 65), "118°", used_font=FONT_28)
    labelled_point(draw, centre, "O", (0, 34))
    labelled_point(draw, a, "A", (32, 18))
    labelled_point(draw, b, "B", (-32, 18))
    labelled_point(draw, c, "C", (0, -34))
    labelled_point(draw, p, "P", (0, -34))
    draw.text((1120, 650), "C lies on the minor arc AB", font=FONT_28, fill=MID, anchor="rm")
    not_to_scale(draw)
    return image


def bearings() -> Image.Image:
    image, draw = new_canvas()
    port = (570, 520)
    scale = 17
    ship_a = (port[0] + 24 * scale * math.sin(math.radians(60)), port[1] - 24 * scale * math.cos(math.radians(60)))
    ship_b = (port[0] + 18 * scale * math.sin(math.radians(150)), port[1] - 18 * scale * math.cos(math.radians(150)))
    arrow(draw, port, (port[0], 100), width=5)
    text_center(draw, (port[0], 70), "N", used_font=FONT_34_BOLD)
    draw.line((*port, *ship_a), fill=INK, width=6)
    draw.line((*port, *ship_b), fill=INK, width=6)
    dashed_line(draw, ship_a, ship_b, fill=MID, width=4)
    draw.arc((port[0] - 150, port[1] - 150, port[0] + 150, port[1] + 150), 270, 330, fill=INK, width=5)
    draw.arc((port[0] - 230, port[1] - 230, port[0] + 230, port[1] + 230), 270, 420, fill=MID, width=4)
    text_center(draw, (port[0] + 104, port[1] - 116), "060°", used_font=FONT_28)
    text_center(draw, (port[0] + 230, port[1] + 42), "150°", used_font=FONT_28)
    labelled_point(draw, port, "P", (-30, 32))
    labelled_point(draw, ship_a, "ship A", (44, -27))
    labelled_point(draw, ship_b, "ship B", (48, 28))
    text_center(draw, ((port[0] + ship_a[0]) / 2 + 45, (port[1] + ship_a[1]) / 2 - 65), "24 km", used_font=FONT_28)
    text_center(draw, ((port[0] + ship_b[0]) / 2 - 35, (port[1] + ship_b[1]) / 2 + 34), "18 km", used_font=FONT_28)
    text_center(draw, ((ship_a[0] + ship_b[0]) / 2 + 45, (ship_a[1] + ship_b[1]) / 2), "?", used_font=FONT_38_BOLD)
    not_to_scale(draw)
    return image


def line_parabola_area() -> Image.Image:
    image, draw = new_canvas()
    left, top, right, bottom = 125, 80, 1260, 760
    xmin, xmax, ymin, ymax = -2.4, 3.2, -1.2, 7.8

    def xy(x: float, y: float) -> Point:
        return left + (x - xmin) / (xmax - xmin) * (right - left), bottom - (y - ymin) / (ymax - ymin) * (bottom - top)

    x_axis_y, y_axis_x = xy(0, 0)[1], xy(0, 0)[0]
    arrow(draw, (left, x_axis_y), (right, x_axis_y), width=4)
    arrow(draw, (y_axis_x, bottom), (y_axis_x, top), width=4)
    draw.text((right, x_axis_y + 30), "x", font=FONT_30, fill=INK, anchor="rs")
    draw.text((y_axis_x + 20, top), "y", font=FONT_30, fill=INK, anchor="lt")

    samples = 220
    parabola = [xy(xmin + (xmax - xmin) * i / samples, (xmin + (xmax - xmin) * i / samples) ** 2) for i in range(samples + 1)]
    line = [xy(xmin, xmin + 2), xy(xmax, xmax + 2)]
    shade_top = [xy(-1 + 3 * i / 100, (-1 + 3 * i / 100) + 2) for i in range(101)]
    shade_bottom = [xy(2 - 3 * i / 100, (2 - 3 * i / 100) ** 2) for i in range(101)]
    draw.polygon(shade_top + shade_bottom, fill=FILL)
    draw.line(parabola, fill=INK, width=6, joint="curve")
    draw.line(line, fill=MID, width=6)
    for x in (-1, 2):
        labelled_point(draw, xy(x, x * x), "", (0, 0))
    draw.text(xy(2.45, 6.0), "y = x²", font=FONT_30, fill=INK, anchor="lm")
    draw.text(xy(2.42, 4.25), "y = x + 2", font=FONT_30, fill=MID, anchor="lm")
    draw.text(xy(0.55, 1.35), "enclosed region", font=FONT_26, fill=MID, anchor="mm")
    return image


def cosine_triangle() -> Image.Image:
    image, draw = new_canvas()
    b, a, c = (310, 690), (1010, 690), (310 + 800 * math.cos(math.radians(60)), 690 - 800 * math.sin(math.radians(60)))
    draw.polygon([a, b, c], fill=PALE)
    draw.line([a, b, c, a], fill=INK, width=6, joint="curve")
    draw.arc((b[0] - 170, b[1] - 170, b[0] + 170, b[1] + 170), 300, 360, fill=INK, width=5)
    text_center(draw, (b[0] + 125, b[1] - 75), "60°", used_font=FONT_30)
    text_center(draw, ((a[0] + b[0]) / 2, b[1] + 38), "7 cm", used_font=FONT_30)
    text_center(draw, ((b[0] + c[0]) / 2 - 40, (b[1] + c[1]) / 2 - 10), "8 cm", used_font=FONT_30)
    labelled_point(draw, a, "A", (28, 26))
    labelled_point(draw, b, "B", (-28, 26))
    labelled_point(draw, c, "C", (0, -34))
    not_to_scale(draw)
    return image


def labelled_sector() -> Image.Image:
    image, draw = new_canvas()
    centre = (450, 650)
    radius = 440
    start_deg, end_deg = 0, 68.754935
    p1 = point_on_circle(centre, radius, start_deg)
    p2 = point_on_circle(centre, radius, end_deg)
    polygon = [centre]
    for i in range(61):
        polygon.append(point_on_circle(centre, radius, start_deg + (end_deg - start_deg) * i / 60))
    polygon.append(centre)
    draw.polygon(polygon, fill=PALE)
    draw.line([centre, p1], fill=INK, width=6)
    draw.line([centre, p2], fill=INK, width=6)
    arc_box = (centre[0] - radius, centre[1] - radius, centre[0] + radius, centre[1] + radius)
    draw.arc(arc_box, 360 - end_deg, 360 - start_deg, fill=INK, width=7)
    draw.arc((centre[0] - 125, centre[1] - 125, centre[0] + 125, centre[1] + 125), 360 - end_deg, 360, fill=MID, width=5)
    text_center(draw, (centre[0] + 128, centre[1] - 75), "θ radians", used_font=FONT_30, fill=MID)
    text_center(draw, ((centre[0] + p1[0]) / 2, centre[1] + 34), "r", used_font=FONT_34_BOLD)
    text_center(draw, ((centre[0] + p2[0]) / 2 - 35, (centre[1] + p2[1]) / 2 - 8), "r", used_font=FONT_34_BOLD)
    arc_mid = point_on_circle(centre, radius + 55, end_deg / 2)
    text_center(draw, arc_mid, "arc length 6 cm", used_font=FONT_30)
    text_center(draw, (665, 465), "area = 15 cm²", used_font=FONT_34_BOLD)
    labelled_point(draw, centre, "O", (-28, 30))
    not_to_scale(draw)
    return image


def closed_cylinder() -> Image.Image:
    image, draw = new_canvas()
    x1, x2, top, bottom = 410, 990, 180, 700
    ellipse_h = 145
    draw.rectangle((x1, top + ellipse_h / 2, x2, bottom - ellipse_h / 2), fill=PALE)
    draw.ellipse((x1, top, x2, top + ellipse_h), fill=WHITE, outline=INK, width=6)
    draw.arc((x1, bottom - ellipse_h, x2, bottom), 0, 180, fill=INK, width=6)
    dashed_line(draw, (x1, bottom - ellipse_h / 2), (x2, bottom - ellipse_h / 2), fill=GRID, width=3)
    draw.line((x1, top + ellipse_h / 2, x1, bottom - ellipse_h / 2), fill=INK, width=6)
    draw.line((x2, top + ellipse_h / 2, x2, bottom - ellipse_h / 2), fill=INK, width=6)
    centre_top = ((x1 + x2) / 2, top + ellipse_h / 2)
    draw.line((*centre_top, x2, centre_top[1]), fill=INK, width=4)
    draw.ellipse((centre_top[0] - 5, centre_top[1] - 5, centre_top[0] + 5, centre_top[1] + 5), fill=INK)
    text_center(draw, ((centre_top[0] + x2) / 2, centre_top[1] - 28), "r", used_font=FONT_34_BOLD)
    draw.line((x2 + 90, top + ellipse_h / 2, x2 + 90, bottom - ellipse_h / 2), fill=INK, width=4)
    draw.line((x2 + 70, top + ellipse_h / 2, x2 + 110, top + ellipse_h / 2), fill=INK, width=4)
    draw.line((x2 + 70, bottom - ellipse_h / 2, x2 + 110, bottom - ellipse_h / 2), fill=INK, width=4)
    text_center(draw, (x2 + 135, (top + bottom) / 2), "h", used_font=FONT_34_BOLD)
    text_center(draw, (700, 790), "closed cylinder     volume = 128π cm³", used_font=FONT_32)
    not_to_scale(draw)
    return image


def trapezium_table_curve() -> Image.Image:
    image, draw = new_canvas()
    # Exact ordinate table on the left.
    tx1, ty1, tx2, ty2 = 70, 140, 620, 710
    rows, cols = 6, 2
    row_h, col_w = (ty2 - ty1) / rows, (tx2 - tx1) / cols
    draw.rounded_rectangle((tx1, ty1, tx2, ty2), radius=14, outline=INK, width=4, fill=WHITE)
    draw.rectangle((tx1 + 2, ty1 + 2, tx2 - 2, ty1 + row_h), fill=FILL)
    for row in range(1, rows):
        draw.line((tx1, ty1 + row * row_h, tx2, ty1 + row * row_h), fill=GRID, width=3)
    draw.line((tx1 + col_w, ty1, tx1 + col_w, ty2), fill=GRID, width=3)
    table_rows = [("x", "f(x) = x³ + 1"), ("0", "1"), ("0.5", "9/8"), ("1", "2"), ("1.5", "35/8"), ("2", "9")]
    for row, values in enumerate(table_rows):
        for col, value in enumerate(values):
            text_box(
                draw,
                (int(tx1 + col * col_w), int(ty1 + row * row_h), int(tx1 + (col + 1) * col_w), int(ty1 + (row + 1) * row_h)),
                value,
                used_font=FONT_30 if row else FONT_34_BOLD,
            )
    draw.text((tx1, ty1 - 40), "Ordinates for four equal strips", font=FONT_30, fill=MID, anchor="ls")

    # Curve and the four trapezia on the right.
    left, top, right, bottom = 745, 100, 1320, 730

    def xy(x: float, y: float) -> Point:
        return left + x / 2.15 * (right - left), bottom - y / 10 * (bottom - top)

    arrow(draw, (left, bottom), (right, bottom), width=4)
    arrow(draw, (left, bottom), (left, top), width=4)
    for index in range(4):
        xa, xb = index * 0.5, (index + 1) * 0.5
        ya, yb = xa**3 + 1, xb**3 + 1
        polygon = [xy(xa, 0), xy(xa, ya), xy(xb, yb), xy(xb, 0)]
        draw.polygon(polygon, fill=PALE if index % 2 == 0 else FILL)
        draw.line(polygon + [polygon[0]], fill=GRID, width=3)
        draw.line((xy(xa, ya), xy(xb, yb)), fill=MID, width=5)
    curve_points = [xy(2 * i / 150, (2 * i / 150) ** 3 + 1) for i in range(151)]
    draw.line(curve_points, fill=INK, width=6, joint="curve")
    for x in (0, 0.5, 1, 1.5, 2):
        y = x**3 + 1
        draw.ellipse((xy(x, y)[0] - 6, xy(x, y)[1] - 6, xy(x, y)[0] + 6, xy(x, y)[1] + 6), fill=INK)
        text_center(draw, (xy(x, 0)[0], bottom + 28), f"{x:g}", used_font=FONT_24)
    draw.text((right, bottom + 34), "x", font=FONT_28, fill=INK, anchor="rs")
    draw.text((left + 18, top), "y", font=FONT_28, fill=INK, anchor="lt")
    draw.text((right - 10, top + 85), "y = x³ + 1", font=FONT_28, fill=INK, anchor="rs")
    draw.text((left + 15, bottom - 18), "h = 0.5", font=FONT_26, fill=MID, anchor="lb")
    return image


def modulus_parabola_intersections() -> Image.Image:
    """Graph for counting intersections of y = |x² - 4| and y = x."""
    image, draw = new_canvas()
    left, top, right, bottom = 120, 75, 1280, 785
    xmin, xmax, ymin, ymax = -4.2, 4.2, -1.5, 9.5

    def xy(x: float, y: float) -> Point:
        return left + (x - xmin) / (xmax - xmin) * (right - left), bottom - (y - ymin) / (ymax - ymin) * (bottom - top)

    x_axis_y, y_axis_x = xy(0, 0)[1], xy(0, 0)[0]
    for x in range(-4, 5):
        if x == 0:
            continue
        draw.line((xy(x, ymin)[0], top, xy(x, ymin)[0], bottom), fill=PALE, width=2)
    for y in range(1, 10):
        draw.line((left, xy(0, y)[1], right, xy(0, y)[1]), fill=PALE, width=2)
    arrow(draw, (left, x_axis_y), (right, x_axis_y), width=4)
    arrow(draw, (y_axis_x, bottom), (y_axis_x, top), width=4)
    draw.text((right, x_axis_y + 30), "x", font=FONT_30, fill=INK, anchor="rs")
    draw.text((y_axis_x + 20, top), "y", font=FONT_30, fill=INK, anchor="lt")

    samples = 500
    curve = []
    line = []
    for index in range(samples + 1):
        x = xmin + (xmax - xmin) * index / samples
        curve.append(xy(x, abs(x * x - 4)))
        line.append(xy(x, x))
    draw.line(curve, fill=INK, width=7, joint="curve")
    draw.line(line, fill=MID, width=6)

    roots = ((-1 + math.sqrt(17)) / 2, (1 + math.sqrt(17)) / 2)
    for root in roots:
        px, py = xy(root, root)
        draw.ellipse((px - 9, py - 9, px + 9, py + 9), fill=INK, outline=WHITE, width=2)
    for x in (-2, 0, 2):
        px, py = xy(x, 0 if x else 4)
        draw.line((px, x_axis_y - 7, px, x_axis_y + 7), fill=INK, width=3)
        if x:
            text_center(draw, (px, x_axis_y + 27), str(x), used_font=FONT_24)
        elif x == 0:
            text_center(draw, (px - 20, xy(0, 4)[1]), "4", used_font=FONT_24)
    draw.text(xy(-3.55, 8.4), "y = |x² − 4|", font=FONT_32, fill=INK, anchor="lm")
    draw.text(xy(3.15, 3.15), "y = x", font=FONT_32, fill=MID, anchor="lm")
    return image


# Only figures whose question exists in build_original_mocks.py belong here; that script
# rejects both an unmatched mapping and an unreferenced PNG left in the output directory.
# labelled_sector, trapezium_table_curve and modulus_parabola_intersections are kept above
# because they are correct drawings, but they depict questions Challenge Mock A does not
# contain: a sector with arc 6 cm and area 15 cm², a trapezium estimate of x³+1 rather than
# the authored √(1+x³), and the intersections of y=|x²−4| with y=x. Register each one only
# alongside the question it draws.
DIAGRAMS: Sequence[tuple[str, Callable[[], Image.Image]]] = (
    ("atlas-challenge-a-maths1-q15.png", speed_time_graph),
    ("atlas-challenge-a-maths1-q18.png", square_pyramid),
    ("atlas-challenge-a-maths1-q19.png", circle_theorem),
    ("atlas-challenge-a-maths1-q22.png", bearings),
    ("atlas-challenge-a-maths2-q10.png", line_parabola_area),
    ("atlas-challenge-a-maths2-q12.png", cosine_triangle),
    ("atlas-challenge-a-maths2-q21.png", closed_cylinder),
)


def build() -> list[dict[str, object]]:
    manifest = [save(builder(), filename) for filename, builder in DIAGRAMS]
    print(json.dumps({"count": len(manifest), "diagrams": manifest}, indent=2))
    return manifest


if __name__ == "__main__":
    build()
