/**
 * Layer-by-layer solver: the course, executed.
 *
 * The cube is solved the way the seven lessons teach it and in their order —
 * cross on D, first-layer corners, middle layer, cross on U, one-coloured U,
 * corners and edges of the last layer — with no algorithm that a lesson does
 * not show. The output is therefore a solution a beginner can follow: every
 * step carries the slug of the lesson that explains it, so a screen can send
 * the reader there instead of leaving them with a wall of letters.
 *
 * An optimal solver would end this in about twenty moves. It is deliberately
 * not what is built here (see the separate task about it): those twenty moves
 * explain nothing, and the solver exists to teach, not to impress. Long but
 * recognisable beats short but magic.
 *
 * ## Turning the cube in your hands
 *
 * The course writes its algorithms from one position — the corner front-right,
 * the edge's stripe facing you — and tells the reader to turn the cube. The
 * engine has no whole-cube rotations, so the solver turns the *algorithm*
 * instead: `frames.ts` renames the faces, and `R U R' U'` applied to the
 * back-left corner comes out as the same algorithm written with other letters.
 * Nothing new is invented; it is the lesson's algorithm, used from another
 * side. That is why every step here is still named after its lesson.
 *
 * Where the course says "adjust the top first", the solver does the same: a U
 * turn before the algorithm, found by trying the four of them and keeping the
 * one that produces the position the lesson describes.
 *
 * ## The cross
 *
 * The cross is the one part of the course built by understanding rather than by
 * an algorithm, so the lesson lists cases instead of a sequence. The solver
 * follows the same rules, one edge at a time: lift the edge into the top layer
 * if it is anywhere else, turn the top until the edge is above its home, and
 * drop it in. Every side turn used to lift an edge is undone immediately after
 * (`R U R'` and its mirrors), so an edge already standing in the cross is never
 * knocked out — which is exactly the caution the lesson spends its words on.
 */

import { ALGORITHMS } from "@/content/lessons/algorithms";
import { getLesson } from "@/content/lessons";
import { CORNERS, CORNER_INDEX, Corner, CubeState, EDGES, EDGE_INDEX, Edge } from "./state";
import { Face, Move, Turn, applyNotation, formatSequence, parseSequence } from "./moves";
import {
  areLastLayerCornersPlaced,
  areTwoLayersSolved,
  cornerColour,
  edgeColour,
  isCrossSolved,
  isFirstLayerSolved,
  isLastLayerCrossFormed,
  isLastLayerOriented,
  isSolved,
} from "./predicates";
import { SIDES, Side, cornerSeen, edgeSeen, frameEdge, inFrame, realCorner, realEdge } from "./frames";

export interface SolutionStep {
  /** slug урока из src/content/lessons, объясняющего этот шаг. */
  lessonSlug: string;
  /** Название шага словами курса. */
  title: string;
  /** Ходы шага в нотации курса. */
  moves: string;
}

/** The face the first layer is built on, and the face the last layer is on. */
const BOTTOM: Face = "D";
const TOP: Face = "U";

const U_TURNS = ["", "U", "U2", "U'"] as const;

/**
 * How many times a rule may go round before we call the cube impossible.
 *
 * Each rule below is proved to terminate by `method.test.ts`, which runs it
 * over every case of its step, so a guard can only trip on a state no real
 * cube can reach — a single flipped edge, a single twisted corner. Without the
 * guards such a state would hang the caller instead of being rejected.
 */
const GUARD = 24;

function impossible(what: string): never {
  throw new Error(`Не удалось собрать ${what}: такого положения на настоящем кубике не бывает`);
}

const edgeHome = (state: CubeState, slot: Edge): boolean =>
  state.edgePermutation[EDGE_INDEX[slot]] === EDGE_INDEX[slot] &&
  state.edgeOrientation[EDGE_INDEX[slot]] === 0;

const cornerHome = (state: CubeState, slot: Corner): boolean =>
  state.cornerPermutation[CORNER_INDEX[slot]] === CORNER_INDEX[slot] &&
  state.cornerOrientation[CORNER_INDEX[slot]] === 0;

/**
 * Adjacent turns of one face merged into one: `U' U2` is `U`, `F F'` is
 * nothing at all. Merging can bring two more turns of the same face together,
 * so the pass repeats until nothing changes.
 *
 * This is bookkeeping, not cleverness: the solver stitches its steps together
 * out of whole algorithms, and the seams regularly leave a pair like `F' F` in
 * the notation. Writing them out would make the reader do two turns that undo
 * each other.
 */
