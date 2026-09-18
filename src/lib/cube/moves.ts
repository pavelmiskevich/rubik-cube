/**
 * Face turns: parsing notation, applying turns to a state, inverting sequences.
 *
 * The engine understands the 18 basic turns — six faces, each a quarter turn
 * clockwise, a quarter turn counter-clockwise (`'`) or a half turn (`2`).
 * Slice turns (`M`, `E`, `S`), wide turns (`r`, `u`, ...) and whole-cube
 * rotations (`x`, `y`, `z`) are out of scope: the beginner's method the course
 * teaches is written entirely in face turns.
 *
 * Clockwise always means "seen from outside that face", the way a solver
 * standing in front of the cube reads it.
 */

import {
  CORNER_COUNT,
  CORNER_ORIENTATIONS,
  CubeState,
  EDGE_COUNT,
  EDGE_ORIENTATIONS,
  SOLVED_CUBE,
} from "./state";

export const FACES = ["U", "D", "L", "R", "F", "B"] as const;

export type Face = (typeof FACES)[number];

/** Quarter turns clockwise: 1 is `R`, 2 is `R2`, 3 is `R'`. */
export type Turn = 1 | 2 | 3;

export interface Move {
  readonly face: Face;
  readonly turn: Turn;
}

const TURNS: readonly Turn[] = [1, 2, 3];

/** Notation suffix per turn count; the index is the turn. */
const TURN_SUFFIX: Readonly<Record<Turn, string>> = { 1: "", 2: "2", 3: "'" };

const FACE_LIST = FACES.join(", ");

/**
 * Where each face turn sends every piece, as the state a single clockwise
 * quarter turn produces from the solved cube.
 *
 * A move and a state are the same kind of object — "which piece ends up in
 * which slot, turned how much" — so the tables below are literally states, and
 * applying a move is composing two of them. Half turns and counter-clockwise
 * turns are not tabulated: they are this table applied two or three times,
 * which is cheap and leaves one place per face where a typo could hide.
 *
 * Slot orders are the ones fixed in `state.ts`.
 */
