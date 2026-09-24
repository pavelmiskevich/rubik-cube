/**
 * Short solver: about twenty turns instead of the course's hundred and fifty.
 *
 * The layer-by-layer solver (`solver.ts`) stays the main one — it speaks the
 * course's language, and every step is a lesson. This one is for the reader who
 * can already solve the cube and wants the short answer, not an explanation.
 * Nothing in its output is named after a lesson, because nothing in it is one.
 *
 * ## Two-phase search
 *
 * Searching the whole cube for the shortest solution is out of reach in a
 * browser. The search is split instead:
 *
 * 1. **Phase 1** turns the cube with all eighteen turns until it lands in the
 *    subgroup of `U, D, R2, L2, F2, B2`: every piece oriented and the
 *    middle-layer edges in the middle layer.
 * 2. **Phase 2** solves it from there using only those ten turns, which never
 *    leave the subgroup.
 *
 * Both are iterative deepening with lower bounds from `shortSolverTables.ts`.
 * The first solution comes quickly and is rarely the best one, so the search
 * keeps going: it lengthens phase 1 one turn at a time, and each time asks
 * phase 2 for something shorter than the best so far. A longer phase 1 often
 * lands on a position phase 2 finishes much faster.
 *
 * ## When it stops
 *
 * No promise of the shortest solution is made — that is a different, much more
 * expensive search. The search stops at whichever comes first:
 *
 * - a solution of `targetLength` turns or fewer has been found, and a short
 *   look further (`SETTLE_NODES`) found nothing better;
 * - `timeLimitMs` has passed — the best solution so far is returned;
 * - every shorter solution this method can find has been ruled out.
 *
 * The time limit never leaves the caller empty-handed: until a first solution
 * exists the search keeps going. One always exists within 30 turns (phase 1
 * never needs more than 12, phase 2 never more than 18), and it is found in
 * milliseconds.
 */

import { CORNER_COUNT, CORNER_ORIENTATIONS, CubeState, EDGE_COUNT } from "./state";
import { MOVES, Move } from "./moves";
import {
  FLIP_COUNT,
  MOVE_COUNT,
  PHASE2_MOVES,
  PHASE2_MOVE_COUNT,
  RawCube,
  SLICE_PERM_COUNT,
  TWIST_COUNT,
  Tables,
  applyRawMove,
  cornerPermOf,
  edgePermOf,
  flipOf,
  getTables,
  rawCube,
  sliceOf,
  slicePermOf,
  twistOf,
} from "./shortSolverTables";

export interface ShortSolveOptions {
  /** A solution this short ends the search at once. */
  targetLength?: number;
  /** After this many milliseconds the best solution found so far is returned. */
  timeLimitMs?: number;
  /** Clock, for tests. */
  now?: () => number;
}

/**
 * Defaults for the `/solve` screen. On a random cube 21 turns take a few tens
 * of milliseconds and rarely more than a tenth of a second; asking for 20
 * costs up to the full limit on one cube in fifteen for one turn less. The
 * limit is what a person waits without wondering whether the page froze.
 */
export const DEFAULT_TARGET_LENGTH = 21;
export const DEFAULT_TIME_LIMIT_MS = 1000;

/** Every position has a two-phase solution this long: 12 turns + 18 turns. */
export const MAX_SOLUTION_LENGTH = 30;
const MAX_PHASE2_DEPTH = 18;

/**
 * How far, in visited nodes, the search looks on after meeting the target.
 *
 * Stopping at the very first solution under the target would be wrong for a
 * nearly solved cube: for `R` the first thing phase 1 tries is another `R`,
 * which lands in the subgroup too, and the first solution is several turns of
 * phase 2 undoing an `R2` — while `R'` is the next branch over. Near-solved
 * positions finish the whole search well within this budget and get their
 * shortest answer; scrambled ones spend a few milliseconds more.
 */
const SETTLE_NODES = 50_000;

/** How often, in visited nodes, the clock is read — reading it on every node would cost more than the node. */
const CLOCK_EVERY = 2048;

/*
  The loops below touch no globals: no `Math`, no imported constants. Under the
  test runner the code runs in a sandboxed context where every global lookup
  goes through a slow path, and a `Math.floor` per node made the search sixty
  times slower there than in a browser. Tables and plain comparisons cost the
  same everywhere.
*/
const MOVES_PER_NODE = MOVE_COUNT;
const PHASE2_WIDTH = PHASE2_MOVE_COUNT;
const TWISTS = TWIST_COUNT;
const FLIPS = FLIP_COUNT;
const SLICE_PERMS = SLICE_PERM_COUNT;

const larger = (a: number, b: number): number => (a > b ? a : b);

