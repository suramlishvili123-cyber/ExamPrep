"use client";

/**
 * Writing on the question.
 *
 * The candidate works directly on the paper, as they would with a printed question: ink goes
 * beside the diagram it refers to and under the line of algebra it follows from.
 *
 * The data model, the erase operation and the wire format are in `app/lib/scratch.ts`. This
 * file is the surface: pointer handling, rendering and the tool controls.
 *
 * ## Ink is anchored to the question, not to the screen
 *
 * The canvas is a sibling of the question inside the same box, and both are sized from the
 * question's own shape. Board coordinates run 0–1000 across the width of the question itself,
 * so a stroke is stored relative to the paper. Zooming resizes the box and the ink is
 * repainted — not rescaled as a bitmap — at the new size; scrolling moves the box and the ink
 * goes with it. Annotation therefore stays exactly where it was put, at any magnification,
 * and lands in the same place when the page is read back on a different device.
 *
 * ## Two canvases
 *
 * Committed strokes are painted once onto a base layer; the stroke under the nib is painted
 * onto a transparent layer above it. Repainting tens of thousands of points on every pointer
 * move would put visible lag between the stylus and the ink, which is the one thing a
 * writing surface may not do.
 *
 * ## Palm rejection
 *
 * Once a stylus has been used, touch stops drawing and starts scrolling the question instead.
 * Resting a hand on a tablet while writing is not optional, and a palm that draws makes the
 * feature useless. Touch keeps writing until a pen is seen, so a finger remains a valid way
 * to write for anyone without a stylus — and the Move tool gives them scrolling back.
 *
 * ## Uncontrolled by design
 *
 * The strokes live in refs, not in React state: a controlled surface would re-render the exam
 * player on every sample. The layer is seeded once from `initialPage`, so the host **must**
 * give it a `key` that changes with the question. `ExamPlayer` does exactly that.
 */

