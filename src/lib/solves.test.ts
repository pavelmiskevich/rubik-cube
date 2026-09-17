import { toSolveResults } from "./solves";

describe("отображение строк базы в доменную модель", () => {
  it("переносит идентификатор, время и флаги", () => {
    expect(
      toSolveResults([
        { id: "a", timeMs: 12450, isDNF: false, isPlusTwo: true },
        { id: "b", timeMs: 9800, isDNF: true, isPlusTwo: false },
      ])
    ).toEqual([
      { id: "a", timeMs: 12450, isDNF: false, isPlusTwo: true },
      { id: "b", timeMs: 9800, isDNF: true, isPlusTwo: false },
    ]);
  });

  it("на пустом списке возвращает пустой", () => {
    expect(toSolveResults([])).toEqual([]);
  });
});
