/**
 * Turning the whole cube in your hands, as a renaming of faces.
 *
 * The course writes every algorithm from one position: a first-layer corner is
 * placed with `R U R' U'` *when that corner sits front-right*, a middle-layer
 * edge goes in with `U R U' R' U' F' U F` *when its stripe faces you*. In the
 * lessons "turn the cube in your hands" lives in the words and nowhere else,
 * because the engine has no whole-cube rotations on purpose — `x`, `y` and `z`
 * are rejected when parsing notation, and adding them would mean teaching the
 * state model about a cube that is held differently from one move to the next.
 *
 * So a hand turn is expressed here the only way it can be: as a renaming. The
 * cube is never rotated; the algorithm is. Holding the cube with the right-hand
 * side towards you and doing `R U R' U'` moves exactly the same stickers as
 * holding it normally and doing `B U B' U'`, so that is what this module
 * returns. Only turns around the vertical axis are covered, which is all the
 * course needs: U stays up and D stays down in every lesson, and the beginner
 * never flips the cube over.
 *
 * Everything here is a pure function of notation and slot names — no state is
 * transformed, nothing is mutated — so the caller can keep thinking in the
 * words of the lesson ("the corner front-right") while the engine keeps
 * thinking in the fixed slots of `state.ts`.
 */

import { CORNERS, Corner, CubeState, EDGES, Edge } from "./state";
import { Face, formatSequence, parseSequence } from "./moves";
import { cornerColour, edgeColour } from "./predicates";

/** The four sides a beginner can turn towards themselves. */
export type Side = "F" | "R" | "B" | "L";

export const SIDES: readonly Side[] = ["F", "R", "B", "L"];

/**
 * The cube is held so that `front` faces the solver: which real face hides
 * behind each name. Reading `FRAMES.R.F === "R"`: with the right-hand side
 * turned towards you, what you now call "front" is really the R face.
 */
export const FRAMES: Readonly<Record<Side, Readonly<Record<Face, Face>>>> = {
  F: { U: "U", D: "D", F: "F", R: "R", B: "B", L: "L" },
  R: { U: "U", D: "D", F: "R", R: "B", B: "L", L: "F" },
  B: { U: "U", D: "D", F: "B", R: "L", B: "F", L: "R" },
  L: { U: "U", D: "D", F: "L", R: "F", B: "R", L: "B" },
};

/** The name a real face goes by in this frame — `FRAMES[front]` read backwards. */
export function frameFace(real: Face, front: Side): Face {
  return (Object.keys(FRAMES[front]) as Face[]).find((name) => FRAMES[front][name] === real)!;
}

/** The same algorithm, written for a cube held with `front` towards the solver. */
export function inFrame(algorithm: string, front: Side): string {
  return formatSequence(
    parseSequence(algorithm).map((move) => ({ face: FRAMES[front][move.face], turn: move.turn }))
  );
}

/**
 * Slot names are the faces a slot touches, so renaming a slot is renaming its
 * letters; the order of the letters is fixed by `state.ts`, hence the lookup by
 * the set of letters rather than by the string.
 */
const sameLetters = (a: string, b: string): boolean =>
  a.length === b.length && [...a].every((letter) => b.includes(letter));

const rename = <T extends string>(slot: string, front: Side, names: readonly T[]): T => {
  const letters = [...slot].map((face) => FRAMES[front][face as Face]).join("");
  return names.find((name) => sameLetters(name, letters))!;
};

/** The real slot behind a slot named in this frame: `realEdge("UF", "R")` is `UR`. */
export function realEdge(slot: Edge, front: Side): Edge {
  return rename(slot, front, EDGES);
}

export function realCorner(slot: Corner, front: Side): Corner {
  return rename(slot, front, CORNERS);
}

/** The name a real slot goes by in this frame — `realEdge` read backwards. */
export function frameEdge(real: Edge, front: Side): Edge {
  return EDGES.find((name) => realEdge(name, front) === real)!;
}

export function frameCorner(real: Corner, front: Side): Corner {
  return CORNERS.find((name) => realCorner(name, front) === real)!;
}

/**
 * The colour seen on face `face` of edge slot `slot`, with slot, face and the
 * answer all named in the frame.
 *
 * A colour is named after the face whose centre carries it, and the centres
 * turn with the cube, so the answer has to be renamed too: the colour a solver
 * holding the cube sideways calls "the front colour" is the real R colour.
 */
export function edgeSeen(state: CubeState, front: Side, slot: Edge, face: Face): Face {
  return frameFace(edgeColour(state, realEdge(slot, front), FRAMES[front][face]), front);
}

/** Which colour shows on face `face` of a corner slot. See `edgeSeen`. */
export function cornerSeen(state: CubeState, front: Side, slot: Corner, face: Face): Face {
  return frameFace(cornerColour(state, realCorner(slot, front), FRAMES[front][face]), front);
}