import {
  Eraser,
  Hand,
  Highlighter,
  PenLine,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  BOARD_WIDTH,
  HIGHLIGHTER_WIDTHS,
  MAX_POINTS_PER_PAGE,
  MAX_STROKES_PER_PAGE,
  PEN_WIDTHS,
  SCRATCH_COLOURS,
  eraseAt,
  inkExtent,
  pageIsFull,
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

/**
 * A touch contact wider or taller than this, in CSS pixels, is taken to be a palm.
 *
 * This can only ever reject, never accept. Most browsers report 1x1 for every touch, and a
 * default of 1 can never exceed the threshold — so where the geometry is unknown nothing
 * changes, and where it is reported a resting hand is caught. It matters for capacitive
 * styluses, which arrive as `pointerType: "touch"` and so cannot be told from a palm by
 * type alone; a fine tip reports a small contact patch, the heel of a hand a large one.
 */
const MAX_TOUCH_CONTACT_PX = 22;

/**
 * Pen buttons, as bit flags in `PointerEvent.buttons`.
 *
 * The eraser end of a Surface or Wacom pen arrives as a pen contact with the eraser flag
 * set, and the barrel button as the secondary flag. Both mean "rub out" to the hand holding
 * it, whatever the toolbar happens to have selected. Tested as a mask rather than for
 * equality: a barrel button held while the tip is down reports both flags at once.
 */
const PEN_ERASER_FLAG = 32;
const PEN_BARREL_FLAG = 2;
/** The same two, as the `button` that changed on the event that started the contact. */
const PEN_ERASER_BUTTON = 5;
const PEN_BARREL_BUTTON = 2;

/** True when this pen event is asking to erase rather than to write. */
export function isPenErasing(event: Pick<PointerEvent, "pointerType" | "button" | "buttons">): boolean {
  if (event.pointerType !== "pen") return false;
  if (event.button === PEN_ERASER_BUTTON || event.button === PEN_BARREL_BUTTON) return true;
  return (event.buttons & (PEN_ERASER_FLAG | PEN_BARREL_FLAG)) !== 0;
}

/**
 * True when a touch contact is large enough to be a resting hand rather than a fingertip.
 * Unknown geometry — the 0 or 1 most browsers report — is never treated as a palm.
 */
export function isPalmContact(width: number, height: number): boolean {
  return width > MAX_TOUCH_CONTACT_PX || height > MAX_TOUCH_CONTACT_PX;
}

export interface ScratchPreferences {
  colour: ScratchColour;
  size: ScratchSize;
  stylusOnly: boolean;
}

export interface AnnotationStatus {
  strokes: number;
  canUndo: boolean;
  canRedo: boolean;
  /** How close this question's page is to the stored-size bound, as a fraction. */
  fill: number;
}

export const EMPTY_ANNOTATION_STATUS: AnnotationStatus = { strokes: 0, canUndo: false, canRedo: false, fill: 0 };

/** The controls the toolbar drives, which live with the strokes rather than in React state. */
export interface AnnotatorHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
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
export function paintStroke(context: CanvasRenderingContext2D, stroke: ScratchStroke, scale: number): void {
  const points = stroke.points;
  const count = points.length / 3;
  if (count === 0) return;
  context.lineCap = "round";
  context.lineJoin = "round";
  const palette = SCRATCH_COLOURS[stroke.colour];

  if (stroke.tool === "highlighter") {
    // One translucent pass for the whole stroke: stroking it segment by segment would double
    // the alpha wherever two segments meet and produce a beaded line. `multiply` keeps the
    // printed question readable through the highlight rather than washing it out.
    context.save();
    context.globalAlpha = 0.45;
    context.globalCompositeOperation = "multiply";
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

interface AnnotatorProps {
  /** Seeded once at mount. The host must key this component by the question. */
  initialPage: ScratchPage | null;
  /** Called after every committed change; the host decides when to persist. */
  onChange: (page: ScratchPage) => void;
  /**
   * The page's height in board units — 1000 × (height ÷ width) of the page itself. Fixed by
   * the paper rather than by the window, so the same writing lands in the same place on
   * every device.
   */
  boardHeight: number;
  /**
   * The page's size in CSS pixels, passed in rather than observed.
   *
   * The host already knows it exactly, and a `ResizeObserver` only reports during the
   * rendering steps — which a browser skips entirely while the page is not being painted.
   * Depending on the observer alone would leave the canvases at whatever size they were
   * last told about, so writing would land in the wrong place until the tab was looked at.
   * The observer is kept as a backstop for changes the host does not drive.
   */
  pageWidth: number;
  pagePixelHeight: number;
  tool: ScratchTool;
  preferences: ScratchPreferences;
  /**
   * Whether a stylus has been used anywhere in this session.
   *
   * Held by the host rather than here: this component is keyed by the question, so its own
   * state is thrown away at every navigation. A candidate who rests a palm on the glass a
   * moment before the nib lands on the next question would otherwise have that palm treated
   * as a first-ever finger and be left with a stray mark.
   */
  penSeen: boolean;
  /** Reported the first time a stylus is used, so the host can remember it. */
  onPenSeen?: () => void;
  onStatusChange: (status: AnnotationStatus) => void;
  /** Reported when the page fills up, or a stylus is first detected. */
  onNotice?: (message: string) => void;
  ref?: Ref<AnnotatorHandle>;
}

export const QuestionAnnotator = memo(function QuestionAnnotator({
  initialPage,
  onChange,
  boardHeight,
  pageWidth,
  pagePixelHeight,
  tool,
  preferences,
  penSeen,
  onPenSeen,
  onStatusChange,
  onNotice,
  ref,
}: AnnotatorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);

  const strokesRef = useRef<ScratchStroke[]>(initialPage?.strokes ?? []);
  const undoRef = useRef<ScratchStroke[][]>([]);
  const redoRef = useRef<ScratchStroke[][]>([]);
  const scaleRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const drawingRef = useRef<{ pointerId: number; stroke: ScratchStroke } | null>(null);
  const erasingRef = useRef<number | null>(null);
  const lastErasePointRef = useRef<[number, number] | null>(null);
  const fullWarnedRef = useRef(false);
  // Mirrors the stroke count for the accessible label only. The strokes themselves stay in
  // a ref; a ref cannot be read during render, and the label has to say something true.
  const [strokeCount, setStrokeCount] = useState(initialPage?.strokes.length ?? 0);

  const { colour, size, stylusOnly } = preferences;

  const publishStatus = useCallback(() => {
    setStrokeCount(strokesRef.current.length);
    onStatusChange({
      strokes: strokesRef.current.length,
      canUndo: undoRef.current.length > 0,
      canRedo: redoRef.current.length > 0,
      fill: Math.max(
        strokesRef.current.length / MAX_STROKES_PER_PAGE,
        pagePointCount({ height: boardHeight, strokes: strokesRef.current }) / MAX_POINTS_PER_PAGE,
      ),
    });
  }, [boardHeight, onStatusChange]);

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

  /**
   * Match the backing stores to the question's rendered box, then repaint.
   *
   * The scale is the question's width in pixels over its width in board units, so ink is
   * redrawn at whatever magnification the question is shown at — sharp, rather than a bitmap
   * stretched to fit.
   */
  const measure = useCallback((width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    if (width === sizeRef.current.width && height === sizeRef.current.height) return;
    sizeRef.current = { width, height };
    // Capped: a device pixel ratio of 3 on a large tablet costs a great deal of fill rate for
    // a difference nobody can see on a 2 px line.
    const ratio = Math.min(2.5, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    for (const canvas of [baseRef.current, liveRef.current]) {
      if (!canvas) continue;
      // Only the backing store is set. The CSS size comes from the stylesheet, so the ink
      // always covers exactly the page even in the moment before a new size is applied.
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    scaleRef.current = width / BOARD_WIDTH;
    paintAll();
  }, [paintAll]);

  // Resize with the page the host reports, which is exact and needs no paint to arrive.
  useEffect(() => {
    measure(pageWidth, pagePixelHeight);
  }, [measure, pageWidth, pagePixelHeight]);

  // Report what was restored, so Clear and the fill warning are right before the first
  // stroke rather than only after one.
  useEffect(() => {
    publishStatus();
    // Once per question: the layer is keyed by it, and `publishStatus` only reports upwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A backstop for anything the host does not drive, such as a browser zoom change.
  useEffect(() => {
    const host = hostRef.current;
    const remeasure = () => {
      const rect = host?.getBoundingClientRect();
      if (rect) measure(Math.round(rect.width), Math.round(rect.height));
    };
    if (typeof ResizeObserver === "undefined" || !host) {
      window.addEventListener("resize", remeasure);
      return () => window.removeEventListener("resize", remeasure);
    }
    const observer = new ResizeObserver(remeasure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [measure]);

  const commit = useCallback((strokes: ScratchStroke[]) => {
    strokesRef.current = strokes;
    // Never shorter than the writing reaches: see `inkExtent`. The question's own geometry
    // sets the height, but taking blank paper away later must not hide what was written on
    // it when the page is read back.
    onChange({ height: Math.max(boardHeight, inkExtent(strokes)), strokes });
    publishStatus();
  }, [boardHeight, onChange, publishStatus]);

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

  /** Whether this pointer is allowed to write. */
  const accepts = useCallback((pointerType: string, width: number, height: number): boolean => {
    if (pointerType === "pen") {
      if (!penSeen) {
        onPenSeen?.();
        onNotice?.("Stylus detected. Your palm will no longer draw, and a finger now moves the question.");
      }
      return true;
    }
    if (pointerType !== "touch") return !stylusOnly;
    // A palm is rejected on its own account, before the stylus rule, so a hand put down
    // first on a fresh question cannot leave a mark even where no pen has been seen yet.
    if (isPalmContact(width, height)) return false;
    return !stylusOnly && !penSeen;
  }, [onNotice, onPenSeen, penSeen, stylusOnly]);

  const paintLive = useCallback((stroke: ScratchStroke) => {
    const canvas = liveRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    const ratio = canvas.width / Math.max(1, sizeRef.current.width);
    context.scale(ratio, ratio);
    // The whole in-progress stroke is repainted rather than only its newest segment: a
    // translucent highlighter would otherwise darken wherever the passes overlapped, and one
    // stroke is short enough for this to stay well inside a frame.
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
    // The Move tool exists for a candidate with no stylus, whose finger would otherwise
    // always draw. It hands every pointer straight back to the browser's own scrolling.
    if (tool === "pan" || !event.isPrimary || !accepts(event.pointerType, event.width, event.height)) return;
    // Only after the pointer is accepted: preventing the default on a rejected touch would
    // stop the candidate scrolling the question with a finger.
    event.preventDefault();
    try {
      // Capture keeps a stroke coming to this canvas when the nib crosses its edge. It throws
      // if the pointer is no longer active, which is a failed capture rather than a failed
      // stroke — the stroke still works, it just stops at the boundary.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignored deliberately; see above.
    }

    // The eraser end and the barrel button rub out whatever the toolbar has selected: that
    // is what the hand holding the pen expects, and it saves a round trip to the toolbar.
    if (tool === "eraser" || isPenErasing(event.nativeEvent)) {
      pushUndo();
      erasingRef.current = event.pointerId;
      // A fresh sweep starts here, so it must not join up with wherever the last one ended.
      lastErasePointRef.current = null;
      eraseFrom(event.clientX, event.clientY);
      publishStatus();
      return;
    }

    if (pageIsFull({ height: boardHeight, strokes: strokesRef.current })) {
      if (!fullWarnedRef.current) {
        fullWarnedRef.current = true;
        onNotice?.("There is no room left for more writing on this question. Erase some of it to carry on.");
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
    publishStatus();
  }, [accepts, boardHeight, boardPoint, colour, eraseFrom, onNotice, paintLive, publishStatus, pushUndo, size, tool]);

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
    // Coalesced events recover the samples the browser batched into one frame, which is what
    // stops a fast stroke on a high-rate stylus from coming out as a polygon.
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

  useImperativeHandle(ref, () => ({
    undo: () => {
      const previous = undoRef.current.pop();
      if (!previous) return;
      redoRef.current = [...redoRef.current.slice(-(HISTORY_DEPTH - 1)), strokesRef.current];
      commit(previous);
      paintAll();
    },
    redo: () => {
      const next = redoRef.current.pop();
      if (!next) return;
      undoRef.current = [...undoRef.current.slice(-(HISTORY_DEPTH - 1)), strokesRef.current];
      commit(next);
      paintAll();
    },
    clear: () => {
      if (!strokesRef.current.length) return;
      pushUndo();
      commit([]);
      paintAll();
      clearLive();
    },
  }), [clearLive, commit, paintAll, pushUndo]);

  /**
   * Who moves the question under a finger.
   *
   * Once a stylus is in use — or touch is switched off entirely — a finger belongs to the
   * browser, which scrolls the frame natively while the ink stays where it was put. Under
   * the Move tool the host pans explicitly for every kind of pointer, so the browser must
   * not scroll as well: leaving it to do both moved the page twice as far as the finger.
   */
  const touchAction = tool !== "pan" && (penSeen || stylusOnly) ? "auto" : "none";


  return (
    <div className="annotation-layer" ref={hostRef}>
      <canvas ref={baseRef} className="annotation-canvas" aria-hidden="true" />
      <canvas
        ref={liveRef}
        className="annotation-canvas annotation-canvas-live"
        style={{ touchAction, cursor: tool === "pan" ? "grab" : tool === "eraser" ? "cell" : "crosshair" }}
        role="img"
        aria-label={strokeCount
          ? `Your writing on this question: ${strokeCount} stroke${strokeCount === 1 ? "" : "s"}. Write with a stylus, finger or mouse.`
          : "Writing layer over the question. Write your working here with a stylus, finger or mouse."}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onLostPointerCapture={finishStroke}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
});

const SIZE_LABELS: Record<ScratchSize, string> = { 1: "Fine", 2: "Medium", 3: "Broad" };

const TOOL_ITEMS = [
  { id: "pen", label: "Pen", icon: PenLine },
  { id: "highlighter", label: "Highlighter", icon: Highlighter },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "pan", label: "Move", icon: Hand },
] as const;

/**
 * The writing controls, rendered in the question's own toolbar rather than floating over the
 * paper — anything floating would cover the thing being annotated.
 */
export const EXTRA_SPACE_OPTIONS: Array<{ value: number; label: string; short: string }> = [
  { value: 0, label: "No extra space", short: "None" },
  { value: 0.5, label: "Half a page more", short: "+\u00bd" },
  { value: 1, label: "A page more", short: "+1" },
  { value: 2, label: "Two pages more", short: "+2" },
];

export function AnnotationToolbar({
  tool,
  onToolChange,
  preferences,
  onPreferencesChange,
  extraSpace = 0,
  onExtraSpaceChange,
  status,
  onUndo,
  onRedo,
  onClear,
  onClose,
}: {
  tool: ScratchTool;
  onToolChange: (tool: ScratchTool) => void;
  preferences: ScratchPreferences;
  onPreferencesChange: (patch: Partial<ScratchPreferences>) => void;
  /** Blank paper below the question, as a multiple of its height. */
  extraSpace?: number;
  onExtraSpaceChange?: (value: number) => void;
  status: AnnotationStatus;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onClose?: () => void;
}) {
  const { colour, size } = preferences;
  return (
    <div className="annotation-tools">
      <div className="annotation-group" role="group" aria-label="Writing tool">
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={tool === item.id ? "selected" : ""}
              aria-pressed={tool === item.id}
              title={item.id === "pan" ? "Move the question without writing on it" : item.label}
              onClick={() => onToolChange(item.id)}
            >
              <Icon size={16} /><span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="annotation-group annotation-colours" role="group" aria-label="Ink colour">
        {(Object.keys(SCRATCH_COLOURS) as ScratchColour[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`annotation-swatch ${colour === key ? "selected" : ""}`}
            style={{ "--swatch": SCRATCH_COLOURS[key].ink } as React.CSSProperties}
            aria-pressed={colour === key}
            aria-label={`${SCRATCH_COLOURS[key].label} ink`}
            title={SCRATCH_COLOURS[key].label}
            onClick={() => {
              onPreferencesChange({ colour: key });
              // Choosing an ink while erasing or moving means writing is what is wanted.
              if (tool === "eraser" || tool === "pan") onToolChange("pen");
            }}
          />
        ))}
      </div>

      <div className="annotation-group annotation-sizes" role="group" aria-label="Nib width">
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

      {onExtraSpaceChange ? (
        <div className="annotation-group annotation-space" role="group" aria-label="Room to write">
          {EXTRA_SPACE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={extraSpace === option.value ? "selected" : ""}
              aria-pressed={extraSpace === option.value}
              title={`${option.label} below the question`}
              onClick={() => onExtraSpaceChange(option.value)}
            >
              {option.short}
            </button>
          ))}
        </div>
      ) : null}

      <div className="annotation-group annotation-history" role="group" aria-label="Writing history">
        <button type="button" onClick={onUndo} disabled={!status.canUndo} title="Undo" aria-label="Undo"><Undo2 size={16} /></button>
        <button type="button" onClick={onRedo} disabled={!status.canRedo} title="Redo" aria-label="Redo"><Redo2 size={16} /></button>
        <button type="button" onClick={onClear} disabled={!status.strokes} title="Erase everything on this question" aria-label="Erase everything on this question"><Trash2 size={16} /></button>
      </div>

      {onClose ? (
        <button type="button" className="annotation-close" onClick={onClose} title="Stop writing on the question (W)">Done</button>
      ) : null}
    </div>
  );
}

/**
 * A finished page, drawn once and never edited — the review screens showing what a candidate
 * actually wrote on a question they went on to get wrong.
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
      // The preview keeps the question's own aspect ratio, so nothing written near the foot
      // of the page is cropped out of the review.
      const height = Math.max(1, Math.round(width * (page.height || BOARD_WIDTH) / BOARD_WIDTH));
      const ratio = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(ratio, ratio);
      for (const stroke of page.strokes) paintStroke(context, stroke, width / BOARD_WIDTH);
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
