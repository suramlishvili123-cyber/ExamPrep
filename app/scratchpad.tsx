"use client";

/**
 * The whiteboard: a writing surface beside — or on top of — the question, so a paper can be
 * worked through on a tablet with nothing else on the desk.
 *
 * The data model, the erase operation and the wire format are in `app/lib/scratch.ts`. This
 * file is the surface itself: pointer handling, rendering and the toolbar.
 *
 * ## Two canvases
 *
 * Committed strokes are painted once onto a base layer; the stroke currently under the nib
 * is painted onto a transparent layer above it. Repainting tens of thousands of points on
 * every pointer move would put visible lag between the stylus and the ink, which is the one
 * thing a writing surface may not do.
 *
 * ## Palm rejection
 *
 * Once a stylus has been used, touch stops drawing. Resting a hand on a tablet while writing
 * is not optional, and a palm that draws makes the feature useless. Touch keeps working
 * normally until a pen is seen, so a finger remains a valid way to write for anyone without
 * a stylus.
 *
 * ## Uncontrolled by design
 *
 * The strokes live in refs, not in React state: a controlled board would re-render the
 * exam player on every sample. The component is seeded once from `initialPage` and reports
 * committed changes upwards, so the host **must** give it a `key` that changes with the
 * question. `ExamPlayer` does exactly that.
 */

import {
  Eraser,
  Highlighter,
  PenLine,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  BOARD_WIDTH,
  HIGHLIGHTER_WIDTHS,
  MAX_POINTS_PER_PAGE,
  MAX_STROKES_PER_PAGE,
  PEN_WIDTHS,
  SCRATCH_COLOURS,
  boardScale,
  eraseAt,
  pagePointCount,
  simplifyStroke,
  type ScratchColour,
  type ScratchPage,
  type ScratchSize,
  type ScratchStroke,
  type ScratchTool,
} from "./lib/scratch";

/** Board units of deviation allowed when a finished stroke is simplified. */
const SIMPLIFY_EPSILON = 0.55;

/** The eraser's radius in board units; a little wider than the thickest nib. */
const ERASER_RADIUS = 9;

/** How much of the nib width the lightest and heaviest pressure produce. */
const PRESSURE_FLOOR = 0.55;
const PRESSURE_RANGE = 0.75;

/** Pointers that report no pressure — a mouse, or a trackpad — draw at mid weight. */
const NEUTRAL_PRESSURE = 0.5;

/** Undo depth. Snapshots share their stroke objects, so each entry is a list of pointers. */
const HISTORY_DEPTH = 40;

export type ScratchLayout = "off" | "split" | "overlay";

export interface ScratchPreferences {
  colour: ScratchColour;
  size: ScratchSize;
  stylusOnly: boolean;
}

function strokeWidth(stroke: ScratchStroke, pressure: number): number {
  if (stroke.tool === "highlighter") return HIGHLIGHTER_WIDTHS[stroke.size];
  return PEN_WIDTHS[stroke.size] * (PRESSURE_FLOOR + PRESSURE_RANGE * pressure);
}

/**
 * Paint one stroke at `scale`. Segments are drawn as quadratic curves through the midpoints
 * of consecutive samples, which is what turns a polyline of pointer positions into
 * handwriting rather than a chain of straight lines.
 */
