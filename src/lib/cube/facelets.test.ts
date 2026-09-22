import { CubeState, SOLVED_CUBE, equals } from "./state";
import { applyNotation } from "./moves";
import { Facelets, FaceletProblem, Sticker, checkFacelets, stateToFacelets } from "./facelets";

const SOLVED_TEXT =
  "UUUUUUUUU" + "RRRRRRRRR" + "FFFFFFFFF" + "DDDDDDDDD" + "LLLLLLLLL" + "BBBBBBBBB";

const read = (text: string): Sticker[] => [...text.replace(/\s+/g, "")] as Sticker[];
const write = (facelets: Facelets): string => facelets.join("");

/**
 * Facelet indices used by the fixtures, spelled out rather than imported.
 *
 * The implementation derives the whole layout from the geometry of the six
 * faces, so these hand-written numbers are an independent check of it: if the
 * derivation ever drifts, the fixtures below stop describing the pieces they
 * are named after and the tests fail.
 */
const U_CENTRE = 4;
const F_CENTRE = 22;
const URF = [8, 9, 20] as const; // U9, R1, F3
const UR = [5, 10] as const; // U6, R2
const UF = [7, 19] as const; // U8, F2
const UL = [3, 37] as const; // U4, L2
const FR = [23, 12] as const; // F6, R4

const paint = (text: string, changes: Readonly<Record<number, Sticker>>): Sticker[] => {
  const facelets = read(text);
  for (const [index, sticker] of Object.entries(changes)) {
    facelets[Number(index)] = sticker;
  }
  return facelets;
};

const accept = (facelets: Facelets): CubeState => {
  const check = checkFacelets(facelets);
  if (!check.ok) {
    throw new Error(
      `раскраска отвергнута: ${check.problems.map((problem) => problem.message).join(" | ")}`
    );
  }
  return check.state;
};

const reject = (facelets: Facelets): readonly FaceletProblem[] => {
  const check = checkFacelets(facelets);
  if (check.ok) throw new Error("раскраска принята, хотя такого кубика быть не может");
  return check.problems;
};

/** Scrambles used to check the two directions against each other. */
const SCRAMBLES = [
  "",
  "R",
  "F'",
  "R U R' U'",
  "F2 B2 U2 D2 L2 R2",
  "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
  "L2 D2 B' R' U F2 D L F' R2 B2 U2 R2 F2 L2 U'",
];

describe("stateToFacelets", () => {
  it("раскрашивает собранный куб гранями по порядку U R F D L B", () => {
    expect(write(stateToFacelets(SOLVED_CUBE))).toBe(SOLVED_TEXT);
  });

  it("оставляет центры на месте при любом ходе", () => {
    for (const scramble of SCRAMBLES) {
      const facelets = stateToFacelets(applyNotation(scramble));
      expect([0, 1, 2, 3, 4, 5].map((face) => facelets[face * 9 + 4]).join("")).toBe("URFDLB");
    }
  });

  /*
    Геометрические проверки: ход U по часовой стрелке уносит верхний ряд R на
    F, верхний ряд F на L и так далее. Они не зависят от таблиц в реализации и
    ловят перепутанные строки, столбцы и направление вращения.
  */
  it("после U верхний ряд каждой боковой грани приходит с соседней грани", () => {
    const facelets = stateToFacelets(applyNotation("U"));
    const topRow = (face: number): string =>
      [0, 1, 2].map((column) => facelets[face * 9 + column]).join("");

    expect(topRow(1)).toBe("BBB"); // R получает ряд тыла
    expect(topRow(2)).toBe("RRR"); // F получает ряд права
    expect(topRow(4)).toBe("FFF"); // L получает ряд фронта
    expect(topRow(5)).toBe("LLL"); // B получает ряд лева
  });

  it("после R правый столбец U приходит с фронта, а левый столбец B — с верха", () => {
    const facelets = stateToFacelets(applyNotation("R"));

    expect([2, 5, 8].map((index) => facelets[index]).join("")).toBe("FFF"); // правый столбец U
    expect([20, 23, 26].map((index) => facelets[index]).join("")).toBe("DDD"); // правый столбец F
    expect([29, 32, 35].map((index) => facelets[index]).join("")).toBe("BBB"); // правый столбец D
    expect([45, 48, 51].map((index) => facelets[index]).join("")).toBe("UUU"); // левый столбец B
  });
});

describe("checkFacelets принимает настоящие кубики", () => {
  it("принимает собранный куб", () => {
    expect(equals(accept(read(SOLVED_TEXT)), SOLVED_CUBE)).toBe(true);
  });

  it("по раскраске после скрамбла восстанавливает то же состояние, что даёт движок", () => {
    for (const scramble of SCRAMBLES) {
      const expected = applyNotation(scramble);
      const restored = accept(stateToFacelets(expected));
      expect(equals(restored, expected)).toBe(true);
    }
  });

  it("возвращает состояние, раскраска которого совпадает с введённой", () => {
    for (const scramble of SCRAMBLES) {
      const facelets = stateToFacelets(applyNotation(scramble));
      expect(write(stateToFacelets(accept(facelets)))).toBe(write(facelets));
    }
  });
});

