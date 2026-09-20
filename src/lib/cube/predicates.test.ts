import { generateScramble } from "../scrambler";
import { CORNER_INDEX, CubeState, EDGE_INDEX, SOLVED_CUBE } from "./state";
import { FACES, MOVES, applyNotation, formatMove } from "./moves";
import {
  areLastLayerCornersPlaced,
  areTwoLayersSolved,
  cornerColour,
  edgeColour,
  isCrossFormed,
  isCrossSolved,
  isFaceOneColour,
  isFirstLayerSolved,
  isLastLayerCrossFormed,
  isLastLayerOriented,
  isSolved,
} from "./predicates";

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

describe("the colour showing on a face", () => {
  it("is the face's own colour everywhere on a solved cube", () => {
    expect(edgeColour(SOLVED_CUBE, "UF", "U")).toBe("U");
    expect(edgeColour(SOLVED_CUBE, "UF", "F")).toBe("F");
    expect(cornerColour(SOLVED_CUBE, "DRB", "B")).toBe("B");
  });

  it("follows a front turn: the left colour comes up onto the top of UF", () => {
    const afterF = applyNotation("F");

    expect(edgeColour(afterF, "UF", "U")).toBe("L");
    expect(edgeColour(afterF, "UF", "F")).toBe("F");
  });

  it("follows a right turn: the front colour comes up onto the top of URF", () => {
    const afterR = applyNotation("R");

    expect(cornerColour(afterR, "URF", "U")).toBe("F");
    expect(cornerColour(afterR, "URF", "R")).toBe("R");
    expect(cornerColour(afterR, "URF", "F")).toBe("D");
  });

  it("reads a twisted corner, not only a moved one", () => {
    const twisted = twistCorners([CORNER_INDEX.URF, 1], [CORNER_INDEX.UFL, 2]);
    const colours = (["U", "R", "F"] as const).map((face) => cornerColour(twisted, "URF", face));

    // Same three colours, turned: nothing is lost, and U no longer shows U.
    expect([...colours].sort()).toEqual(["F", "R", "U"]);
    expect(colours[0]).not.toBe("U");
  });

  it("refuses a face the slot does not touch", () => {
    expect(() => edgeColour(SOLVED_CUBE, "UF", "D")).toThrow();
    expect(() => cornerColour(SOLVED_CUBE, "URF", "D")).toThrow();
  });
});

describe("isCrossFormed", () => {
  it("accepts a cross whose sides do not match the centres yet", () => {
    // U only spins the top: the cross of U colour stays, the sides move away.
    const spun = applyNotation("U");

    expect(isCrossFormed(spun, "U")).toBe(true);
    expect(isCrossSolved(spun, "U")).toBe(false);
  });

  it("rejects a cross with two edges flipped", () => {
    expect(isCrossFormed(flipEdges(EDGE_INDEX.UF, EDGE_INDEX.UR), "U")).toBe(false);
  });

  it("rejects a cross after a turn that lifts a side colour on top", () => {
    expect(isCrossFormed(applyNotation("F"), "U")).toBe(false);
  });
});

describe("isFaceOneColour", () => {
  it("accepts a spun top face", () => {
    expect(isFaceOneColour(applyNotation("U2"), "U")).toBe(true);
  });

  it("rejects a face with a single twisted corner pair", () => {
    const twisted = twistCorners([CORNER_INDEX.URF, 1], [CORNER_INDEX.UBR, 2]);

    expect(isCrossFormed(twisted, "U")).toBe(true);
    expect(isFaceOneColour(twisted, "U")).toBe(false);
  });

  it("is true of every face of a solved cube and false after a side turn", () => {
    FACES.forEach((face) => expect(isFaceOneColour(SOLVED_CUBE, face)).toBe(true));
    expect(isFaceOneColour(applyNotation("R"), "U")).toBe(false);
  });
});

describe("the last-layer steps", () => {
  it("all hold on a solved cube", () => {
    FACES.forEach((face) => {
      expect(isLastLayerCrossFormed(SOLVED_CUBE, face)).toBe(true);
      expect(isLastLayerOriented(SOLVED_CUBE, face)).toBe(true);
      expect(areLastLayerCornersPlaced(SOLVED_CUBE, face)).toBe(true);
    });
  });

  it("do not care where the top edges are, only that the layers below stand", () => {
    // Swapping top edges without touching anything else: a U-layer 3-cycle.
    const edgesCycled = applyNotation("R U' R U R U R U' R' U' R2");

    expect(isLastLayerCrossFormed(edgesCycled, "U")).toBe(true);
    expect(isLastLayerOriented(edgesCycled, "U")).toBe(true);
    expect(areLastLayerCornersPlaced(edgesCycled, "U")).toBe(true);
    expect(isSolved(edgesCycled)).toBe(false);
  });

  it("require the corners home, not just the right colour on top", () => {
    const cornersCycled = applyNotation("R' F R' B2 R F' R' B2 R2");

    expect(isLastLayerOriented(cornersCycled, "U")).toBe(true);
    expect(areLastLayerCornersPlaced(cornersCycled, "U")).toBe(false);
  });

  it("require the first two layers under the face to stand", () => {
    // R breaks the layers below U and also shows other colours on top.
    const broken = applyNotation("R");

    expect(isLastLayerCrossFormed(broken, "U")).toBe(false);
    // A flipped middle edge keeps the top intact but is still not the last-layer step.
    const middleFlipped = flipEdges(EDGE_INDEX.FR, EDGE_INDEX.FL);
    expect(isFaceOneColour(middleFlipped, "U")).toBe(true);
    expect(isLastLayerOriented(middleFlipped, "U")).toBe(false);
  });

  it("never report a later step done while an earlier one is not", () => {
    for (let run = 0; run < 100; run++) {
      const state = applyNotation(generateScramble(8));

      FACES.forEach((face) => {
        if (areLastLayerCornersPlaced(state, face)) {
          expect(isLastLayerOriented(state, face)).toBe(true);
        }
        if (isLastLayerOriented(state, face)) {
          expect(isLastLayerCrossFormed(state, face)).toBe(true);
        }
        if (isSolved(state)) {
          expect(areLastLayerCornersPlaced(state, face)).toBe(true);
        }
      });
    }
  });
});
