/**
 * The questions a lesson step asks about a cube: is the cross done, is the
 * first layer done, is the cube solved.
 *
 * This is the vocabulary of the course. A step is complete when its predicate
 * turns true, so lessons — and later the layer-by-layer solver — ask here
 * instead of reading permutation arrays themselves. The file grows as the
 * course grows; the arithmetic of turns stays in `moves.ts`.
 *
 * ## Why a face parameter instead of a fixed orientation
 *
 * A beginner holds the cube however it ended up in their hand, so "the white
 * cross" is really "the cross on whichever face is down". The engine has no
 * whole-cube rotations on purpose — `x`, `y` and `z` are rejected when parsing
 * notation — so a step says which face it is talking about instead:
 * `isCrossSolved(state, "D")`. Teaching the model to rotate the whole cube
 * just to answer this would be a far larger change for nothing gained.
 *
 * `isSolved` takes no face: a solved cube is solved from every side.
 *
 * ## What "solved" means for a single piece
 *
 * Centres never move relative to one another and are not part of the state, so
 * a piece that sits in its own slot with orientation 0 also has every sticker
 * matching the centre beside it. Each predicate is therefore a question about
 * a handful of slots — and orientation is half of that question. A corner in
 * its own slot but twisted is the beginner's most common mistake and must read
 * as unsolved; a model that only remembered positions could not say so.
 */

import { CORNERS, Corner, CubeState, EDGES, Edge, SOLVED_CUBE, equals } from "./state";
import { FACES, Face } from "./moves";

/** Opposite faces. A face and its opposite bound the slice between them. */
const OPPOSITE: Readonly<Record<Face, Face>> = Object.freeze({
  U: "D",
  D: "U",
  L: "R",
  R: "L",
  F: "B",
  B: "F",
});

const byFace = <T>(build: (face: Face) => T): Readonly<Record<Face, T>> => {
  const table = {} as Record<Face, T>;
  FACES.forEach((face) => {
    table[face] = build(face);
  });
  return Object.freeze(table);
};

/**
 * Slots whose piece name passes `keep`.
 *
 * Membership is read off the names rather than tabulated by hand: a piece is
 * named after the faces it touches, so `UR` belongs to U and to R and to
 * nothing else. One fact, stated once, in `state.ts`.
 */
const slotsWhere = (names: readonly string[], keep: (name: string) => boolean): readonly number[] =>
  Object.freeze(names.flatMap((name, slot) => (keep(name) ? [slot] : [])));

/** The four edges of a face: D gives DR DF DL DB. */
const CROSS_EDGES = byFace((face) => slotsWhere(EDGES, (name) => name.includes(face)));

/** The four corners of a face: D gives DFR DLF DBL DRB. */
const LAYER_CORNERS = byFace((face) => slotsWhere(CORNERS, (name) => name.includes(face)));

/**
 * The four edges of the slice between a face and its opposite — the "second
 * layer" of the beginner's method. D (and U) give FR FL BL BR.
 */
const MIDDLE_EDGES = byFace((face) =>
  slotsWhere(EDGES, (name) => !name.includes(face) && !name.includes(OPPOSITE[face]))
);

const cornerAtHome = (state: CubeState, slot: number): boolean =>
  state.cornerPermutation[slot] === slot && state.cornerOrientation[slot] === 0;

const edgeAtHome = (state: CubeState, slot: number): boolean =>
  state.edgePermutation[slot] === slot && state.edgeOrientation[slot] === 0;

/**
 * Which colour shows on `face` at an edge slot.
 *
 * A colour is named by the face whose centre carries it, so `"U"` is "the
 * colour of the top centre". The last layer needs this: the beginner's cross
 * and one-coloured top care about what is visible on a face, not about which
 * piece sits where.
 *
 * The arithmetic rests on the naming in `state.ts`. A piece's name lists its
 * stickers and a slot's name lists its faces in matching order, so with
 * orientation 0 the n-th sticker of the piece lies on the n-th face of the
 * slot, and every twist shifts that by one.
 */
