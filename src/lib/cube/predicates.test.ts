import { generateScramble } from "../scrambler";
import { CORNER_INDEX, CubeState, EDGE_INDEX, SOLVED_CUBE } from "./state";
import { FACES, MOVES, applyNotation, formatMove } from "./moves";
import { areTwoLayersSolved, isCrossSolved, isFirstLayerSolved, isSolved } from "./predicates";

/**
 * Trap states are built by hand rather than by running notation: no sequence
 * of turns leaves exactly one piece misoriented, and a test that has to search
 * for such a sequence stops being readable.
 *
 * Both helpers keep the state reachable on a real cube — flips come in pairs
 * and twists sum to a multiple of three — so the predicates are never asked
 * about a cube that could not exist.
 */
const flipEdges = (...slots: readonly number[]): CubeState => ({
  cornerPermutation: [...SOLVED_CUBE.cornerPermutation],
  cornerOrientation: [...SOLVED_CUBE.cornerOrientation],
  edgePermutation: [...SOLVED_CUBE.edgePermutation],
  edgeOrientation: SOLVED_CUBE.edgeOrientation.map((value, slot) =>
    slots.includes(slot) ? (value + 1) % 2 : value
  ),
});

const twistCorners = (...twists: readonly (readonly [number, number])[]): CubeState => ({
  cornerPermutation: [...SOLVED_CUBE.cornerPermutation],
  cornerOrientation: SOLVED_CUBE.cornerOrientation.map((value, slot) => {
    const twist = twists.find(([twisted]) => twisted === slot);
    return twist ? (value + twist[1]) % 3 : value;
  }),
  edgePermutation: [...SOLVED_CUBE.edgePermutation],
  edgeOrientation: [...SOLVED_CUBE.edgeOrientation],
});

describe("isSolved", () => {
  it("accepts the solved cube", () => {
    expect(isSolved(SOLVED_CUBE)).toBe(true);
  });

  it("is broken by any single turn", () => {
    MOVES.forEach((move) => {
      expect(isSolved(applyNotation(formatMove(move)))).toBe(false);
    });
  });
});

describe("the solved cube", () => {
  it("satisfies every predicate, asked about any face", () => {
    FACES.forEach((face) => {
      expect(isCrossSolved(SOLVED_CUBE, face)).toBe(true);
      expect(isFirstLayerSolved(SOLVED_CUBE, face)).toBe(true);
      expect(areTwoLayersSolved(SOLVED_CUBE, face)).toBe(true);
    });
  });
});

describe("a predicate answers about the face it was asked about", () => {
  const afterU = applyNotation("U");
  const afterD = applyNotation("D");

  it("leaves the bottom two layers standing when only the top turns", () => {
    expect(isCrossSolved(afterU, "D")).toBe(true);
    expect(isFirstLayerSolved(afterU, "D")).toBe(true);
    expect(areTwoLayersSolved(afterU, "D")).toBe(true);
    expect(isSolved(afterU)).toBe(false);
  });

  it("reports the turned face, and every face that lost an edge to it, as unsolved", () => {
    expect(isCrossSolved(afterU, "U")).toBe(false);
    // UF left the F face, so the cross on F is broken too.
    expect(isCrossSolved(afterU, "F")).toBe(false);
  });

  it("gives the mirror answer when the cube is turned from the other end", () => {
    expect(areTwoLayersSolved(afterD, "U")).toBe(true);
    expect(isCrossSolved(afterD, "D")).toBe(false);
  });
});

describe("a piece at home but turned the wrong way", () => {
  it("is not a solved cross", () => {
    const flipped = flipEdges(EDGE_INDEX.DF, EDGE_INDEX.DR);

    expect(flipped.edgePermutation).toEqual([...SOLVED_CUBE.edgePermutation]);
    expect(isCrossSolved(flipped, "D")).toBe(false);
  });

  it("is not a solved first layer, even with the cross intact", () => {
    const twisted = twistCorners([CORNER_INDEX.DFR, 1], [CORNER_INDEX.DLF, 2]);

    expect(twisted.cornerPermutation).toEqual([...SOLVED_CUBE.cornerPermutation]);
    expect(isCrossSolved(twisted, "D")).toBe(true);
    expect(isFirstLayerSolved(twisted, "D")).toBe(false);
  });

  it("is not a solved second layer, even with the first layer intact", () => {
    const flipped = flipEdges(EDGE_INDEX.FR, EDGE_INDEX.FL);

    expect(isFirstLayerSolved(flipped, "D")).toBe(true);
    expect(areTwoLayersSolved(flipped, "D")).toBe(false);
  });
});

describe("the predicates agree with each other", () => {
  it("never reports a later step done while an earlier one is not", () => {
    for (let run = 0; run < 100; run++) {
      const state = applyNotation(generateScramble(8));

      FACES.forEach((face) => {
        if (areTwoLayersSolved(state, face)) {
          expect(isFirstLayerSolved(state, face)).toBe(true);
        }
        if (isFirstLayerSolved(state, face)) {
          expect(isCrossSolved(state, face)).toBe(true);
        }
        if (isSolved(state)) {
          expect(areTwoLayersSolved(state, face)).toBe(true);
        }
      });
    }
  });
});