function paintStroke(context: CanvasRenderingContext2D, stroke: ScratchStroke, scale: number): void {
  const points = stroke.points;
  const count = points.length / 3;
  if (count === 0) return;
  context.lineCap = "round";
  context.lineJoin = "round";
  const palette = SCRATCH_COLOURS[stroke.colour];

  if (stroke.tool === "highlighter") {
    // One translucent pass for the whole stroke: stroking it segment by segment would
    // double the alpha wherever two segments meet and produce a beaded line.
    context.save();
    context.globalAlpha = 0.4;
    context.strokeStyle = palette.highlight;
    context.lineWidth = HIGHLIGHTER_WIDTHS[stroke.size] * scale;
    context.beginPath();
    context.moveTo(points[0] * scale, points[1] * scale);
    for (let index = 1; index < count; index += 1) {
      context.lineTo(points[index * 3] * scale, points[index * 3 + 1] * scale);
    }
    if (count === 1) context.lineTo(points[0] * scale, points[1] * scale);
    context.stroke();
    context.restore();
    return;
  }

  context.strokeStyle = palette.ink;
  context.fillStyle = palette.ink;
  if (count === 1) {
    // A tap is a full stop or a decimal point, and has to leave a mark.
    context.beginPath();
    context.arc(points[0] * scale, points[1] * scale, strokeWidth(stroke, points[2]) * scale / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  for (let index = 1; index < count; index += 1) {
    const px = points[(index - 1) * 3];
    const py = points[(index - 1) * 3 + 1];
    const cx = points[index * 3];
    const cy = points[index * 3 + 1];
    const startX = index === 1 ? px : (px + cx) / 2;
    const startY = index === 1 ? py : (py + cy) / 2;
    const endX = index === count - 1 ? cx : (cx + points[(index + 1) * 3]) / 2;
    const endY = index === count - 1 ? cy : (cy + points[(index + 1) * 3 + 1]) / 2;
    context.lineWidth = strokeWidth(stroke, points[index * 3 + 2]) * scale;
    context.beginPath();
    context.moveTo(startX * scale, startY * scale);
    context.quadraticCurveTo(cx * scale, cy * scale, endX * scale, endY * scale);
    context.stroke();
  }
}

const SIZE_LABELS: Record<ScratchSize, string> = { 1: "Fine", 2: "Medium", 3: "Broad" };

interface BoardStatus {
  strokes: number;
  points: number;
  canUndo: boolean;
  canRedo: boolean;
}

interface ScratchpadProps {
  /** Seeded once at mount. The host must key this component by the question. */
  initialPage: ScratchPage | null;
  /** Called after every committed change; the host decides when to persist. */
  onChange: (page: ScratchPage) => void;
  layout: Exclude<ScratchLayout, "off">;
  preferences: ScratchPreferences;
  onPreferencesChange: (patch: Partial<ScratchPreferences>) => void;
  /** Reported when the page fills up, or a stylus is first detected. */
  onNotice?: (message: string) => void;
  /** Extra controls the host adds to the toolbar — the layout switch and close button. */
  toolbarExtras?: React.ReactNode;
}

export const Scratchpad = memo(function Scratchpad({
  initialPage,
  onChange,
  layout,
  preferences,
  onPreferencesChange,
  onNotice,
  toolbarExtras,
}: ScratchpadProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);

  const strokesRef = useRef<ScratchStroke[]>(initialPage?.strokes ?? []);
  const undoRef = useRef<ScratchStroke[][]>([]);
  const redoRef = useRef<ScratchStroke[][]>([]);
  const heightRef = useRef(initialPage?.height ?? 0);
  const scaleRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const drawingRef = useRef<{ pointerId: number; stroke: ScratchStroke } | null>(null);
  const erasingRef = useRef<number | null>(null);
  const lastErasePointRef = useRef<[number, number] | null>(null);
  const penSeenRef = useRef(false);
  const fullWarnedRef = useRef(false);

  const [tool, setTool] = useState<ScratchTool>("pen");
  const [status, setStatus] = useState<BoardStatus>(() => ({
    strokes: initialPage?.strokes.length ?? 0,
    points: initialPage ? pagePointCount(initialPage) : 0,
    canUndo: false,
    canRedo: false,
  }));

  const { colour, size, stylusOnly } = preferences;

  const syncStatus = useCallback(() => {
    setStatus({
      strokes: strokesRef.current.length,
      points: pagePointCount({ height: heightRef.current, strokes: strokesRef.current }),
      canUndo: undoRef.current.length > 0,
      canRedo: redoRef.current.length > 0,
    });
  }, []);

  const paintAll = useCallback(() => {
    const canvas = baseRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const ratio = canvas.width / Math.max(1, sizeRef.current.width);
    context.scale(ratio, ratio);
    for (const stroke of strokesRef.current) paintStroke(context, stroke, scaleRef.current);
  }, []);

  /** Match the backing stores to the surface, then repaint at the new scale. */
  const measure = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    sizeRef.current = { width, height };
    // Capped: a device pixel ratio of 3 on a large tablet costs a great deal of fill rate
    // for a difference nobody can see on a 2 px line.
    const ratio = Math.min(2.5, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    for (const canvas of [baseRef.current, liveRef.current]) {
      if (!canvas) continue;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    // The board is as tall as the tallest surface it has ever been written on, so a page
    // started on a large screen is shrunk to fit a small one rather than clipped.
    heightRef.current = Math.max(heightRef.current, height / (width / BOARD_WIDTH));
    scaleRef.current = boardScale({ height: heightRef.current, strokes: [] }, width, height);
    paintAll();
  }, [paintAll]);

  useEffect(() => {
    measure();
    const surface = surfaceRef.current;
    if (typeof ResizeObserver === "undefined" || !surface) {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [measure]);

  const commit = useCallback((strokes: ScratchStroke[]) => {
    strokesRef.current = strokes;
    onChange({ height: heightRef.current, strokes });
    syncStatus();
  }, [onChange, syncStatus]);

  const pushUndo = useCallback(() => {
    undoRef.current = [...undoRef.current.slice(-(HISTORY_DEPTH - 1)), strokesRef.current];
    redoRef.current = [];
  }, []);

  const clearLive = useCallback(() => {
    const canvas = liveRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const boardPoint = useCallback((clientX: number, clientY: number): [number, number] => {
    const canvas = liveRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current || 1;
    return [(clientX - rect.left) / scale, (clientY - rect.top) / scale];
  }, []);

  /** Whether this pointer is allowed to write on the board. */
  const accepts = useCallback((pointerType: string): boolean => {
    if (pointerType === "pen") {
      if (!penSeenRef.current) {
        penSeenRef.current = true;
        onNotice?.("Stylus detected. Your palm will no longer draw on the board.");
      }
      return true;
    }
    if (pointerType === "touch") return !stylusOnly && !penSeenRef.current;
    return !stylusOnly;
  }, [onNotice, stylusOnly]);

  const paintLive = useCallback((stroke: ScratchStroke) => {
    const canvas = liveRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    const ratio = canvas.width / Math.max(1, sizeRef.current.width);
    context.scale(ratio, ratio);
    // The whole in-progress stroke is repainted rather than only its newest segment: a
    // translucent highlighter would otherwise darken wherever the passes overlapped, and
    // one stroke is short enough for this to stay well inside a frame.
    context.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    paintStroke(context, stroke, scaleRef.current);
  }, []);

  /**
   * Erase along the path travelled since the last position, not just at the new one.
   *
   * A quick sweep of the hand reports positions far more than an eraser's width apart, and
   * rubbing out only at those points would leave untouched islands of ink between them.
   */
  const eraseFrom = useCallback((clientX: number, clientY: number) => {
    const [x, y] = boardPoint(clientX, clientY);
    const previous = lastErasePointRef.current;
    lastErasePointRef.current = [x, y];
    let strokes = strokesRef.current;
    const steps = previous
      ? Math.min(64, Math.ceil(Math.hypot(x - previous[0], y - previous[1]) / (ERASER_RADIUS * 0.6)))
      : 0;
    for (let step = 1; step <= steps && previous; step += 1) {
      const t = step / steps;
      strokes = eraseAt(strokes, previous[0] + (x - previous[0]) * t, previous[1] + (y - previous[1]) * t, ERASER_RADIUS);
    }
    if (steps === 0) strokes = eraseAt(strokes, x, y, ERASER_RADIUS);
    if (strokes === strokesRef.current) return;
    commit(strokes);
    paintAll();
  }, [boardPoint, commit, paintAll]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || !accepts(event.pointerType)) return;
    // Only after the pointer is accepted: preventing the default on a rejected touch would
    // stop the candidate scrolling the question with a finger.
    event.preventDefault();
    try {
      // Capture keeps a stroke coming to this canvas when the nib crosses its edge. It
      // throws if the pointer is no longer active, which is a failed capture rather than a
      // failed stroke — the stroke still works, it just stops at the boundary.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignored deliberately; see above.
    }

    if (tool === "eraser") {
      pushUndo();
      erasingRef.current = event.pointerId;
      // A fresh sweep starts here, so it must not join up with wherever the last one ended.
      lastErasePointRef.current = null;
      eraseFrom(event.clientX, event.clientY);
      syncStatus();
      return;
    }

    const full = strokesRef.current.length >= MAX_STROKES_PER_PAGE
      || pagePointCount({ height: heightRef.current, strokes: strokesRef.current }) >= MAX_POINTS_PER_PAGE;
    if (full) {
      if (!fullWarnedRef.current) {
        fullWarnedRef.current = true;
        onNotice?.("This board is full. Erase some working, or clear it, to keep writing.");
      }
      return;
    }

    pushUndo();
    const [x, y] = boardPoint(event.clientX, event.clientY);
    const stroke: ScratchStroke = {
      tool: tool === "highlighter" ? "highlighter" : "pen",
      colour,
      size,
      points: [x, y, event.pressure > 0 ? event.pressure : NEUTRAL_PRESSURE],
    };
    drawingRef.current = { pointerId: event.pointerId, stroke };
    paintLive(stroke);
    syncStatus();
  }, [accepts, boardPoint, colour, eraseFrom, onNotice, paintLive, pushUndo, size, syncStatus, tool]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (erasingRef.current === event.pointerId) {
      event.preventDefault();
      eraseFrom(event.clientX, event.clientY);
      return;
    }
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    event.preventDefault();
    const points = drawing.stroke.points;
    const push = (clientX: number, clientY: number, pressure: number) => {
      const [x, y] = boardPoint(clientX, clientY);
      // Movement below a quarter of a board unit is stylus jitter, not writing.
      if (Math.hypot(x - points[points.length - 3], y - points[points.length - 2]) < 0.25) return;
      points.push(x, y, pressure > 0 ? pressure : NEUTRAL_PRESSURE);
    };
    // Coalesced events recover the samples the browser batched into one frame, which is
    // what stops a fast stroke on a high-rate stylus from coming out as a polygon.
    const coalesced = typeof event.nativeEvent.getCoalescedEvents === "function"
      ? event.nativeEvent.getCoalescedEvents()
      : [];
    if (coalesced.length) {
      for (const sample of coalesced) push(sample.clientX, sample.clientY, sample.pressure);
    } else {
      push(event.clientX, event.clientY, event.pressure);
    }
    paintLive(drawing.stroke);
  }, [boardPoint, eraseFrom, paintLive]);

  const finishStroke = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (erasingRef.current === event.pointerId) {
      erasingRef.current = null;
      lastErasePointRef.current = null;
      return;
    }
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    drawingRef.current = null;
    const stroke = { ...drawing.stroke, points: simplifyStroke(drawing.stroke.points, SIMPLIFY_EPSILON) };
    clearLive();
    const context = baseRef.current?.getContext("2d");
    if (context) paintStroke(context, stroke, scaleRef.current);
    commit([...strokesRef.current, stroke]);
  }, [clearLive, commit]);

  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current = [...redoRef.current.slice(-(HISTORY_DEPTH - 1)), strokesRef.current];
    commit(previous);
    paintAll();
  }, [commit, paintAll]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current = [...undoRef.current.slice(-(HISTORY_DEPTH - 1)), strokesRef.current];
    commit(next);
    paintAll();
  }, [commit, paintAll]);

  const clear = useCallback(() => {
    if (!strokesRef.current.length) return;
    pushUndo();
    commit([]);
    paintAll();
    clearLive();
  }, [clearLive, commit, paintAll, pushUndo]);

  const fill = Math.max(status.strokes / MAX_STROKES_PER_PAGE, status.points / MAX_POINTS_PER_PAGE);

  return (
    <section className={`scratchpad scratchpad-${layout}`} aria-label="Working whiteboard">
      <div className="scratch-tools">
        <div className="scratch-tool-group" role="group" aria-label="Writing tool">
          {([
            { id: "pen", label: "Pen", icon: PenLine },
            { id: "highlighter", label: "Highlighter", icon: Highlighter },
            { id: "eraser", label: "Eraser", icon: Eraser },
          ] as const).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={tool === item.id ? "selected" : ""}
                aria-pressed={tool === item.id}
                title={item.label}
                onClick={() => setTool(item.id)}
              >
                <Icon size={16} /><span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="scratch-tool-group scratch-colours" role="group" aria-label="Ink colour">
          {(Object.keys(SCRATCH_COLOURS) as ScratchColour[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`scratch-swatch ${colour === key ? "selected" : ""}`}
              style={{ "--swatch": SCRATCH_COLOURS[key].ink } as React.CSSProperties}
              aria-pressed={colour === key}
              aria-label={`${SCRATCH_COLOURS[key].label} ink`}
              title={SCRATCH_COLOURS[key].label}
              onClick={() => {
                onPreferencesChange({ colour: key });
                if (tool === "eraser") setTool("pen");
              }}
            />
          ))}
        </div>

        <div className="scratch-tool-group scratch-sizes" role="group" aria-label="Nib width">
          {([1, 2, 3] as ScratchSize[]).map((value) => (
            <button
              key={value}
              type="button"
              className={size === value ? "selected" : ""}
              aria-pressed={size === value}
              aria-label={`${SIZE_LABELS[value]} nib`}
              title={`${SIZE_LABELS[value]} nib`}
              onClick={() => onPreferencesChange({ size: value })}
            >
              <i style={{ width: `${3 + value * 3}px`, height: `${3 + value * 3}px` }} />
            </button>
          ))}
        </div>

        <div className="scratch-tool-group scratch-history" role="group" aria-label="Board history">
          <button type="button" onClick={undo} disabled={!status.canUndo} title="Undo" aria-label="Undo"><Undo2 size={16} /></button>
          <button type="button" onClick={redo} disabled={!status.canRedo} title="Redo" aria-label="Redo"><Redo2 size={16} /></button>
          <button type="button" onClick={clear} disabled={!status.strokes} title="Clear board" aria-label="Clear board"><Trash2 size={16} /></button>
        </div>

        {toolbarExtras ? <div className="scratch-tool-group scratch-extras">{toolbarExtras}</div> : null}
      </div>

      <div className="scratch-surface" ref={surfaceRef} data-tool={tool}>
        <canvas ref={baseRef} className="scratch-layer" aria-hidden="true" />
        <canvas
          ref={liveRef}
          className="scratch-layer scratch-layer-live"
          role="img"
          aria-label={status.strokes
            ? `Whiteboard holding ${status.strokes} stroke${status.strokes === 1 ? "" : "s"} of your working. Write with a stylus, finger or mouse.`
            : "Empty whiteboard. Write your working here with a stylus, finger or mouse."}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={finishStroke}
          onContextMenu={(event) => event.preventDefault()}
        />
        {fill >= 0.8 ? (
          <p className="scratch-fill-warning" role="status">
            This board is {Math.min(100, Math.round(fill * 100))}% full. Erase working you no longer need.
          </p>
        ) : null}
      </div>
    </section>
  );
});

/**
 * A finished page, drawn once and never edited — the review screens showing what a candidate
 * actually wrote against a question they went on to get wrong.
 */
export function ScratchpadPreview({ page, label }: { page: ScratchPage; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !wrap || !context) return;
    const paint = () => {
      const width = Math.max(1, Math.round(wrap.getBoundingClientRect().width));
      // The preview keeps the page's own aspect ratio rather than a fixed box, so nothing
      // written near the bottom of the board is cropped out of the review.
      const height = Math.max(1, Math.round(width * (page.height || BOARD_WIDTH) / BOARD_WIDTH));
      const ratio = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(ratio, ratio);
      const scale = boardScale(page, width, height);
      for (const stroke of page.strokes) paintStroke(context, stroke, scale);
    };
    paint();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [page]);

  return (
    <figure className="scratch-preview" ref={wrapRef}>
      <figcaption>{label}</figcaption>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${label}: ${page.strokes.length} handwritten stroke${page.strokes.length === 1 ? "" : "s"}. This is a picture of your own working, so it has no text alternative.`}
      />
    </figure>
  );
}