/**
 * `MAY_FOLLOW[(last + 1) * 18 + move]` — whether `move` may follow `last`
 * (-1 for "nothing yet"). Two turns of one face are one turn; two turns of
 * opposite faces commute, so only one of their orders is tried.
 */
const MAY_FOLLOW: Uint8Array = (() => {
  const table = new Uint8Array((MOVE_COUNT + 1) * MOVE_COUNT);
  for (let last = -1; last < MOVE_COUNT; last++) {
    for (let move = 0; move < MOVE_COUNT; move++) {
      const face = Math.floor(move / 3);
      const lastFace = Math.floor(last / 3);
      const allowed =
        last < 0 || (face !== lastFace && !(face >> 1 === lastFace >> 1 && face < lastFace));
      table[(last + 1) * MOVE_COUNT + move] = allowed ? 1 : 0;
    }
  }
  return table;
})();

const PHASE2_MOVE_LIST = Uint8Array.from(PHASE2_MOVES);
const IS_PHASE2_MOVE = Uint8Array.from(MOVES, (_, index) => (PHASE2_MOVES.includes(index) ? 1 : 0));

const isPermutation = (values: readonly number[], length: number): boolean =>
  values.length === length &&
  new Set(values).size === length &&
  values.every((value) => Number.isInteger(value) && value >= 0 && value < length);

function permutationParity(values: readonly number[]): number {
  const seen = new Array<boolean>(values.length).fill(false);
  let parity = 0;
  for (let start = 0; start < values.length; start++) {
    if (seen[start]) continue;
    let length = 0;
    for (let at = start; !seen[at]; at = values[at]) {
      seen[at] = true;
      length++;
    }
    parity ^= (length - 1) & 1;
  }
  return parity;
}

/**
 * Throws on a position no real cube can be in. The screen checks the colouring
 * before asking, but a search over an impossible position would run out the
 * clock and still find nothing — better to say so at once.
 */
function assertSolvable(state: CubeState): void {
  const valid =
    isPermutation(state.cornerPermutation, CORNER_COUNT) &&
    isPermutation(state.edgePermutation, EDGE_COUNT) &&
    state.cornerOrientation.length === CORNER_COUNT &&
    state.edgeOrientation.length === EDGE_COUNT &&
    state.cornerOrientation.reduce((sum, value) => sum + value, 0) % CORNER_ORIENTATIONS === 0 &&
    state.edgeOrientation.reduce((sum, value) => sum + value, 0) % 2 === 0 &&
    permutationParity(state.cornerPermutation) === permutationParity(state.edgePermutation);

  if (!valid) {
    throw new Error("Такого положения у настоящего кубика не бывает: решения нет.");
  }
}

class Search {
  private readonly phase1 = new Int8Array(MAX_SOLUTION_LENGTH);
  private readonly phase2 = new Int8Array(MAX_SOLUTION_LENGTH);
  private best: number[] | null = null;
  /** Solutions must be shorter than this to be worth looking for. */
  private bound = MAX_SOLUTION_LENGTH + 1;
  private stopped = false;
  private nodes = 0;
  /** Node count at which the search stops once the target is met. */
  private settleAt = Infinity;
  private readonly start: RawCube;
  private readonly deadline: number;

  constructor(
    state: CubeState,
    private readonly tables: Tables,
    private readonly targetLength: number,
    timeLimitMs: number,
    private readonly now: () => number
  ) {
    this.start = rawCube();
    this.start.cp.set(state.cornerPermutation);
    this.start.co.set(state.cornerOrientation);
    this.start.ep.set(state.edgePermutation);
    this.start.eo.set(state.edgeOrientation);
    this.deadline = now() + timeLimitMs;
  }

  run(): number[] {
    const twist = twistOf(this.start.co);
    const flip = flipOf(this.start.eo);
    const slice = sliceOf(this.start.ep);

    for (let depth = 0; depth < this.bound && !this.stopped; depth++) {
      this.searchPhase1(twist, flip, slice, depth, 0, -1);
    }
    // `bound` starts above the longest two-phase solution, so `best` is set.
    return this.best ?? [];
  }

  private tick(): void {
    this.nodes++;
    if (this.nodes >= this.settleAt) {
      this.stopped = true;
    } else if (this.nodes % CLOCK_EVERY === 0 && this.best !== null && this.now() >= this.deadline) {
      this.stopped = true;
    }
  }

