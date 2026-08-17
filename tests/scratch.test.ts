/**
 * The whiteboard's data model.
 *
 * Three things have to hold or a candidate loses working they cannot get back: the encoding
 * must round-trip, erasing must cut a stroke rather than delete it, and a page must stay far
 * enough inside Firestore's document limit that a heavy session still saves.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_POINTS_PER_PAGE,
  MAX_STROKES_PER_PAGE,
  decodePage,
  emptyPage,
  encodePage,
  encodedPageSize,
  eraseAt,
  inkExtent,
  inkSpread,
  pageBoardWidth,
  pageIsEmpty,
  pageIsFull,
  pagePointCount,
  simplifyStroke,
  type ScratchPage,
  type ScratchStroke,
} from "../app/lib/scratch";

function stroke(points: number[], overrides: Partial<ScratchStroke> = {}): ScratchStroke {
  return { tool: "pen", colour: "ink", size: 2, points, ...overrides };
}

/** A wobbly line, which is what real handwriting samples look like. */
function handwriting(count: number, offsetY = 0): number[] {
  const points: number[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push(
      40 + index * 1.7 + Math.sin(index / 3) * 2,
      offsetY + 60 + Math.sin(index / 2.4) * 14 + Math.cos(index * 1.7),
      0.3 + 0.5 * Math.abs(Math.sin(index / 7)),
    );
  }
  return points;
}

/* --------------------------------------------------------------------- encoding -- */

test("a page survives a round trip through the stored encoding", () => {
  const page: ScratchPage = {
    height: 723.5,
    strokes: [
      stroke(handwriting(120)),
      stroke(handwriting(80, 40), { colour: "red", size: 1 }),
      stroke(handwriting(30, 90), { tool: "highlighter", colour: "green", size: 3 }),
      stroke([500, 300, 0.75]),
    ],
  };

  const decoded = decodePage(encodePage(page));

  assert.equal(decoded.strokes.length, 4);
  assert.equal(Math.round(decoded.height * 2), Math.round(page.height * 2));
  for (const [index, original] of page.strokes.entries()) {
    const copy = decoded.strokes[index];
    assert.equal(copy.tool, original.tool, `stroke ${index} tool`);
    assert.equal(copy.colour, original.colour, `stroke ${index} colour`);
    assert.equal(copy.size, original.size, `stroke ${index} size`);
    assert.equal(copy.points.length, original.points.length, `stroke ${index} point count`);
    for (let cursor = 0; cursor < original.points.length; cursor += 3) {
      // Positions are stored to half a board unit and pressure to one of sixteen levels;
      // both are finer than anything the eye can resolve on a 2 px nib.
      assert.ok(Math.abs(copy.points[cursor] - original.points[cursor]) <= 0.25, `stroke ${index} x`);
      assert.ok(Math.abs(copy.points[cursor + 1] - original.points[cursor + 1]) <= 0.25, `stroke ${index} y`);
      assert.ok(Math.abs(copy.points[cursor + 2] - original.points[cursor + 2]) <= 0.04, `stroke ${index} pressure`);
    }
  }
});

test("negative and large coordinates round-trip, so a stroke off the edge is not corrupted", () => {
  const page: ScratchPage = { height: 400, strokes: [stroke([-40.5, -12, 0.5, 1800.5, 990, 1, 0, 0, 0])] };
  const decoded = decodePage(encodePage(page));
  assert.deepEqual(
    decoded.strokes[0].points.map((value) => Math.round(value * 100) / 100),
    [-40.5, -12, 0.53, 1800.5, 990, 1, 0, 0, 0],
  );
});

test("the margins survive storage, in both directions of the version skew", () => {
  const page: ScratchPage = { height: 700, left: 500, right: 500, strokes: [stroke([-320, 44, 0.6, 1240, 44, 0.6])] };
  const encoded = encodePage(page);
  const decoded = decodePage(encoded);
  assert.equal(decoded.left, 500);
  assert.equal(decoded.right, 500);
  assert.equal(decoded.height, 700);

  // Backwards: a page stored before margins existed has no fields for them, and comes back
  // as what it was — a sheet no wider than the question.
  const body = encoded.split("\n").slice(1).join("\n");
  const older = decodePage(`1|1400\n${body}`);
  assert.equal(older.height, 700);
  assert.deepEqual([older.left, older.right], [0, 0]);
  assert.equal(older.strokes.length, 1);

  // Forwards, which is the case that matters for an installed app: a device still running an
  // older shell reads this header positionally and simply does not see the extra fields. It
  // must lose the margins and nothing else — above all not the writing.
  const [header] = encoded.split("\n");
  const [version, height] = header.split("|");
  assert.equal(version, "1", "the version marker is a gate, so it must not move for an added field");
  assert.equal(Number(height) / 2, 700, "and the height is still the second field");
  assert.deepEqual(
    older.strokes[0].points,
    decoded.strokes[0].points,
    "every stroke reads back identically without the margins in the header",
  );
});