function simplify(moves: readonly Move[]): Move[] {
  let result = [...moves];
  for (let pass = 0; pass < result.length; pass++) {
    const merged: Move[] = [];
    result.forEach((move) => {
      const last = merged[merged.length - 1];
      if (last && last.face === move.face) {
        merged.pop();
        const turn = (last.turn + move.turn) % 4;
        if (turn !== 0) merged.push({ face: move.face, turn: turn as Turn });
        return;
      }
      merged.push(move);
    });
    if (merged.length === result.length) return merged;
    result = merged;
  }
  return result;
}

/**
 * The solver's hands: the position as it stands and the notation done to it.
 *
 * Moves pile up until a step is finished, then `take` hands them over and
 * starts the next step's tally — the solution is a list of steps, not one
 * string of letters.
 */
class Hands {
  private readonly done: string[] = [];

  constructor(public state: CubeState) {}

  turn(notation: string): void {
    if (notation.trim() === "") return;
    this.state = applyNotation(notation, this.state);
    this.done.push(notation);
  }

  take(): string {
    const notation = formatSequence(simplify(parseSequence(this.done.join(" "))));
    this.done.length = 0;
    return notation;
  }
}

/**
 * A way to hold the cube and a turn of the top after which the position is the
 * one the lesson describes. The first one found, the way a solver takes the
 * first case they recognise.
 */
