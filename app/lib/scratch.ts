/**
 * The whiteboard's data model: strokes, the coordinate space they live in, the erase and
 * simplify operations, and the wire format they are stored and synced in.
 *
 * Everything here is pure. The canvas, the pointer handling and the toolbar are in
 * `app/scratchpad.tsx`; this file is what a test can reason about and what Firestore holds.
 *
 * ## Coordinates
 *
 * A page is written in **board units**: it is always 1000 units wide, whatever its pixel
 * width, and its height follows from the shape of the question. Writing done on a tablet
 * therefore replays exactly on a laptop, which matters because the same page is shown again
 * in the post-session review on whatever device happens to be to hand.
 *
 * ## Why a compact encoding
 *
 * Handwriting is dense — a screen of algebra is tens of thousands of points — and each page
 * is one Firestore document with a hard 1 MiB ceiling, synced from a phone. Stored as JSON
 * numbers a heavy page runs to several hundred kilobytes; stored as quantised deltas in the
 * variable-length encoding below it is a few tens of kilobytes, with no visible difference
 * on screen. The scheme is the one used for encoded polylines: zigzag the signed delta, then
 * emit it five bits at a time in printable ASCII.
 */

/**
 * A page is this many units wide, always, whatever it measures in pixels. Its height
 * follows from the shape of the question it belongs to, so a stroke's coordinates mean the
 * same thing on every screen.
 */
export const BOARD_WIDTH = 1000;

/** Positions are stored to half a board unit — a twentieth of a millimetre on a tablet. */
const POSITION_SCALE = 2;

/** Pressure is stored in 16 levels, which is finer than a nib width can show. */
const PRESSURE_LEVELS = 15;

/** "pan" writes nothing: it hands every pointer back so the question can be moved. */
export type ScratchTool = "pen" | "highlighter" | "eraser" | "pan";
export type MarkingTool = "pen" | "highlighter";
export type ScratchColour = "ink" | "red" | "blue" | "green";
export type ScratchSize = 1 | 2 | 3;

export interface ScratchStroke {
  tool: MarkingTool;
  colour: ScratchColour;
  size: ScratchSize;
  /** Flat triples: x, y in board units, then pressure in 0..1. */
  points: number[];
}

export interface ScratchPage {
  /** Board-unit height the page was written at, so a shorter surface can fit it. */
  height: number;
  strokes: ScratchStroke[];
}

/**
 * Ink colours, fixed rather than themed. The board is a sheet of paper: it is white in dark
 * mode too, because a candidate's own handwriting changing colour between sessions — or
 * between writing and reviewing — is disorienting, and because the question crops beneath an
 * overlay are black on white regardless.
 */
export const SCRATCH_COLOURS: Record<ScratchColour, { label: string; ink: string; highlight: string }> = {
  ink: { label: "Black", ink: "#16211f", highlight: "#f4e58a" },
  red: { label: "Red", ink: "#b4322b", highlight: "#f7b9b3" },
  blue: { label: "Blue", ink: "#2551b8", highlight: "#a8c6f5" },
  green: { label: "Green", ink: "#136b52", highlight: "#9fdcc2" },
};

/** Nib widths in board units, before pressure is applied. */
export const PEN_WIDTHS: Record<ScratchSize, number> = { 1: 2.1, 2: 3.4, 3: 5.6 };
export const HIGHLIGHTER_WIDTHS: Record<ScratchSize, number> = { 1: 12, 2: 20, 3: 30 };

/**
 * Bounds on one page. They exist so a stuck stylus or a very long session cannot grow a
 * document past what Firestore accepts, which would fail the write silently and lose the
 * lot. Reaching either is reported to the candidate rather than dropped quietly.
 */
export const MAX_STROKES_PER_PAGE = 2_000;
export const MAX_POINTS_PER_PAGE = 60_000;

export function emptyPage(height = 0): ScratchPage {
  return { height, strokes: [] };
}

export function pageIsEmpty(page: ScratchPage | null | undefined): boolean {
  return !page || page.strokes.length === 0;
}

export function pagePointCount(page: ScratchPage): number {
  return page.strokes.reduce((total, stroke) => total + stroke.points.length / 3, 0);
}

/** True when another stroke would take the page past what can be stored. */
export function pageIsFull(page: ScratchPage): boolean {
  return page.strokes.length >= MAX_STROKES_PER_PAGE || pagePointCount(page) >= MAX_POINTS_PER_PAGE;
}

/* ------------------------------------------------------------------- simplifying -- */

/**
 * Ramer–Douglas–Peucker, iterative so a very long stroke cannot exhaust the stack.
 *
 * A pointer reports far more positions than a curve needs — often one every few
 * milliseconds while the hand is barely moving. Dropping the points that lie within
 * `epsilon` of the line they sit on typically removes half of them with no visible change.
 */