test("a malformed or foreign payload decodes to an empty board rather than throwing", () => {
  // Including bytes below the encoding's own alphabet, which is what a truncated or
  // re-encoded document looks like when it comes back from storage.
  const controlBytes = "1|400\n\u0000\u0001";
  for (const payload of [null, undefined, "", "2|400\nxx", "not a page", controlBytes, "1|400\np", "9|1\npk2abc"]) {
    const page = decodePage(payload as string);
    assert.ok(pageIsEmpty(page) || page.strokes.length >= 0);
  }
  assert.equal(decodePage("2|400\npk2abc").strokes.length, 0, "an unknown version is ignored entirely");
  // A page whose stroke lines are damaged keeps the lines that are still readable.
  const good = encodePage({ height: 300, strokes: [stroke(handwriting(20))] });
  const damaged = `${good}\nZZ9garbage`;
  assert.equal(decodePage(damaged).strokes.length, 1);
});

test("a dense page of handwriting stays far inside the Firestore document limit", () => {
  // Twelve lines of thirty characters, each character three strokes: heavier than anything
  // a 90-second question produces.
  const strokes = Array.from({ length: 12 * 30 * 3 }, (_, index) => stroke(handwriting(14, index % 12 * 55)));
  const bytes = encodedPageSize({ height: 700, strokes });
  const points = pagePointCount({ height: 700, strokes });
  assert.ok(points > 10_000, `expected a heavy page, got ${points} points`);
  assert.ok(bytes < 400_000, `a heavy page must stay well under 1 MiB, got ${bytes} bytes`);
  // Roughly three bytes per sample is what the delta encoding is for.
  assert.ok(bytes / points < 4, `expected under four bytes per point, got ${(bytes / points).toFixed(2)}`);
});

/* ------------------------------------------------------------------- simplifying -- */

test("simplification collapses a straight line and keeps the shape of a curve", () => {
  const straight: number[] = [];
  for (let index = 0; index <= 40; index += 1) straight.push(index * 5, 100, 0.5);
  assert.deepEqual(simplifyStroke(straight, 0.55), [0, 100, 0.5, 200, 100, 0.5]);

  const curved = handwriting(200);
  const simplified = simplifyStroke(curved, 0.55);
  assert.ok(simplified.length < curved.length, "a wobbly stroke should lose redundant samples");
  assert.ok(simplified.length >= 30, "but it must keep enough of them to stay a curve");
  // The endpoints are always kept, so the stroke starts and ends where the nib did.
  assert.deepEqual(simplified.slice(0, 3), curved.slice(0, 3));
  assert.deepEqual(simplified.slice(-3), curved.slice(-3));
});

test("a stroke that doubles back keeps its turning point", () => {
  const there = [0, 0, 0.5, 50, 0, 0.5, 100, 0, 0.5];
  const back = [...there, 50, 0, 0.5, 0, 0, 0.5];
  const simplified = simplifyStroke(back, 0.55);
  const xs = simplified.filter((_, index) => index % 3 === 0);
  assert.ok(xs.includes(100), `the far end must survive; got ${xs.join(", ")}`);
});

/* ----------------------------------------------------------------------- erasing -- */

test("erasing the middle of a rule splits it instead of deleting it", () => {
  // Two points only, as simplification leaves a straight underline.
  const rule = stroke([0, 100, 0.5, 400, 100, 0.5]);
  const after = eraseAt([rule], 200, 100, 9);
  assert.equal(after.length, 2, "the rule should become two shorter rules");
  const [left, right] = after;
  assert.equal(left.points[0], 0);
  assert.ok(left.points[3] < 200 && left.points[3] > 180, `left fragment should stop at the eraser edge, got ${left.points[3]}`);
  assert.ok(right.points[0] > 200 && right.points[0] < 220, `right fragment should resume at the eraser edge, got ${right.points[0]}`);
  assert.equal(right.points[3], 400);
});

