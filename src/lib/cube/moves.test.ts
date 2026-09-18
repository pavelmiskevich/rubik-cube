import { readFileSync } from "node:fs";
import { join } from "node:path";

import { generateScramble } from "../scrambler";
import { CORNERS, CubeState, EDGES, SOLVED_CUBE, equals } from "./state";
import {
  FACES,
  MOVES,
  Move,
  applyMove,
  applyNotation,
  applySequence,
  formatMove,
  formatSequence,
  invertMove,
  invertSequence,
  parseMove,
  parseSequence,
} from "./moves";

const isSolved = (state: CubeState) => equals(state, SOLVED_CUBE);

/** Runs `notation` `times` times in a row from a solved cube. */
const repeat = (notation: string, times: number): CubeState => {
  const moves = parseSequence(notation);
  let state = SOLVED_CUBE;
  for (let run = 0; run < times; run++) state = applySequence(state, moves);
  return state;
};

const displacedCorners = (state: CubeState) =>
  state.cornerPermutation.filter((piece, slot) => piece !== slot || state.cornerOrientation[slot] !== 0).length;

const displacedEdges = (state: CubeState) =>
  state.edgePermutation.filter((piece, slot) => piece !== slot || state.edgeOrientation[slot] !== 0).length;

describe("parseSequence", () => {
  it("parses plain, prime and double turns", () => {
    expect(parseSequence("R U R' F2")).toEqual([
      { face: "R", turn: 1 },
      { face: "U", turn: 1 },
      { face: "R", turn: 3 },
      { face: "F", turn: 2 },
    ]);
  });

  it("accepts any amount of surrounding and separating whitespace", () => {
    expect(formatSequence(parseSequence("  R\tU\n\nR'  "))).toBe("R U R'");
  });

  it("treats an empty string as an empty sequence", () => {
    expect(parseSequence("")).toEqual([]);
    expect(parseSequence("   ")).toEqual([]);
  });

  it("round-trips through formatSequence", () => {
    const notation = "R U R' U' R' F R2 U' R' U' R U R' F'";
    expect(formatSequence(parseSequence(notation))).toBe(notation);
  });

  it("accepts every scramble generateScramble produces", () => {
    for (let run = 0; run < 50; run++) {
      const scramble = generateScramble(25);
      expect(formatSequence(parseSequence(scramble))).toBe(scramble);
    }
  });

  it("says which face it did not recognise", () => {
    expect(() => parseSequence("R Q2 U")).toThrow(/неизвестная грань "Q"/);
    expect(() => parseSequence("R Q2 U")).toThrow(/U, D, L, R, F, B/);
  });

  it("says which modifier it did not recognise", () => {
    expect(() => parseSequence("R3")).toThrow(/неизвестный модификатор "3"/);
    expect(() => parseSequence("R2'")).toThrow(/неизвестный модификатор "2'"/);
  });

  it("says that slice, wide and whole-cube turns are out of scope", () => {
    ["M", "E", "S", "x", "y", "z", "r", "u2"].forEach((token) => {
      expect(() => parseSequence(token)).toThrow(/повороты срезов и всего куба не поддерживаются/);
    });
  });

  it("points at the offending move inside a long sequence", () => {
    expect(() => parseSequence("R U F Q")).toThrow(/"Q" \(ход 4\)/);
    expect(() => parseSequence("R U F Q")).toThrow(/Не удалось разобрать ход/);
  });
});

describe("parseMove", () => {
  it("parses one token and reports errors without a position", () => {
    expect(parseMove("R'")).toEqual({ face: "R", turn: 3 });
    expect(() => parseMove("R9")).toThrow(/^Не удалось разобрать ход "R9": /);
  });
});

