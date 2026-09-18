/**
 * Cubie-level state of a 3x3x3 cube.
 *
 * A cube is 8 corners and 12 edges. Each of them has a place (which slot it
 * currently sits in) and an orientation (how it is rotated inside that slot).
 * Centres never move relative to one another, so they carry no information and
 * are deliberately absent from the state: what a solver or a lesson needs to
 * know is where the corners and edges are, not where the centres are.
 *
 * Tracking orientation separately from position is the whole point of this
 * model. A corner sitting in its own slot but twisted is *not* solved, and that
 * is the single most common beginner mistake — a model that only remembered
 * positions could not tell the two apart.
 *
 * ## The conventions fixed here
 *
 * Predicates, lesson content and the bridge to the 3D view all read these
 * arrays, so the orders below are part of the contract and must not be
 * reshuffled.
 *
 * The cube is held with the U face up and the F face towards the viewer:
 *
 *     U up, D down, L left, R right, F front, B back
 *
 * A piece is named after the faces it touches, so the corner where U, R and F
 * meet is `URF` and the edge between U and R is `UR`.
 *
 * Corner slots, in index order:
 *
 *     0 URF   1 UFL   2 ULB   3 UBR   4 DFR   5 DLF   6 DBL   7 DRB
 *
 * Edge slots, in index order:
 *
 *      0 UR    1 UF    2 UL    3 UB    4 DR    5 DF    6 DL    7 DB
 *      8 FR    9 FL   10 BL   11 BR
 *
 * `cornerPermutation[slot]` is the corner that *currently sits in* that slot,
 * not the slot that corner went to; edges work the same way. On a solved cube
 * both arrays are the identity.
 *
 * `cornerOrientation[slot]` counts, modulo 3, how many clockwise twists (seen
 * from outside the cube) separate the corner's U-or-D sticker from the U or D
 * face. 0 therefore means "its up/down sticker points up or down".
 *
 * `edgeOrientation[slot]` is 0 or 1, 1 meaning flipped. With this convention
 * only quarter turns of F and B flip edges; U, D, R, L and every half turn
 * leave every edge orientation alone.
 */

export const CORNERS = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"] as const;
export const EDGES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"] as const;

export type Corner = (typeof CORNERS)[number];
export type Edge = (typeof EDGES)[number];

export const CORNER_COUNT = CORNERS.length;
export const EDGE_COUNT = EDGES.length;

/** Twists of a corner are counted modulo 3, flips of an edge modulo 2. */
export const CORNER_ORIENTATIONS = 3;
export const EDGE_ORIENTATIONS = 2;

const indexByName = <T extends string>(names: readonly T[]): Readonly<Record<T, number>> => {
  const index = {} as Record<T, number>;
  names.forEach((name, position) => {
    index[name] = position;
  });
  return Object.freeze(index);
};

/** `CORNER_INDEX.URF === 0` — lets callers name a slot instead of hard-coding its number. */
export const CORNER_INDEX = indexByName(CORNERS);
export const EDGE_INDEX = indexByName(EDGES);

export interface CubeState {
  readonly cornerPermutation: readonly number[];
  readonly cornerOrientation: readonly number[];
  readonly edgePermutation: readonly number[];
  readonly edgeOrientation: readonly number[];
}

const identity = (length: number): readonly number[] =>
  Object.freeze(Array.from({ length }, (_, index) => index));

const zeros = (length: number): readonly number[] => Object.freeze(new Array<number>(length).fill(0));

/**
 * The solved cube: every piece home, nothing twisted.
 *
 * Frozen on purpose. It is the starting point of every lesson and every test,
 * and a single accidental write to it would silently corrupt all of them.
 */
export const SOLVED_CUBE: CubeState = Object.freeze({
  cornerPermutation: identity(CORNER_COUNT),
  cornerOrientation: zeros(CORNER_COUNT),
  edgePermutation: identity(EDGE_COUNT),
  edgeOrientation: zeros(EDGE_COUNT),
});

const sameNumbers = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Two states are equal when every piece sits in the same slot with the same orientation. */
export function equals(a: CubeState, b: CubeState): boolean {
  return (
    sameNumbers(a.cornerPermutation, b.cornerPermutation) &&
    sameNumbers(a.cornerOrientation, b.cornerOrientation) &&
    sameNumbers(a.edgePermutation, b.edgePermutation) &&
    sameNumbers(a.edgeOrientation, b.edgeOrientation)
  );
}
