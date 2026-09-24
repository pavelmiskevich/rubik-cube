/**
 * The last layer as a speedsolver looks at it: the top face from above and the
 * top row of each side.
 *
 * The beginner's lessons ask yes-or-no questions about the top — is there a
 * cross, is it one colour. The speed lessons have to *recognise* a case among
 * dozens, and recognition reads a picture: which stickers of the top colour
 * look up, where the rest of them look, which sides show matching corners
 * ("headlights") or a whole row of one colour ("a bar"). This module produces
 * that picture from a state, so a lesson's description and its diagram are
 * derived from the very position the lesson shows and cannot drift from it.
 *
 * Colours are named after the face whose centre carries them, as everywhere in
 * the engine: `"U"` is the top colour, white in the course.
 */

import { Corner, CubeState, Edge } from "./state";
import type { Face } from "./moves";
import { cornerColour, edgeColour } from "./predicates";
import type { Side } from "./frames";

/** Sides of the last layer, going round clockwise as seen from above. */
export const LAST_LAYER_SIDES: readonly Side[] = ["F", "R", "B", "L"];

/**
 * A side's top row, left to right for someone facing that side: the corner on
 * their left, the edge, the corner on their right.
 */
const SIDE_ROW: Readonly<Record<Side, readonly [Corner, Edge, Corner]>> = {
  F: ["UFL", "UF", "URF"],
  R: ["URF", "UR", "UBR"],
  B: ["UBR", "UB", "ULB"],
  L: ["ULB", "UL", "UFL"],
};

/** The top seen from above with the back side away from you: back row first. */
const TOP_ROWS: readonly (readonly (Corner | Edge | "U")[])[] = [
  ["ULB", "UB", "UBR"],
  ["UL", "U", "UR"],
  ["UFL", "UF", "URF"],
];

const TOP_EDGE: Readonly<Record<Side, Edge>> = { F: "UF", R: "UR", B: "UB", L: "UL" };
const TOP_CORNERS: readonly Corner[] = ["URF", "UFL", "ULB", "UBR"];

export interface LastLayerView {
  /** Top face from above: rows from the back to the front, each left to right. */
  top: Face[][];
  /** Each side's top row, left to right for someone facing that side. */
  sides: Record<Side, [Face, Face, Face]>;
}

const colourOnTop = (state: CubeState, slot: Corner | Edge | "U"): Face => {
  if (slot === "U") return "U";
  return slot.length === 3
    ? cornerColour(state, slot as Corner, "U")
    : edgeColour(state, slot as Edge, "U");
};

export function lastLayerView(state: CubeState): LastLayerView {
  const sides = {} as Record<Side, [Face, Face, Face]>;
  LAST_LAYER_SIDES.forEach((side) => {
    const [left, edge, right] = SIDE_ROW[side];
    sides[side] = [
      cornerColour(state, left, side),
      edgeColour(state, edge, side),
      cornerColour(state, right, side),
    ];
  });

  return {
    top: TOP_ROWS.map((row) => row.map((slot) => colourOnTop(state, slot))),
    sides,
  };
}

/** Sides whose top edge shows the top colour upwards, in `LAST_LAYER_SIDES` order. */
export function edgesUp(state: CubeState): Side[] {
  return LAST_LAYER_SIDES.filter((side) => edgeColour(state, TOP_EDGE[side], "U") === "U");
}

/** Top corners showing the top colour upwards: URF, UFL, ULB, UBR order. */
export function cornersUp(state: CubeState): Corner[] {
  return TOP_CORNERS.filter((slot) => cornerColour(state, slot, "U") === "U");
}

/**
 * For a top corner, the side its top-colour sticker faces, or `"U"` when it
 * looks up.
 */
export function topColourFacing(state: CubeState, slot: Corner): Face {
  return (["U", ...slot.slice(1)] as Face[]).find(
    (face) => cornerColour(state, slot, face) === "U"
  )!;
}

/** Sides whose two top corners match: the "headlights" of the lessons. */
export function headlights(view: LastLayerView): Side[] {
  return LAST_LAYER_SIDES.filter((side) => view.sides[side][0] === view.sides[side][2]);
}

/** Sides whose whole top row is one colour. */
export function bars(view: LastLayerView): Side[] {
  return LAST_LAYER_SIDES.filter((side) => {
    const [left, middle, right] = view.sides[side];
    return left === middle && middle === right;
  });
}