describe("MOVES", () => {
  it("lists all 18 basic turns exactly once", () => {
    expect(MOVES).toHaveLength(18);

    const notations = MOVES.map(formatMove);
    expect(new Set(notations).size).toBe(18);
    notations.forEach((notation) => expect(notation).toMatch(/^[UDLRFB]('|2)?$/));
    expect(new Set(MOVES.map((move) => move.face))).toEqual(new Set(FACES));
  });

  it("round-trips every move through notation", () => {
    MOVES.forEach((move) => expect(parseMove(formatMove(move))).toEqual(move));
  });
});

describe("applyMove", () => {
  it("returns a new state and leaves the old one untouched", () => {
    const before = SOLVED_CUBE.cornerPermutation;
    const after = applyMove(SOLVED_CUBE, { face: "R", turn: 1 });

    expect(after).not.toBe(SOLVED_CUBE);
    expect(SOLVED_CUBE.cornerPermutation).toBe(before);
    expect(SOLVED_CUBE.cornerPermutation).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(isSolved(after)).toBe(false);
  });

  it.each(MOVES.map((move) => [formatMove(move), move] as const))(
    "returns to solved after four applications of %s",
    (_notation, move) => {
      let state: CubeState = SOLVED_CUBE;
      for (let count = 0; count < 4; count++) state = applyMove(state, move);
      expect(isSolved(state)).toBe(true);
    }
  );

  it.each(MOVES.map((move) => [formatMove(move), move] as const))(
    "is undone by the inverse of %s",
    (_notation, move) => {
      const state = applyMove(applyMove(SOLVED_CUBE, move), invertMove(move));
      expect(isSolved(state)).toBe(true);
    }
  );

  it.each(MOVES.map((move) => [formatMove(move), move] as const))(
    "moves only the pieces sitting on the turned face: %s",
    (_notation, move) => {
      const state = applyMove(SOLVED_CUBE, move);

      CORNERS.forEach((corner, slot) => {
        if (corner.includes(move.face)) return;
        expect(state.cornerPermutation[slot]).toBe(slot);
        expect(state.cornerOrientation[slot]).toBe(0);
      });

      EDGES.forEach((edge, slot) => {
        if (edge.includes(move.face)) return;
        expect(state.edgePermutation[slot]).toBe(slot);
        expect(state.edgeOrientation[slot]).toBe(0);
      });
    }
  );

  it("keeps every orientation untouched on U and D turns", () => {
    // U and D can neither twist a corner nor flip an edge under this convention.
    MOVES.filter((move) => move.face === "U" || move.face === "D").forEach((move) => {
      const state = applyMove(SOLVED_CUBE, move);
      expect(state.cornerOrientation).toEqual(new Array(8).fill(0));
      expect(state.edgeOrientation).toEqual(new Array(12).fill(0));
    });
  });

  it("flips four edges on a quarter turn of F or B, and none on R, L, U, D", () => {
    const flips = (face: string) =>
      applyNotation(face).edgeOrientation.reduce((sum, value) => sum + value, 0);

    expect(flips("F")).toBe(4);
    expect(flips("B")).toBe(4);
    ["R", "L", "U", "D"].forEach((face) => expect(flips(face)).toBe(0));
  });

  it("twists corners only on quarter turns of L, R, F and B", () => {
    const twists = (notation: string) =>
      applyNotation(notation).cornerOrientation.reduce((sum, value) => sum + value, 0);

    ["L", "R", "F", "B"].forEach((face) => expect(twists(face)).toBe(6));
    ["L2", "R2", "F2", "B2", "U", "D"].forEach((notation) => expect(twists(notation)).toBe(0));
  });
});

describe("invertSequence", () => {
  it("inverts every move and reverses the order", () => {
    expect(formatSequence(invertSequence(parseSequence("R U2 F'")))).toBe("F U2 R'");
  });

  it("leaves a sequence unchanged when applied twice", () => {
    const moves = parseSequence("R U R' U' F2 B L'");
    expect(invertSequence(invertSequence(moves))).toEqual(moves);
  });

  it("inverts a single move, with a half turn undoing itself", () => {
    expect(invertMove({ face: "R", turn: 1 })).toEqual({ face: "R", turn: 3 });
    expect(invertMove({ face: "R", turn: 3 })).toEqual({ face: "R", turn: 1 });
    expect(invertMove({ face: "R", turn: 2 })).toEqual({ face: "R", turn: 2 });
  });

  it("returns the cube to where it started, whatever it started from", () => {
    for (let run = 0; run < 30; run++) {
      const setup = parseSequence(generateScramble(8));
      const start = applySequence(SOLVED_CUBE, setup);

      const moves = parseSequence(generateScramble(15));
      const after = applySequence(start, moves);
      const back = applySequence(after, invertSequence(moves));

      expect(equals(back, start)).toBe(true);
    }
  });

  it("undoes a full scramble back to solved", () => {
    for (let run = 0; run < 30; run++) {
      const moves = parseSequence(generateScramble());
      const scrambled = applySequence(SOLVED_CUBE, moves);
      expect(isSolved(scrambled)).toBe(false);
      expect(isSolved(applySequence(scrambled, invertSequence(moves)))).toBe(true);
    }
  });
});

/**
 * Classic sequences whose order — how many repetitions bring the cube home —
 * is a published property of the puzzle, not something this engine gets to
 * decide. Every row was cross-checked against an independent geometric model
 * (26 cubies carrying rotation matrices) before being written down here.
 */
const KNOWN_ORDERS: ReadonlyArray<{ name: string; notation: string; order: number }> = [
  { name: "a single face turn", notation: "U", order: 4 },
  { name: "a half turn", notation: "R2", order: 2 },
  { name: "the sexy move", notation: "R U R' U'", order: 6 },
  { name: "Sune", notation: "R U R' U R U2 R'", order: 6 },
  { name: "the T permutation", notation: "R U R' U' R' F R2 U' R' U' R U R' F'", order: 2 },
  { name: "the Y permutation", notation: "F R U' R' U' R U R' F' R U R' U' R' F R F'", order: 2 },
  { name: "the checkerboard", notation: "U2 D2 L2 R2 F2 B2", order: 2 },
  { name: "two turns on different faces", notation: "R U", order: 105 },
  { name: "a quarter turn against a half turn", notation: "R U2", order: 30 },
];

describe("known sequences", () => {
  it.each(KNOWN_ORDERS)("returns $name to solved after exactly $order repetitions", ({ notation, order }) => {
    expect(isSolved(repeat(notation, order))).toBe(true);
  });

  it.each(KNOWN_ORDERS)("does not return $name to solved any earlier", ({ notation, order }) => {
    for (let times = 1; times < order; times++) {
      expect(isSolved(repeat(notation, times))).toBe(false);
    }
  });

  it("leaves the first two layers alone through Sune", () => {
    // Sune is an algorithm for the last layer: it must not disturb anything below it.
    const state = applyNotation("R U R' U R U2 R'");

    [4, 5, 6, 7].forEach((slot) => {
      expect(state.cornerPermutation[slot]).toBe(slot);
      expect(state.cornerOrientation[slot]).toBe(0);
    });
    [4, 5, 6, 7, 8, 9, 10, 11].forEach((slot) => {
      expect(state.edgePermutation[slot]).toBe(slot);
      expect(state.edgeOrientation[slot]).toBe(0);
    });

    // It does rearrange the last layer: all four corners and three of its edges.
    expect(displacedCorners(state)).toBe(4);
    expect(displacedEdges(state)).toBe(3);
  });

  it("swaps exactly two corners and two edges through the T permutation", () => {
    const state = applyNotation("R U R' U' R' F R2 U' R' U' R U R' F'");
    expect(displacedCorners(state)).toBe(2);
    expect(displacedEdges(state)).toBe(2);
    expect(state.cornerOrientation).toEqual(new Array(8).fill(0));
    expect(state.edgeOrientation).toEqual(new Array(12).fill(0));
  });
});

describe("invariants of a reachable state", () => {
  const isPermutation = (values: readonly number[]) =>
    new Set(values).size === values.length && values.every((value) => value >= 0 && value < values.length);

  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

  it("holds after any scramble the generator produces", () => {
    for (let run = 0; run < 200; run++) {
      const state = applyNotation(generateScramble(30));

      expect(isPermutation(state.cornerPermutation)).toBe(true);
      expect(isPermutation(state.edgePermutation)).toBe(true);
      expect(state.cornerPermutation).toHaveLength(8);
      expect(state.edgePermutation).toHaveLength(12);

      // A corner cannot be twisted on its own, so the twists add up to a
      // multiple of three; likewise edges only ever flip in pairs.
      expect(sum(state.cornerOrientation) % 3).toBe(0);
      expect(sum(state.edgeOrientation) % 2).toBe(0);

      state.cornerOrientation.forEach((twist) => expect([0, 1, 2]).toContain(twist));
      state.edgeOrientation.forEach((flip) => expect([0, 1]).toContain(flip));
    }
  });

  it("holds after every single basic turn", () => {
    MOVES.forEach((move) => {
      const state = applyMove(SOLVED_CUBE, move);
      expect(isPermutation(state.cornerPermutation)).toBe(true);
      expect(isPermutation(state.edgePermutation)).toBe(true);
      expect(sum(state.cornerOrientation) % 3).toBe(0);
      expect(sum(state.edgeOrientation) % 2).toBe(0);
    });
  });
});

describe("scrambles from generateScramble", () => {
  it("parses and applies without complaint", () => {
    for (let run = 0; run < 100; run++) {
      const scramble = generateScramble();
      const moves: Move[] = parseSequence(scramble);

      expect(moves).toHaveLength(20);
      expect(() => applySequence(SOLVED_CUBE, moves)).not.toThrow();
      expect(isSolved(applySequence(SOLVED_CUBE, moves))).toBe(false);
    }
  });
});

describe("the engine carries no graphics dependency", () => {
  it.each(["state.ts", "moves.ts"])("never imports three in %s", (file) => {
    const source = readFileSync(join(__dirname, file), "utf8");
    expect(source).not.toMatch(/\bfrom\s+["']three/);
    expect(source).not.toMatch(/\brequire\(\s*["']three/);
    expect(source).not.toMatch(/@react-three/);
  });
});
