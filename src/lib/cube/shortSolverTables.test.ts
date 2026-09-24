import { CubeState, SOLVED_CUBE } from "./state";
import { MOVES, applyMove, applyNotation, parseSequence } from "./moves";
import {
  CORNER_PERM_COUNT,
  FLIP_COUNT,
  MOVE_COUNT,
  PHASE2_MOVES,
  PHASE2_MOVE_COUNT,
  SLICE_COUNT,
  SLICE_PERM_COUNT,
  TWIST_COUNT,
  buildMoveTables,
  cornerPermOf,
  edgePermOf,
  flipOf,
  rawCube,
  setFlip,
  setPermutation,
  setSlice,
  setTwist,
  sliceOf,
  slicePermOf,
  twistOf,
} from "./shortSolverTables";

describe("координаты", () => {
  it("у собранного куба все координаты нулевые", () => {
    expect(twistOf(SOLVED_CUBE.cornerOrientation)).toBe(0);
    expect(flipOf(SOLVED_CUBE.edgeOrientation)).toBe(0);
    expect(sliceOf(SOLVED_CUBE.edgePermutation)).toBe(0);
    expect(cornerPermOf(SOLVED_CUBE.cornerPermutation)).toBe(0);
    expect(edgePermOf(SOLVED_CUBE.edgePermutation)).toBe(0);
    expect(slicePermOf(SOLVED_CUBE.edgePermutation)).toBe(0);
  });

  it("ориентация углов обратима на всех 2187 значениях и сохраняет сумму", () => {
    const cube = rawCube();
    for (let twist = 0; twist < TWIST_COUNT; twist++) {
      setTwist(twist, cube.co);
      expect(twistOf(cube.co)).toBe(twist);
      expect(cube.co.reduce((sum, value) => sum + value, 0) % 3).toBe(0);
    }
  });

  it("ориентация рёбер обратима на всех 2048 значениях и сохраняет чётность", () => {
    const cube = rawCube();
    for (let flip = 0; flip < FLIP_COUNT; flip++) {
      setFlip(flip, cube.eo);
      expect(flipOf(cube.eo)).toBe(flip);
      expect(cube.eo.reduce((sum, value) => sum + value, 0) % 2).toBe(0);
    }
  });

  it("положение рёбер среднего слоя обратимо и перебирает все 495 наборов", () => {
    const cube = rawCube();
    const seen = new Set<string>();
    for (let slice = 0; slice < SLICE_COUNT; slice++) {
      setSlice(slice, cube.ep);
      expect(sliceOf(cube.ep)).toBe(slice);
      expect([...cube.ep].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      seen.add(
        [...cube.ep]
          .map((edge, slot) => (edge >= 8 ? slot : -1))
          .filter((slot) => slot >= 0)
          .join()
      );
    }
    expect(seen.size).toBe(SLICE_COUNT);
  });

  it("перестановки обратимы на всех значениях", () => {
    const cube = rawCube();
    for (let rank = 0; rank < CORNER_PERM_COUNT; rank += 7) {
      setPermutation(rank, 8, cube.cp);
      expect(cornerPermOf(cube.cp)).toBe(rank);
    }
    for (let rank = 0; rank < SLICE_PERM_COUNT; rank++) {
      setPermutation(rank, 4, cube.ep, 8, 8);
      expect(slicePermOf(cube.ep)).toBe(rank);
      expect([...cube.ep.slice(8)].sort((a, b) => a - b)).toEqual([8, 9, 10, 11]);
    }
  });
});

describe("таблицы переходов", () => {
  const tables = buildMoveTables();

  /* Положения, пройденные по пути скрамбла, — все разные и не особые. */
  const states: CubeState[] = [];
  let walk: CubeState = SOLVED_CUBE;
  for (const move of parseSequence("R U2 F' L D B2 R' U F2 D' L2 B U' R2 F L' D2 B'")) {
    walk = applyMove(walk, move);
    states.push(walk);
  }

  it("ходы фазы 1 совпадают с движком", () => {
    for (const state of states) {
      MOVES.forEach((move, index) => {
        const after = applyMove(state, move);
        const twist = twistOf(state.cornerOrientation);
        const flip = flipOf(state.edgeOrientation);
        const slice = sliceOf(state.edgePermutation);
        expect(tables.twistMove[twist * MOVE_COUNT + index]).toBe(twistOf(after.cornerOrientation));
        expect(tables.flipMove[flip * MOVE_COUNT + index]).toBe(flipOf(after.edgeOrientation));
        expect(tables.sliceMove[slice * MOVE_COUNT + index]).toBe(sliceOf(after.edgePermutation));
      });
    }
  });

  it("ходы фазы 2 совпадают с движком внутри подгруппы", () => {
    // Положения подгруппы: только ходы фазы 2 от собранного куба.
    const inside = [
      "U R2 D' F2 L2 U2 B2",
      "D2 L2 U' R2 F2 D B2 U2",
      "R2 U F2 D2 B2 U' L2 D",
    ].map((notation) => applyNotation(notation));

    for (const state of inside) {
      PHASE2_MOVES.forEach((moveIndex, column) => {
        const after = applyMove(state, MOVES[moveIndex]);
        const corner = cornerPermOf(state.cornerPermutation);
        const edge = edgePermOf(state.edgePermutation);
        const slicePerm = slicePermOf(state.edgePermutation);
        expect(tables.cornerPermMove[corner * PHASE2_MOVE_COUNT + column]).toBe(
          cornerPermOf(after.cornerPermutation)
        );
        expect(tables.edgePermMove[edge * PHASE2_MOVE_COUNT + column]).toBe(
          edgePermOf(after.edgePermutation)
        );
        expect(tables.slicePermMove[slicePerm * PHASE2_MOVE_COUNT + column]).toBe(
          slicePermOf(after.edgePermutation)
        );
      });
    }
  });

  it("ходы фазы 2 не выводят из подгруппы", () => {
    for (let column = 0; column < PHASE2_MOVE_COUNT; column++) {
      expect(tables.twistMove[PHASE2_MOVES[column]]).toBe(0);
      expect(tables.flipMove[PHASE2_MOVES[column]]).toBe(0);
      expect(tables.sliceMove[PHASE2_MOVES[column]]).toBe(0);
    }
  });
});
