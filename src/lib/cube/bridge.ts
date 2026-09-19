/**
 * The bridge between a move in notation and a slice turn of the 3D cube.
 *
 * `RubiksCube` already knows how to play a slice turn: `rotateSlice(axis,
 * index, direction)` queues an animation and resolves when it ends. It has no
 * idea what `R` means, and the engine in `moves.ts` has no idea what an axis
 * is. This file is the only place where the two vocabularies meet, and it
 * holds no graphics: the scene is described by three plain strings and two
 * numbers, so the whole thing is testable without a browser.
 *
 * ## Where the faces are
 *
 * The scene puts x to the right, y up and z towards the viewer, and the cubies
 * sit at integer coordinates -1, 0 and 1. A face is therefore an axis plus an
 * end of it: U is the far end of y, D the near end, R of x, L the other side,
 * F of z, B behind.
 *
 * ## The sign, which is where this goes wrong
 *
 * `rotateSlice` turns the slice by `direction * 90` degrees **about the
 * positive axis**, by the right-hand rule. Notation means something else by
 * "clockwise": looking at that face from outside the cube. For U, R and F —
 * the faces on the positive end — those two are opposite, so a clockwise turn
 * is `direction = -1`. For D, L and B the outward direction is the negative
 * one and the two agree, so a clockwise turn is `direction = +1`.
 *
 * Both cases collapse into one rule: the clockwise direction is the negated
 * coordinate of the face. Stated once here, checked in the tests against the
 * real gesture code rather than against this comment.
 */

import { FACES, Face, Move, Turn } from "./moves";

/** Matches `Axis` in `dragRotation.ts`; repeated, not imported, so `src/lib` never depends on a component. */
export type Axis = "x" | "y" | "z";

export interface SliceTurn {
  axis: Axis;
  /** Slice coordinate along `axis`: -1 or 1 for a face, 0 for the middle slice. */
  index: number;
  /** +1 or -1, following the right-hand rule about the positive axis. */
  direction: number;
}

/** Which axis a face lies on, and at which end. */
const FACE_PLACE: Readonly<Record<Face, { readonly axis: Axis; readonly index: number }>> =
  Object.freeze({
    U: { axis: "y", index: 1 },
    D: { axis: "y", index: -1 },
    L: { axis: "x", index: -1 },
    R: { axis: "x", index: 1 },
    F: { axis: "z", index: 1 },
    B: { axis: "z", index: -1 },
  });

/** A clockwise quarter turn of a face, seen from outside it. */
const clockwiseDirection = (face: Face): number => -FACE_PLACE[face].index;

/**
 * The slice turns that play `move`.
 *
 * A half turn is two quarter turns rather than one doubled rotation: the
 * animation contract says direction is +1 or -1, and the queue plays the two
 * in order anyway.
 */
export function sliceTurnsForMove(move: Move): SliceTurn[] {
  const { axis, index } = FACE_PLACE[move.face];
  const clockwise = clockwiseDirection(move.face);
  const direction = move.turn === 3 ? -clockwise : clockwise;
  const quarter: SliceTurn = { axis, index, direction };

  return move.turn === 2 ? [quarter, { ...quarter }] : [quarter];
}

/**
 * The move a single quarter turn of a slice corresponds to, or null when there
 * is none.
 *
 * Null is the honest answer for the middle slice: dragging it turns M, E or S,
 * and the engine deliberately does not understand those. A caller reporting
 * user gestures must stay silent rather than invent a face turn.
 */
export function moveForSliceTurn(turn: SliceTurn): Move | null {
  if (turn.direction !== 1 && turn.direction !== -1) return null;

  const face = FACES.find(
    (candidate) =>
      FACE_PLACE[candidate].axis === turn.axis && FACE_PLACE[candidate].index === turn.index
  );
  if (!face) return null;

  return { face, turn: (turn.direction === clockwiseDirection(face) ? 1 : 3) as Turn };
}

/** Whatever plays one slice turn and resolves when it has finished — `rotateSlice`, in practice. */
export type SliceRotator = (
  axis: Axis,
  index: number,
  direction: number,
  duration?: number
) => Promise<void>;

/**
 * Plays a sequence, one turn at a time.
 *
 * Each turn waits for the previous one: a lesson that fired them all at once
 * would depend on the animation queue for correctness, and a step back would
 * race the step it is undoing.
 */
export async function playSequence(
  rotate: SliceRotator,
  moves: readonly Move[],
  duration?: number
): Promise<void> {
  for (const move of moves) {
    for (const turn of sliceTurnsForMove(move)) {
      await rotate(turn.axis, turn.index, turn.direction, duration);
    }
  }
}