  private searchPhase1(
    twist: number,
    flip: number,
    slice: number,
    togo: number,
    depth: number,
    last: number
  ): void {
    if (togo === 0) {
      // Below the root the lower bound has already vouched for the subgroup.
      if (depth === 0 && (twist !== 0 || flip !== 0 || slice !== 0)) return;
      // A phase 1 that ends on a phase-2 turn is a shorter phase 1 already tried.
      if (depth === 0 || IS_PHASE2_MOVE[last] === 0) this.startPhase2(depth);
      return;
    }

    const { twistMove, flipMove, sliceMove, sliceTwist, sliceFlip } = this.tables;
    for (let move = 0; move < MOVES_PER_NODE; move++) {
      if (MAY_FOLLOW[(last + 1) * MOVES_PER_NODE + move] === 0) continue;
      const nextTwist = twistMove[twist * MOVES_PER_NODE + move];
      const nextFlip = flipMove[flip * MOVES_PER_NODE + move];
      const nextSlice = sliceMove[slice * MOVES_PER_NODE + move];
      const distance = larger(
        sliceTwist[nextSlice * TWISTS + nextTwist],
        sliceFlip[nextSlice * FLIPS + nextFlip]
      );
      if (distance > togo - 1) continue;

      this.tick();
      this.phase1[depth] = move;
      this.searchPhase1(nextTwist, nextFlip, nextSlice, togo - 1, depth + 1, move);
      if (this.stopped) return;
    }
  }

  private startPhase2(length1: number): void {
    let cube = rawCube();
    cube.cp.set(this.start.cp);
    cube.co.set(this.start.co);
    cube.ep.set(this.start.ep);
    cube.eo.set(this.start.eo);
    let spare = rawCube();
    for (let i = 0; i < length1; i++) {
      applyRawMove(cube, this.phase1[i], spare);
      [cube, spare] = [spare, cube];
    }

    const corner = cornerPermOf(cube.cp);
    const edge = edgePermOf(cube.ep);
    const slice = slicePermOf(cube.ep);
    const { cornerSlice, edgeSlice } = this.tables;
    const lower = Math.max(
      cornerSlice[corner * SLICE_PERM_COUNT + slice],
      edgeSlice[edge * SLICE_PERM_COUNT + slice]
    );
    const upper = Math.min(MAX_PHASE2_DEPTH, this.bound - 1 - length1);
    const last = length1 > 0 ? this.phase1[length1 - 1] : -1;

    for (let length2 = lower; length2 <= upper; length2++) {
      if (this.searchPhase2(corner, edge, slice, length2, 0, last)) {
        this.best = [...this.phase1.subarray(0, length1), ...this.phase2.subarray(0, length2)];
        this.bound = length1 + length2;
        if (this.bound <= this.targetLength && this.settleAt === Infinity) {
          this.settleAt = this.nodes + SETTLE_NODES;
        }
        return;
      }
      if (this.stopped) return;
    }
  }

  private searchPhase2(
    corner: number,
    edge: number,
    slice: number,
    togo: number,
    depth: number,
    last: number
  ): boolean {
    if (togo === 0) return true;

    const { cornerPermMove, edgePermMove, slicePermMove, cornerSlice, edgeSlice } = this.tables;
    for (let column = 0; column < PHASE2_WIDTH; column++) {
      const move = PHASE2_MOVE_LIST[column];
      if (MAY_FOLLOW[(last + 1) * MOVES_PER_NODE + move] === 0) continue;
      const nextCorner = cornerPermMove[corner * PHASE2_WIDTH + column];
      const nextEdge = edgePermMove[edge * PHASE2_WIDTH + column];
      const nextSlice = slicePermMove[slice * PHASE2_WIDTH + column];
      const distance = larger(
        cornerSlice[nextCorner * SLICE_PERMS + nextSlice],
        edgeSlice[nextEdge * SLICE_PERMS + nextSlice]
      );
      if (distance > togo - 1) continue;

      this.tick();
      this.phase2[depth] = move;
      if (this.searchPhase2(nextCorner, nextEdge, nextSlice, togo - 1, depth + 1, move)) {
        return true;
      }
      if (this.stopped) return false;
    }
    return false;
  }
}

/**
 * A short solution for `state`: the turns that, applied to it, give a solved
 * cube. A solved cube gets an empty list.
 *
 * The first call builds the tables (see `shortSolverTables.ts`) and pays for
 * them; later calls reuse them.
 *
 * Throws if the position cannot occur on a real cube.
 */
export function solveShort(state: CubeState, options: ShortSolveOptions = {}): Move[] {
  assertSolvable(state);

  const {
    targetLength = DEFAULT_TARGET_LENGTH,
    timeLimitMs = DEFAULT_TIME_LIMIT_MS,
    now = () => performance.now(),
  } = options;

  const search = new Search(state, getTables(), targetLength, timeLimitMs, now);
  return search.run().map((index) => MOVES[index]);
}