export function simplifyStroke(points: number[], epsilon: number): number[] {
  const count = points.length / 3;
  if (count < 3) return points;
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const stack: Array<[number, number]> = [[0, count - 1]];
  const squaredEpsilon = epsilon * epsilon;

  while (stack.length) {
    const [first, last] = stack.pop() as [number, number];
    if (last <= first + 1) continue;
    const ax = points[first * 3];
    const ay = points[first * 3 + 1];
    const bx = points[last * 3];
    const by = points[last * 3 + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    let furthest = -1;
    let furthestDistance = 0;
    for (let index = first + 1; index < last; index += 1) {
      const px = points[index * 3];
      const py = points[index * 3 + 1];
      let distance: number;
      if (lengthSquared === 0) {
        distance = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        // Distance to the segment, not to the infinite line: a stroke that doubles back
        // would otherwise have its turning point discarded.
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
        distance = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
      }
      if (distance > furthestDistance) {
        furthestDistance = distance;
        furthest = index;
      }
    }
    if (furthest > 0 && furthestDistance > squaredEpsilon) {
      keep[furthest] = 1;
      stack.push([first, furthest], [furthest, last]);
    }
  }

  const output: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (!keep[index]) continue;
    output.push(points[index * 3], points[index * 3 + 1], points[index * 3 + 2]);
  }
  return output;
}

/* ----------------------------------------------------------------------- erasing -- */

/**
 * The interval of a segment that lies inside a circle, as a pair of parameters in [0, 1],
 * or null when the segment misses it.
 *
 * Working through the segment geometry rather than testing the recorded samples is what
 * makes erasing behave. A simplified straight line — an underline, a fraction bar, an axis —
 * is stored as its two endpoints and nothing in between, so a test that could only keep or
 * drop whole samples would delete the entire rule when the eraser touched its middle.
 */
function segmentInsideCircle(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, radius: number,
): [number, number] | null {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return fx * fx + fy * fy <= radius * radius ? [0, 1] : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return null;
  const root = Math.sqrt(discriminant);
  const enter = Math.max(0, (-b - root) / (2 * a));
  const exit = Math.min(1, (-b + root) / (2 * a));
  return enter < exit ? [enter, exit] : null;
}

/**
 * Erase everything within `radius` of (x, y), splitting strokes rather than deleting them.
 *
 * Deleting a whole stroke is easier and is what many vector editors do, but a line of
 * working is one long stroke: touching the eraser to a stray minus sign would take the whole
 * equation with it. Splitting keeps what was not touched, which is what a candidate rubbing
 * out one character expects, and the split ends land exactly on the eraser's edge rather
 * than on the nearest recorded sample.
 *
 * Returns the same array when nothing was within reach, so a caller can skip a redraw.
 */
export function eraseAt(strokes: ScratchStroke[], x: number, y: number, radius: number): ScratchStroke[] {
  let changed = false;
  const output: ScratchStroke[] = [];

  for (const stroke of strokes) {
    const points = stroke.points;
    const count = points.length / 3;
    // A highlighter is wide, so its visible band extends well past the recorded centre line.
    const reach = radius + (stroke.tool === "highlighter" ? HIGHLIGHTER_WIDTHS[stroke.size] / 2 : PEN_WIDTHS[stroke.size]);

    if (count === 1) {
      if (Math.hypot(points[0] - x, points[1] - y) <= reach) changed = true;
      else output.push(stroke);
      continue;
    }

    const runs: number[][] = [];
    let run: number[] = [];
    // A surviving fragment of a single point is a dot the candidate never drew, so a run
    // is only kept once it has two.
    const flush = () => {
      if (run.length >= 6) runs.push(run);
      run = [];
    };
    const at = (index: number): [number, number, number] => [points[index * 3], points[index * 3 + 1], points[index * 3 + 2]];
    const lerp = (from: [number, number, number], to: [number, number, number], t: number): [number, number, number] => [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ];
    const push = (point: [number, number, number]) => run.push(point[0], point[1], point[2]);

    let touched = false;
    for (let index = 0; index < count - 1; index += 1) {
      const from = at(index);
      const to = at(index + 1);
      const erased = segmentInsideCircle(from[0], from[1], to[0], to[1], x, y, reach);
      if (!erased) {
        if (!run.length) push(from);
        push(to);
        continue;
      }
      touched = true;
      const [enter, exit] = erased;
      if (enter > 0) {
        if (!run.length) push(from);
        push(lerp(from, to, enter));
      }
      flush();
      if (exit < 1) {
        push(lerp(from, to, exit));
        push(to);
      }
    }
    flush();

    if (!touched) {
      output.push(stroke);
      continue;
    }
    changed = true;
    for (const fragment of runs) output.push({ ...stroke, points: fragment });
  }

  return changed ? output : strokes;
}

