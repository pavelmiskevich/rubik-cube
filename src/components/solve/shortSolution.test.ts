import { SOLVED_CUBE } from "@/lib/cube/state";
import { applyNotation, applySequence, parseSequence } from "@/lib/cube/moves";
import { isSolved } from "@/lib/cube/predicates";
import { stateKey, toShortSolution } from "./shortSolution";
import { answerShortSolve } from "./answerShortSolve";

describe("answerShortSolve", () => {
  it("первый запрос строит таблицы, следующие — нет", () => {
    const first = answerShortSolve({ id: 1, state: SOLVED_CUBE });
    const second = answerShortSolve({ id: 2, state: SOLVED_CUBE });

    expect(first).toMatchObject({ id: 1, kind: "moves", builtTables: true });
    expect(second).toMatchObject({ id: 2, kind: "moves", builtTables: false });
  });

  it("собранный куб — пустое решение, и экран говорит «уже собран»", () => {
    const response = answerShortSolve({ id: 3, state: SOLVED_CUBE });
    expect(response).toMatchObject({ kind: "moves", moves: "", count: 0 });
    expect(toShortSolution(response)).toEqual({ kind: "solved" });
  });

  it("ходы ответа собирают кубик, и счёт совпадает с ними", () => {
    const state = applyNotation("R U2 F' L D B2 R' U F2 D' L2 B U' R2 F L' D2 B' U L2");
    const response = answerShortSolve({ id: 4, state });
    if (response.kind !== "moves") throw new Error("ожидались ходы");

    const moves = parseSequence(response.moves);
    expect(moves).toHaveLength(response.count);
    expect(isSolved(applySequence(state, moves))).toBe(true);
    expect(toShortSolution(response)).toEqual({
      kind: "moves",
      moves: response.moves,
      count: response.count,
    });
  });

  it("невозможное положение — отказ, а не исключение в фоновом потоке", () => {
    const flipped = {
      ...SOLVED_CUBE,
      edgeOrientation: SOLVED_CUBE.edgeOrientation.map((value, slot) => (slot === 0 ? 1 : value)),
    };
    const response = answerShortSolve({ id: 5, state: flipped });
    expect(response).toEqual({ id: 5, kind: "failed" });
    expect(toShortSolution(response)).toEqual({ kind: "failed" });
  });
});

describe("stateKey", () => {
  it("одинаковые положения дают один ключ, разные — разные", () => {
    expect(stateKey(applyNotation("R U"))).toBe(stateKey(applyNotation("R U")));
    expect(stateKey(applyNotation("R U"))).not.toBe(stateKey(applyNotation("U R")));
    expect(stateKey(SOLVED_CUBE)).not.toBe(stateKey(applyNotation("R")));
  });
});
