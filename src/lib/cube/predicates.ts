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

import { CORNERS, CubeState, EDGES, SOLVED_CUBE, equals } from "./state";
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