describe("checkFacelets отвергает невозможные кубики", () => {
  it("видит неверное число наклеек цвета", () => {
    const problems = reject(paint(SOLVED_TEXT, { [URF[2]]: "U" }));
    expect(problems.some((problem) => problem.kind === "colourCount")).toBe(true);
    expect(problems.some((problem) => problem.message.includes("Белых наклеек 10"))).toBe(true);
    expect(problems.some((problem) => problem.message.includes("Зелёных наклеек 8"))).toBe(true);
  });

  it("видит центр не того цвета", () => {
    const problems = reject(paint(SOLVED_TEXT, { [U_CENTRE]: "F", [F_CENTRE]: "U" }));
    expect(problems.every((problem) => problem.kind === "centre")).toBe(true);
    expect(problems).toHaveLength(2);
  });

  it("видит уголок с двумя противоположными цветами", () => {
    // Красный и оранжевый на одной детали не встречаются; счёт цветов при этом сходится.
    const problems = reject(paint(SOLVED_TEXT, { [URF[2]]: "L", 41: "F" }));
    const corner = problems.find((problem) => problem.facelets.includes(URF[2]));

    expect(corner?.kind).toBe("impossiblePiece");
    expect(corner?.message).toContain("напротив");
  });

  it("видит уголок, собранный зеркально", () => {
    // Верх и низ поменяны местами на двух уголках: цвета настоящие, порядок — нет.
    const problems = reject(paint(SOLVED_TEXT, { [URF[0]]: "D", 27: "U" }));
    expect(problems.some((problem) => problem.kind === "impossiblePiece")).toBe(true);
  });

  it("видит две одинаковые детали", () => {
    const problems = reject(paint(SOLVED_TEXT, { [UL[1]]: "R", [FR[1]]: "L" }));
    const duplicates = problems.filter((problem) => problem.kind === "duplicatePiece");

    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0].message).toContain("в двух местах");
  });

  it("видит перевёрнутый уголок", () => {
    const problems = reject(
      paint(SOLVED_TEXT, { [URF[0]]: "F", [URF[1]]: "U", [URF[2]]: "R" })
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("cornerTwist");
    // Повёрнут ровно один уголок, поэтому его видно и можно подсветить.
    expect(problems[0].facelets).toEqual([...URF]);
  });

  it("видит перевёрнутое ребро", () => {
    const problems = reject(paint(SOLVED_TEXT, { [UF[0]]: "F", [UF[1]]: "U" }));

    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("edgeFlip");
    expect(problems[0].facelets).toEqual([...UF]);
  });

  it("видит две переставленные детали", () => {
    const problems = reject(
      paint(SOLVED_TEXT, { [UR[1]]: "F", [UF[1]]: "R" })
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("swap");
  });

  it("не принимает раскраску не из 54 наклеек", () => {
    expect(reject(read(SOLVED_TEXT).slice(0, 53))[0].kind).toBe("wrongInput");
  });

  it("не принимает посторонний цвет", () => {
    const facelets = read(SOLVED_TEXT);
    facelets[0] = "X" as Sticker;
    expect(reject(facelets)[0].kind).toBe("wrongInput");
  });
});

describe("сообщения об ошибках", () => {
  const ALL_PROBLEMS: readonly FaceletProblem[] = [
    paint(SOLVED_TEXT, { [URF[2]]: "U" }),
    paint(SOLVED_TEXT, { [U_CENTRE]: "F", [F_CENTRE]: "U" }),
    paint(SOLVED_TEXT, { [URF[2]]: "L", 41: "F" }),
    paint(SOLVED_TEXT, { [URF[0]]: "D", 27: "U" }),
    paint(SOLVED_TEXT, { [UL[1]]: "R", [FR[1]]: "L" }),
    paint(SOLVED_TEXT, { [URF[0]]: "F", [URF[1]]: "U", [URF[2]]: "R" }),
    paint(SOLVED_TEXT, { [UF[0]]: "F", [UF[1]]: "U" }),
    paint(SOLVED_TEXT, { [UR[1]]: "F", [UF[1]]: "R" }),
  ].flatMap((facelets) => reject(facelets));

  it("написаны по-человечески, без внутренних терминов", () => {
    const jargon = [
      "перестанов",
      "чётност",
      "ориентаци",
      "инвариант",
      "permutation",
      "parity",
      "orientation",
      "facelet",
      "cubie",
      "URF",
      "state",
    ];

    for (const problem of ALL_PROBLEMS) {
      for (const word of jargon) {
        expect(problem.message.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });

  it("заканчиваются точкой и начинаются с большой буквы", () => {
    for (const problem of ALL_PROBLEMS) {
      expect(problem.message).toMatch(/^[А-ЯЁ]/);
      expect(problem.message.trimEnd()).toMatch(/[.!?]$/);
    }
  });

  it("показывают на наклейки, которые стоит проверить", () => {
    for (const problem of ALL_PROBLEMS) {
      for (const index of problem.facelets) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(54);
      }
    }
  });
});
