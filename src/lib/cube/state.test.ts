import {
  CORNERS,
  CORNER_COUNT,
  CORNER_INDEX,
  CubeState,
  EDGES,
  EDGE_COUNT,
  EDGE_INDEX,
  SOLVED_CUBE,
  equals,
} from "./state";

describe("piece naming", () => {
  it("has 8 corners and 12 edges", () => {
    expect(CORNERS).toHaveLength(8);
    expect(EDGES).toHaveLength(12);
    expect(CORNER_COUNT).toBe(8);
    expect(EDGE_COUNT).toBe(12);
  });

  it("names every piece after the faces it touches, without repeats", () => {
    CORNERS.forEach((corner) => expect(corner).toMatch(/^[UD][LRFB][LRFB]$/));
    EDGES.forEach((edge) => expect(edge).toMatch(/^([UD][LRFB]|[FB][LR])$/));

    const names = [...CORNERS, ...EDGES];
    expect(new Set(names).size).toBe(names.length);
  });

  it("never names a piece after two opposite faces", () => {
    const opposite: Record<string, string> = { U: "D", D: "U", L: "R", R: "L", F: "B", B: "F" };
    [...CORNERS, ...EDGES].forEach((name) => {
      const letters = name.split("");
      letters.forEach((letter) => expect(letters).not.toContain(opposite[letter]));
    });
  });

  it("maps a name back to its slot index", () => {
    expect(CORNER_INDEX.URF).toBe(0);
    expect(CORNER_INDEX.DRB).toBe(7);
    expect(EDGE_INDEX.UR).toBe(0);
    expect(EDGE_INDEX.BR).toBe(11);

    CORNERS.forEach((corner, index) => expect(CORNER_INDEX[corner]).toBe(index));
    EDGES.forEach((edge, index) => expect(EDGE_INDEX[edge]).toBe(index));
  });
});

describe("SOLVED_CUBE", () => {
  it("has every piece home and nothing twisted", () => {
    expect(SOLVED_CUBE.cornerPermutation).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(SOLVED_CUBE.edgePermutation).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(SOLVED_CUBE.cornerOrientation).toEqual(new Array(8).fill(0));
    expect(SOLVED_CUBE.edgeOrientation).toEqual(new Array(12).fill(0));
  });

  it("is frozen, so a lesson cannot corrupt the shared starting point", () => {
    expect(Object.isFrozen(SOLVED_CUBE)).toBe(true);
    expect(() => {
      (SOLVED_CUBE.cornerPermutation as number[])[0] = 5;
    }).toThrow();
  });
});

describe("equals", () => {
  const copyOf = (state: CubeState): CubeState => ({
    cornerPermutation: [...state.cornerPermutation],
    cornerOrientation: [...state.cornerOrientation],
    edgePermutation: [...state.edgePermutation],
    edgeOrientation: [...state.edgeOrientation],
  });

  it("compares contents, not array identity", () => {
    expect(equals(SOLVED_CUBE, copyOf(SOLVED_CUBE))).toBe(true);
  });

  it("notices a piece in the wrong slot", () => {
    const swapped = copyOf(SOLVED_CUBE);
    [swapped.cornerPermutation[0], swapped.cornerPermutation[1]] = [
      swapped.cornerPermutation[1],
      swapped.cornerPermutation[0],
    ];
    expect(equals(SOLVED_CUBE, swapped)).toBe(false);
  });

  it("notices a piece that is home but twisted", () => {
    // The whole reason orientation is tracked separately: this cube looks
    // solved to a model that only remembers positions.
    const twisted = copyOf(SOLVED_CUBE);
    twisted.cornerOrientation[0] = 1;
    twisted.cornerOrientation[1] = 2;
    expect(twisted.cornerPermutation).toEqual([...SOLVED_CUBE.cornerPermutation]);
    expect(equals(SOLVED_CUBE, twisted)).toBe(false);
  });

  it("notices a flipped edge", () => {
    const flipped = copyOf(SOLVED_CUBE);
    flipped.edgeOrientation[3] = 1;
    expect(equals(SOLVED_CUBE, flipped)).toBe(false);
  });
});