/* ---------------------------------------------------------------------- encoding -- */

const TOOL_CODES: Record<MarkingTool, string> = { pen: "p", highlighter: "h" };
const TOOL_BY_CODE: Record<string, MarkingTool> = { p: "pen", h: "highlighter" };
const COLOUR_CODES: Record<ScratchColour, string> = { ink: "k", red: "r", blue: "b", green: "g" };
const COLOUR_BY_CODE: Record<string, ScratchColour> = { k: "ink", r: "red", b: "blue", g: "green" };

/** Zigzag, then five bits at a time in printable ASCII. */
function encodeNumber(value: number): string {
  let remaining = value < 0 ? ~(value << 1) : value << 1;
  let output = "";
  while (remaining >= 0x20) {
    output += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
    remaining >>>= 5;
  }
  return output + String.fromCharCode(remaining + 63);
}

function decodeNumbers(text: string): number[] {
  const values: number[] = [];
  let index = 0;
  while (index < text.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = text.charCodeAt(index) - 63;
      index += 1;
      if (byte < 0 || shift > 30) throw new Error("Malformed scratch page encoding.");
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < text.length);
    if (byte >= 0x20) throw new Error("Truncated scratch page encoding.");
    values.push(result & 1 ? ~(result >>> 1) : result >>> 1);
  }
  return values;
}

function encodeStroke(stroke: ScratchStroke): string {
  let previousX = 0;
  let previousY = 0;
  let previousPressure = 0;
  let body = "";
  for (let index = 0; index < stroke.points.length; index += 3) {
    const x = Math.round(stroke.points[index] * POSITION_SCALE);
    const y = Math.round(stroke.points[index + 1] * POSITION_SCALE);
    const pressure = Math.max(0, Math.min(PRESSURE_LEVELS, Math.round(stroke.points[index + 2] * PRESSURE_LEVELS)));
    body += encodeNumber(x - previousX) + encodeNumber(y - previousY) + encodeNumber(pressure - previousPressure);
    previousX = x;
    previousY = y;
    previousPressure = pressure;
  }
  return `${TOOL_CODES[stroke.tool]}${COLOUR_CODES[stroke.colour]}${stroke.size}${body}`;
}

function decodeStroke(text: string): ScratchStroke | null {
  const tool = TOOL_BY_CODE[text[0]];
  const colour = COLOUR_BY_CODE[text[1]];
  const size = Number(text[2]) as ScratchSize;
  if (!tool || !colour || ![1, 2, 3].includes(size)) return null;
  const numbers = decodeNumbers(text.slice(3));
  if (numbers.length % 3 !== 0 || numbers.length === 0) return null;
  const points: number[] = [];
  let x = 0;
  let y = 0;
  let pressure = 0;
  for (let index = 0; index < numbers.length; index += 3) {
    x += numbers[index];
    y += numbers[index + 1];
    pressure += numbers[index + 2];
    points.push(x / POSITION_SCALE, y / POSITION_SCALE, Math.max(0, Math.min(1, pressure / PRESSURE_LEVELS)));
  }
  return { tool, colour, size, points };
}

/** The stored form: a version marker, the page height, then one line per stroke. */
export function encodePage(page: ScratchPage): string {
  const header = `1|${Math.round(page.height * POSITION_SCALE)}`;
  return [header, ...page.strokes.map(encodeStroke)].join("\n");
}

/**
 * Decode a stored page, tolerating anything.
 *
 * This is the same doctrine `mergeState` follows for the rest of the record: the input has
 * been through Firestore, an older schema and possibly another device, so a malformed page
 * has to come back as an empty board rather than throw somewhere inside a paint handler.
 */
export function decodePage(text: string | null | undefined): ScratchPage {
  if (typeof text !== "string" || text.length === 0) return emptyPage();
  try {
    const [header, ...lines] = text.split("\n");
    const [version, height] = header.split("|");
    if (version !== "1") return emptyPage();
    const strokes: ScratchStroke[] = [];
    for (const line of lines) {
      if (line.length < 4) continue;
      const stroke = decodeStroke(line);
      if (stroke) strokes.push(stroke);
    }
    return { height: (Number(height) || 0) / POSITION_SCALE, strokes };
  } catch {
    return emptyPage();
  }
}

/** Bytes the encoded page occupies, for the storage budget the settings panel reports. */
export function encodedPageSize(page: ScratchPage): number {
  return encodePage(page).length;
}