function findTarget(
  fits: (front: Side, after: CubeState) => boolean,
  state: CubeState
): { front: Side; u: string } | undefined {
  for (const front of SIDES) {
    for (const u of U_TURNS) {
      if (fits(front, applyNotation(u, state))) return { front, u };
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ крест */

/** Lifting an edge out of the bottom layer: the face it sits on, turned twice. */
const LIFT_FROM_BOTTOM: Readonly<Partial<Record<Edge, string>>> = {
  DF: "F2",
  DR: "R2",
  DB: "B2",
  DL: "L2",
};

/**
 * Lifting an edge out of the middle layer, written in the frame's own letters.
 *
 * Each of these is one side turn that carries the edge up, a turn of the top
 * that moves it off that side, and the side turn undone — so the cross edge the
 * side turn pushed out comes straight back. The lesson's "turn the top first,
 * and only then drop the edge" is the same caution.
 */
const LIFT_FROM_MIDDLE: Readonly<Partial<Record<Edge, string>>> = {
  FR: "R U R'",
  FL: "L' U' L",
  BR: "B U B'",
  BL: "B' U B",
};

/**
 * One edge of the bottom cross, from wherever it is now.
 *
 * The cube is held so the edge's home is front-bottom, which turns four cases
 * into one. From the top layer the edge goes home with `F2` if its bottom
 * colour already looks up; if it looks sideways, the edge is brought to the
 * right-hand side and dropped in with `R' F R` — the same "turn it out of the
 * way, drop it in, put it back" the lesson uses, and nothing in the cross is
 * disturbed by it.
 */
function crossEdge(hands: Hands, front: Side): void {
  const home = realEdge("DF", front);
  const piece = EDGE_INDEX[home];
  const where = (state: CubeState): Edge =>
    frameEdge(EDGES[state.edgePermutation.indexOf(piece)], front);

  for (let guard = 0; guard < GUARD; guard++) {
    if (edgeHome(hands.state, home)) return;

    const slot = where(hands.state);
    const fromBottom = LIFT_FROM_BOTTOM[slot];
    const fromMiddle = LIFT_FROM_MIDDLE[slot];

    if (fromBottom !== undefined) {
      hands.turn(inFrame(fromBottom, front));
      continue;
    }
    if (fromMiddle !== undefined) {
      hands.turn(inFrame(fromMiddle, front));
      continue;
    }

    // The edge is in the top layer: turn the top until it is where it can drop.
    const up = edgeSeen(hands.state, front, slot, TOP) === BOTTOM;
    const wanted: Edge = up ? "UF" : "UR";
    const u = U_TURNS.find((turn) => where(applyNotation(turn, hands.state)) === wanted);
    if (u === undefined) impossible("крест");

    hands.turn(u);
    hands.turn(inFrame(up ? "F2" : "R' F R", front));
  }

  impossible("крест");
}

/** The whole bottom cross, edge by edge, in the order the sides come. */
function cross(hands: Hands): void {
  for (let guard = 0; guard < GUARD; guard++) {
    if (isCrossSolved(hands.state, BOTTOM)) return;
    const front = SIDES.find((side) => !edgeHome(hands.state, realEdge("DF", side)));
    if (front === undefined) return;
    crossEdge(hands, front);
  }

  impossible("крест");
}

/* ------------------------------------------------------ углы первого слоя */

/**
 * First-layer corners. Find a corner with the bottom colour in the top layer,
 * hold the cube so that corner's home is front-bottom-right, bring the corner
 * over it with the top, and repeat `R U R' U'` until it drops in. If the top
 * holds no such corner while the layer is unfinished, one is stuck in the
 * bottom: the same algorithm, done once, lifts it out.
 */
function firstLayerCorners(hands: Hands): void {
  for (let guard = 0; guard < GUARD; guard++) {
    if (isFirstLayerSolved(hands.state, BOTTOM)) return;

    const found = findTarget((front, after) => {
      const colours = ([TOP, "R", "F"] as const).map((face) => cornerSeen(after, front, "URF", face));
      return colours.includes(BOTTOM) && colours.includes("F") && colours.includes("R");
    }, hands.state);

    if (found) {
      hands.turn(found.u);
      for (let repeat = 0; repeat < 6; repeat++) {
        if (cornerHome(hands.state, realCorner("DFR", found.front))) break;
        hands.turn(inFrame(ALGORITHMS.corner, found.front));
      }
      continue;
    }

    const stuck = SIDES.find((front) => !cornerHome(hands.state, realCorner("DFR", front)));
    if (stuck === undefined) impossible("первый слой");
    hands.turn(inFrame(ALGORITHMS.corner, stuck));
  }

  impossible("первый слой");
}

/* ------------------------------------------------------------ средний слой */

/**
 * The middle layer. Find a top-layer edge without the top colour, hold the cube
 * so its side colour matches the centre in front of it, and send it right or
 * left by the colour on its top. If the top has no such edge while the layer is
 * unfinished, one is stuck in the middle layer: the right-hand algorithm,
 * applied to it, knocks it out into the top.
 */
function middleLayer(hands: Hands): void {
  for (let guard = 0; guard < GUARD; guard++) {
    if (areTwoLayersSolved(hands.state, BOTTOM)) return;

    const found = findTarget(
      (front, after) =>
        edgeSeen(after, front, "UF", "F") === "F" &&
        ["R", "L"].includes(edgeSeen(after, front, "UF", TOP)),
      hands.state
    );

    if (found) {
      hands.turn(found.u);
      const top = edgeSeen(hands.state, found.front, "UF", TOP);
      hands.turn(inFrame(top === "R" ? ALGORITHMS.edgeRight : ALGORITHMS.edgeLeft, found.front));
      continue;
    }

    const stuck = SIDES.find((front) => !edgeHome(hands.state, realEdge("FR", front)));
    if (stuck === undefined) impossible("средний слой");
    hands.turn(inFrame(ALGORITHMS.edgeRight, stuck));
  }

  impossible("средний слой");
}

/* -------------------------------------------------------- последний слой */

const topEdgeUp = (state: CubeState, slot: Edge): boolean => edgeColour(state, slot, TOP) === TOP;

/**
 * The cross on the last layer. A dot — the algorithm as it stands. An L — turn
 * the top until it points back and left. A line — turn the top until it lies
 * across. Repeat until the cross is there; three times is the most it takes.
 */
function lastLayerCross(hands: Hands): void {
  for (let guard = 0; guard < GUARD; guard++) {
    if (isLastLayerCrossFormed(hands.state, TOP)) return;

    const u = U_TURNS.find((turn) => {
      const after = applyNotation(turn, hands.state);
      const [uf, ur, ub, ul] = (["UF", "UR", "UB", "UL"] as const).map((slot) =>
        topEdgeUp(after, slot)
      );
      if (![uf, ur, ub, ul].some(Boolean)) return true;
      return (ub && ul && !uf && !ur) || (ul && ur && !uf && !ub);
    });
    if (u === undefined) impossible("крест последнего слоя");

    hands.turn(u);
    hands.turn(ALGORITHMS.lastCross);
  }

  impossible("крест последнего слоя");
}

const topCornerUp = (state: CubeState, slot: Corner): boolean => cornerColour(state, slot, TOP) === TOP;

/**
 * The one-coloured top. Count the corners already showing the top colour up.
 * None — turn the top until the front-left corner shows it to the left. One —
 * put that corner front-left. Two — turn the top until the front-left corner
 * shows it towards you. Then the algorithm, and look again.
 */
function lastLayerFace(hands: Hands): void {
  for (let guard = 0; guard < GUARD; guard++) {
    if (isLastLayerOriented(hands.state, TOP)) return;

    const up = (["URF", "UFL", "ULB", "UBR"] as const).filter((slot) =>
      topCornerUp(hands.state, slot)
    ).length;
    const wanted: Face = up === 0 ? "L" : up === 1 ? TOP : "F";
    const u = U_TURNS.find(
      (turn) => cornerColour(applyNotation(turn, hands.state), "UFL", wanted) === TOP
    );
    if (u === undefined) impossible("верхнюю грань");

    hands.turn(u);
    hands.turn(ALGORITHMS.lastFace);
  }

  impossible("верхнюю грань");
}

/** The turn of the top, if there is one, after which every corner is home. */
const cornersAlignTurn = (state: CubeState): string | undefined =>
  U_TURNS.find((turn) => areLastLayerCornersPlaced(applyNotation(turn, state), TOP));

/** Two top corner stickers of one side show the same colour — "headlights". */
const hasHeadlights = (state: CubeState, side: Side): boolean => {
  const [a, b] = CORNERS.filter((name) => name.startsWith(TOP) && name.includes(side)).map((slot) =>
    cornerColour(state, slot, side)
  );
  return a === b;
};

/**
 * Last-layer corners. Find the side with headlights, turn the top so they face
 * back, and do the algorithm; with no headlights anywhere, do it from any side.
 * Repeat until a turn of the top puts every corner home — then make that turn.
 */
function lastLayerCorners(hands: Hands): void {
  for (let guard = 0; guard < GUARD; guard++) {
    const align = cornersAlignTurn(hands.state);
    if (align !== undefined) {
      hands.turn(align);
      return;
    }

    hands.turn(U_TURNS.find((turn) => hasHeadlights(applyNotation(turn, hands.state), "B")) ?? "");
    hands.turn(ALGORITHMS.lastCorners);
  }

  impossible("углы последнего слоя");
}

/** The whole top row of a side shows one colour — a "stripe". */
const hasStripe = (state: CubeState, side: Side): boolean => {
  const corners = CORNERS.filter((name) => name.startsWith(TOP) && name.includes(side));
  const edge = EDGES.find((name) => name.startsWith(TOP) && name.includes(side))!;
  const colours = [
    ...corners.map((slot) => cornerColour(state, slot, side)),
    edgeColour(state, edge, side),
  ];
  return colours.every((colour) => colour === colours[0]);
};

/**
 * Last-layer edges. Find the stripe and turn the top so it faces back; with no
 * stripe anywhere, do the algorithm from any side. Afterwards turn the top to
 * put the corners back on their centres, and look again.
 */
function lastLayerEdges(hands: Hands): void {
  for (let guard = 0; guard < GUARD; guard++) {
    if (isSolved(hands.state)) return;

    hands.turn(U_TURNS.find((turn) => hasStripe(applyNotation(turn, hands.state), "B")) ?? "");
    hands.turn(ALGORITHMS.lastEdges);

    const align = cornersAlignTurn(hands.state);
    if (align === undefined) impossible("рёбра последнего слоя");
    hands.turn(align);
  }

  impossible("рёбра последнего слоя");
}

/* --------------------------------------------------------------- решение */

/**
 * The course, lesson by lesson. The order is the order of `LESSONS`, and it is
 * not an implementation detail: each phase leans on everything the phases
 * before it built, so they cannot be reordered or skipped.
 *
 * The first lesson — notation — teaches no solving and therefore has no phase.
 */
const PHASES: readonly { readonly slug: string; readonly run: (hands: Hands) => void }[] = [
  { slug: "cross", run: cross },
  { slug: "first-layer", run: firstLayerCorners },
  { slug: "second-layer", run: middleLayer },
  { slug: "last-layer-cross", run: lastLayerCross },
  { slug: "last-layer-face", run: lastLayerFace },
  {
    slug: "last-layer-permutation",
    run: (hands) => {
      lastLayerCorners(hands);
      lastLayerEdges(hands);
    },
  },
];

/** The lesson's own title — the step is named exactly as the course names it. */
const titleOf = (slug: string): string => {
  const lesson = getLesson(slug);
  if (lesson === undefined) throw new Error(`Урок ${slug} не найден: курс и решатель разошлись`);
  return lesson.title;
};

/**
 * The solution for a position: the lessons that still have work to do, in the
 * order of the course.
 *
 * A lesson whose work is already done contributes no step — a cube with the
 * cross already standing is not told to build it, and a solved cube gives an
 * empty solution rather than a sequence that does nothing.
 *
 * Throws if the position is not one a real cube can be in: a lone flipped edge
 * or a lone twisted corner has no solution, and silently looping forever would
 * be a worse answer than saying so.
 */
export function solve(state: CubeState): SolutionStep[] {
  const hands = new Hands(state);

  return PHASES.flatMap(({ slug, run }) => {
    run(hands);
    const moves = hands.take();
    return moves === "" ? [] : [{ lessonSlug: slug, title: titleOf(slug), moves }];
  });
}
