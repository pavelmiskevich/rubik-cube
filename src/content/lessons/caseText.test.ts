import { applyNotation } from "@/lib/cube/moves";
import { SOLVED_CUBE } from "@/lib/cube/state";
import { undo } from "./algorithms";
import {
  describeOrientation,
  describePermutation,
  edgeShape,
  movedPieces,
  orientationTitle,
} from "./caseText";

/** Позиция, которую решает алгоритм: он же, сделанный задом наперёд из собранного. */
const caseOf = (algorithm: string) => applyNotation(undo(algorithm));

describe("edgeShape", () => {
  it.each([
    ["", "cross"],
    ["F R U R' U' F'", "line"],
    ["F U R U' R' F'", "angle"],
    ["F R U R' U' F' U2 F U R U' R' F'", "dot"],
  ])("после «%s» из собранного — %s", (algorithm, shape) => {
    expect(edgeShape(caseOf(algorithm))).toBe(shape);
  });
});

describe("describeOrientation", () => {
  const fish = caseOf("R U R' U R U2 R'");

  it("называет форму рёбер и число углов вверх", () => {
    expect(orientationTitle(fish)).toBe("Крест, один угол вверх");
  });

  it("говорит, где угол белым вверх и куда смотрит белое у остальных", () => {
    const text = describeOrientation(fish);
    expect(text).toContain("все четыре ребра — крест");
    expect(text).toContain("белым вверх один угол");
    // Три остальных угла — три указания направления.
    expect(text.match(/ — (на вас|от вас|вправо|влево)/g)).toHaveLength(3);
  });

  it("у точки без углов вверх перечисляет все четыре угла", () => {
    const text = describeOrientation(caseOf("R U2 R2 F R F' U2 R' F R F'"));
    expect(text).toContain("ни одного ребра, только центр — точка");
    expect(text).toContain("углов белым вверх нет");
    expect(text.match(/ — (на вас|от вас|вправо|влево)/g)).toHaveLength(4);
  });
});

describe("movedPieces и describePermutation", () => {
  it.each([
    ["R U' R U R U R U' R' U' R2", "edges", "перепутаны только рёбра"],
    ["R' F R' B2 R F' R' B2 R2", "corners", "перепутаны только углы"],
    ["R U R' U' R' F R2 U' R' U' R U R' F'", "both", "Перепутаны и углы, и рёбра"],
  ] as const)("%s: %s", (algorithm, moved, words) => {
    const state = caseOf(algorithm);
    expect(movedPieces(state)).toBe(moved);
    expect(describePermutation(state)).toContain(words);
  });

  it("не путается, если весь верх просто повёрнут", () => {
    // U: всё стоит верно друг относительно друга, но не по центрам.
    expect(movedPieces(applyNotation("U"))).toBe("edges");
    expect(movedPieces(SOLVED_CUBE)).toBe("edges");
  });

  it("три ребра по кругу: фары на всех сторонах и одна полоска", () => {
    const text = describePermutation(caseOf("R U' R U R U R U' R' U' R2"));
    expect(text).toContain("на всех четырёх сторонах");
    expect(text).toMatch(/Полоска — весь ряд одного цвета — (спереди|справа|сзади|слева)\./);
  });

  it("углы по диагонали: фар нет нигде", () => {
    const text = describePermutation(caseOf("F R U' R' U' R U R' F' R U R' U' R' F R F'"));
    expect(text).toContain("Фар — двух углов одного цвета на одной стороне — нет нигде");
  });
});