export function edgeColour(state: CubeState, slot: Edge, face: Face): Face {
  const position = EDGES.indexOf(slot);
  const facelet = slot.indexOf(face);
  if (facelet < 0) throw new Error(`Ребро ${slot} не касается грани ${face}`);
  const piece = EDGES[state.edgePermutation[position]];
  return piece[(facelet + state.edgeOrientation[position]) % 2] as Face;
}

/** Which colour shows on `face` at a corner slot. See `edgeColour`. */
export function cornerColour(state: CubeState, slot: Corner, face: Face): Face {
  const position = CORNERS.indexOf(slot);
  const facelet = slot.indexOf(face);
  if (facelet < 0) throw new Error(`Угол ${slot} не касается грани ${face}`);
  const piece = CORNERS[state.cornerPermutation[position]];
  return piece[(facelet - state.cornerOrientation[position] + 3) % 3] as Face;
}

/** Every piece home, nothing twisted. */
export function isSolved(state: CubeState): boolean {
  return equals(state, SOLVED_CUBE);
}

/** The four edges of `face` are home and the right way up. */
export function isCrossSolved(state: CubeState, face: Face): boolean {
  return CROSS_EDGES[face].every((slot) => edgeAtHome(state, slot));
}

/** The cross of `face`, plus its four corners home and untwisted. */
export function isFirstLayerSolved(state: CubeState, face: Face): boolean {
  return (
    isCrossSolved(state, face) && LAYER_CORNERS[face].every((slot) => cornerAtHome(state, slot))
  );
}

/** The first layer of `face`, plus the slice sitting on top of it. */
export function areTwoLayersSolved(state: CubeState, face: Face): boolean {
  return (
    isFirstLayerSolved(state, face) && MIDDLE_EDGES[face].every((slot) => edgeAtHome(state, slot))
  );
}

/*
 * The last layer.
 *
 * The beginner's method finishes the top in four moves of attention, and each
 * of them looks at the top face rather than at the pieces: a cross of the top
 * colour, then the whole top one colour, then the corners home, then
 * everything. The colours on the sides do not matter until the very end, so
 * the first two questions read stickers, not slots.
 *
 * `face` is the last layer itself — U in the course. Every last-layer step also
 * demands that the two layers under it still stand: an algorithm that makes a
 * pretty top by wrecking the bottom has taught nothing.
 */

const cornersOf = (face: Face): readonly Corner[] => CORNERS.filter((name) => name.includes(face));
const edgesOf = (face: Face): readonly Edge[] => EDGES.filter((name) => name.includes(face));

/**
 * The four edges around `face` show its colour on it — a cross, whether or
 * not their other sides match the centres yet. Compare `isCrossSolved`, which
 * wants them home.
 */
export function isCrossFormed(state: CubeState, face: Face): boolean {
  return edgesOf(face).every((slot) => edgeColour(state, slot, face) === face);
}

/** All nine stickers of `face` are its colour. */
export function isFaceOneColour(state: CubeState, face: Face): boolean {
  return (
    isCrossFormed(state, face) &&
    cornersOf(face).every((slot) => cornerColour(state, slot, face) === face)
  );
}

/** Two layers under `face` stand and `face` shows a cross of its colour. */
export function isLastLayerCrossFormed(state: CubeState, face: Face): boolean {
  return areTwoLayersSolved(state, OPPOSITE[face]) && isCrossFormed(state, face);
}

/** Two layers under `face` stand and `face` is one colour. */
export function isLastLayerOriented(state: CubeState, face: Face): boolean {
  return areTwoLayersSolved(state, OPPOSITE[face]) && isFaceOneColour(state, face);
}

/**
 * The last layer is one colour and its corners are home; only its edges may
 * still be out of place.
 */
export function areLastLayerCornersPlaced(state: CubeState, face: Face): boolean {
  return (
    isLastLayerOriented(state, face) && LAYER_CORNERS[face].every((slot) => cornerAtHome(state, slot))
  );
}