const QUARTER_TURN: Readonly<Record<Face, CubeState>> = {
  U: {
    cornerPermutation: [3, 0, 1, 2, 4, 5, 6, 7],
    cornerOrientation: [0, 0, 0, 0, 0, 0, 0, 0],
    edgePermutation: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    edgeOrientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  D: {
    cornerPermutation: [0, 1, 2, 3, 5, 6, 7, 4],
    cornerOrientation: [0, 0, 0, 0, 0, 0, 0, 0],
    edgePermutation: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    edgeOrientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  L: {
    cornerPermutation: [0, 2, 6, 3, 4, 1, 5, 7],
    cornerOrientation: [0, 1, 2, 0, 0, 2, 1, 0],
    edgePermutation: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    edgeOrientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  R: {
    cornerPermutation: [4, 1, 2, 0, 7, 5, 6, 3],
    cornerOrientation: [2, 0, 0, 1, 1, 0, 0, 2],
    edgePermutation: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    edgeOrientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  F: {
    cornerPermutation: [1, 5, 2, 3, 0, 4, 6, 7],
    cornerOrientation: [1, 2, 0, 0, 2, 1, 0, 0],
    edgePermutation: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    edgeOrientation: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  B: {
    cornerPermutation: [0, 1, 3, 7, 4, 5, 2, 6],
    cornerOrientation: [0, 0, 1, 2, 0, 0, 2, 1],
    edgePermutation: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    edgeOrientation: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
};

/** Every basic turn, face by face: `U U2 U' D D2 D' ...`. */
export const MOVES: readonly Move[] = Object.freeze(
  FACES.flatMap((face) => TURNS.map((turn) => Object.freeze({ face, turn })))
);

export function formatMove(move: Move): string {
  return move.face + TURN_SUFFIX[move.turn];
}

export function formatSequence(moves: readonly Move[]): string {
  return moves.map(formatMove).join(" ");
}

const SLICE_AND_ROTATION = new Set(["M", "E", "S", "x", "y", "z"]);

const isFace = (value: string): value is Face => (FACES as readonly string[]).includes(value);

function rejectToken(token: string, position: number | null, reason: string): never {
  const where = position === null ? `"${token}"` : `"${token}" (ход ${position + 1})`;
  throw new Error(`Не удалось разобрать ход ${where}: ${reason}`);
}

function parseToken(token: string, position: number | null): Move {
  const head = token.slice(0, 1);
  const suffix = token.slice(1);

  if (!isFace(head)) {
    // Wide turns are lowercase face letters, so they land here too.
    if (SLICE_AND_ROTATION.has(token) || SLICE_AND_ROTATION.has(head) || isFace(head.toUpperCase())) {
      rejectToken(
        token,
        position,
        `повороты срезов и всего куба не поддерживаются, движок понимает только грани ${FACE_LIST}`
      );
    }
    rejectToken(token, position, `неизвестная грань "${head}", ожидалась одна из ${FACE_LIST}`);
  }

  if (suffix === "") return { face: head, turn: 1 };
  if (suffix === "2") return { face: head, turn: 2 };
  if (suffix === "'" || suffix === "’") return { face: head, turn: 3 };

  rejectToken(
    token,
    position,
    `неизвестный модификатор "${suffix}", ожидался "'", "2" или пустой`
  );
}

/** Parses a single token such as `R`, `R'` or `R2`. Throws on anything else. */
export function parseMove(token: string): Move {
  return parseToken(token.trim(), null);
}

/**
 * Parses a whole sequence: `"R U R' F2"`. Any amount of whitespace separates
 * the moves, and an empty string is an empty sequence — a lesson step may
 * legitimately have no setup moves.
 */
export function parseSequence(notation: string): Move[] {
  const tokens = notation.trim().split(/\s+/).filter((token) => token.length > 0);
  return tokens.map((token, position) => parseToken(token, position));
}

/** The turn that undoes this one; a half turn undoes itself. */
export function invertMove(move: Move): Move {
  return { face: move.face, turn: (4 - move.turn) as Turn };
}

/**
 * The sequence that undoes this one: every move inverted, in reverse order.
 *
 * This is what a lesson's "one step back" button needs — undoing the last turn
 * instead of replaying the whole solve from the start.
 */
export function invertSequence(moves: readonly Move[]): Move[] {
  return moves.map(invertMove).reverse();
}

/** `compose(first, second)` is the state left by doing `first`, then `second`. */
function compose(first: CubeState, second: CubeState): CubeState {
  const cornerPermutation: number[] = new Array<number>(CORNER_COUNT);
  const cornerOrientation: number[] = new Array<number>(CORNER_COUNT);

  for (let slot = 0; slot < CORNER_COUNT; slot++) {
    // `second` says which slot this one is fed from; `first` says what was there.
    const source = second.cornerPermutation[slot];
    cornerPermutation[slot] = first.cornerPermutation[source];
    cornerOrientation[slot] =
      (first.cornerOrientation[source] + second.cornerOrientation[slot]) % CORNER_ORIENTATIONS;
  }

  const edgePermutation: number[] = new Array<number>(EDGE_COUNT);
  const edgeOrientation: number[] = new Array<number>(EDGE_COUNT);

  for (let slot = 0; slot < EDGE_COUNT; slot++) {
    const source = second.edgePermutation[slot];
    edgePermutation[slot] = first.edgePermutation[source];
    edgeOrientation[slot] =
      (first.edgeOrientation[source] + second.edgeOrientation[slot]) % EDGE_ORIENTATIONS;
  }

  return { cornerPermutation, cornerOrientation, edgePermutation, edgeOrientation };
}

/**
 * Applies one turn and returns a new state; the state passed in is never
 * touched, because a lesson keeps the whole history of positions.
 */
export function applyMove(state: CubeState, move: Move): CubeState {
  const quarter = QUARTER_TURN[move.face];
  let result = state;
  for (let count = 0; count < move.turn; count++) {
    result = compose(result, quarter);
  }
  return result;
}

export function applySequence(state: CubeState, moves: readonly Move[]): CubeState {
  return moves.reduce(applyMove, state);
}

/** Convenience for the common case: parse notation and run it from a solved cube. */
export function applyNotation(notation: string, state: CubeState = SOLVED_CUBE): CubeState {
  return applySequence(state, parseSequence(notation));
}