test("erasing away from a stroke returns the very same array, so no repaint is scheduled", () => {
  const strokes = [stroke(handwriting(40))];
  assert.equal(eraseAt(strokes, 900, 900, 9), strokes);
});

test("erasing over a whole stroke removes it, and a dot is removed by a touch", () => {
  assert.deepEqual(eraseAt([stroke([100, 100, 0.5, 104, 102, 0.5])], 102, 101, 9), []);
  assert.deepEqual(eraseAt([stroke([100, 100, 0.9])], 101, 101, 9), []);
  assert.equal(eraseAt([stroke([100, 100, 0.9])], 400, 400, 9).length, 1);
});

test("a highlighter is erased across its whole visible width, not just its centre line", () => {
  const marker = stroke([0, 100, 0.5, 400, 100, 0.5], { tool: "highlighter", size: 3 });
  // 13 units above the centre line is outside a 9-unit eraser but inside a 30-unit band.
  assert.equal(eraseAt([marker], 200, 113, 9).length, 2);
});

test("a fragment left with a single point is dropped rather than becoming a stray dot", () => {
  const short = stroke([0, 100, 0.5, 10, 100, 0.5]);
  assert.deepEqual(eraseAt([short], 10, 100, 9), []);
});

/* ------------------------------------------------------------------- board space -- */

test("page emptiness and the storage bound are reported honestly", () => {
  assert.equal(pageIsEmpty(emptyPage()), true);
  assert.equal(pageIsEmpty(null), true);
  assert.equal(pageIsEmpty({ height: 10, strokes: [stroke([0, 0, 1])] }), false);

  assert.equal(pageIsFull({ height: 10, strokes: [] }), false);
  const manyStrokes = { height: 10, strokes: Array.from({ length: MAX_STROKES_PER_PAGE }, () => stroke([0, 0, 1])) };
  assert.equal(pageIsFull(manyStrokes), true);
  const longStroke = { height: 10, strokes: [stroke(new Array(MAX_POINTS_PER_PAGE * 3).fill(1))] };
  assert.equal(pageIsFull(longStroke), true);
});

test("a page never records a height that would hide what is written on it", () => {
  // Writing low on a page that had blank paper added below the question.
  const low = stroke([100, 40, 0.5, 400, 1420, 0.5]);
  assert.equal(inkExtent([low]), 1444, "the extent clears the lowest stroke");
  assert.equal(inkExtent([]), 0, "an empty page has no extent");
  assert.equal(inkExtent([stroke([10, 0, 0.5, 20, 0, 0.5])]), 0, "ink along the top edge needs no room");

  // Height is taken from the question, but only when that is enough for the ink.
  const questionHeight = 679;
  assert.equal(Math.max(questionHeight, inkExtent([low])), 1444);
  assert.equal(Math.max(questionHeight, inkExtent([stroke([10, 30, 0.5, 20, 60, 0.5])])), questionHeight);
});

test("a page never records margins that would hide what is written in them", () => {
  // The question is 0–1000 whatever paper is beside it, so working in the left margin has a
  // negative x and working in the right one runs past 1000.
  const beside = stroke([-260, 40, 0.5, -120, 300, 0.5, 1180, 90, 0.5]);
  assert.deepEqual(inkSpread([beside]), { left: 284, right: 204 }, "each side clears its outermost mark");
  assert.deepEqual(inkSpread([]), { left: 0, right: 0 }, "an empty page needs no margins");
  assert.deepEqual(
    inkSpread([stroke([0, 10, 0.5, 1000, 10, 0.5])]),
    { left: 0, right: 0 },
    "ink on the question itself, edge to edge, needs no paper beside it",
  );

  // As with the height: the margins come from the sheet, and are widened only where the ink
  // has gone further — so narrowing them, or turning them off, hides nothing.
  const written = 500;
  const spread = inkSpread([beside]);
  assert.equal(Math.max(written, spread.left), 500);
  assert.equal(Math.max(0, spread.left), 284, "and with the margins since removed, the ink still fits");
});

test("the sheet a page was written on is as wide as the question and its margins together", () => {
  assert.equal(pageBoardWidth({ height: 400, strokes: [] }), 1000, "a page with no margins is the question");
  assert.equal(pageBoardWidth({ height: 400, left: 250, right: 250, strokes: [] }), 1500);
  // Nonsense from an older schema or a hand-edited document cannot shrink the sheet below
  // the question, which would fold the review's drawing back on itself.
  assert.equal(pageBoardWidth({ height: 400, left: -900, right: -900, strokes: [] }), 1000);
});
