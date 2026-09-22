import { CORNERS, Corner, EDGES, Edge, SOLVED_CUBE } from "./state";
import { FACES, Face, applyNotation, formatSequence, parseSequence } from "./moves";
import { cornerColour, edgeColour } from "./predicates";
import {
  SIDES,
  cornerSeen,
  edgeSeen,
  frameCorner,
  frameEdge,
  frameFace,
  inFrame,
  realCorner,
  realEdge,
} from "./frames";
import { ALGORITHMS } from "@/content/lessons/algorithms";

/**
 * Поворот куба в руках — это переименование, и проверять его нужно не
 * примерами, а свойством: кубик, повёрнутый в руках и обработанный
 * переименованным алгоритмом, обязан выглядеть для держащего ровно так же, как
 * непокрученный кубик после исходного алгоритма. Если это правда для каждой
 * наклейки, каждого алгоритма курса и каждой из четырёх сторон, значит
 * переименование верное — и решателю можно применять алгоритм урока с любой
 * стороны.
 */

const ALL = Object.values(ALGORITHMS);

const tidy = (notation: string) => formatSequence(parseSequence(notation));

describe("поворот куба в руках как переименование нотации", () => {
  it("лицом вперёд ничего не меняет", () => {
    ALL.forEach((algorithm) => expect(inFrame(algorithm, "F")).toBe(tidy(algorithm)));
  });

  it("четыре поворота в одну сторону возвращают алгоритм как был", () => {
    ALL.forEach((algorithm) => {
      const round = SIDES.reduce((notation) => inFrame(notation, "R"), algorithm);

      expect(round).toBe(tidy(algorithm));
    });
  });

  it("читается глазами: тот же алгоритм с правой стороны", () => {
    expect(inFrame("R U R' U'", "R")).toBe("B U B' U'");
    expect(inFrame("F R U R' U' F'", "B")).toBe("B L U L' U' B'");
  });

  it("верх и низ не двигаются: курс не переворачивает кубик ни разу", () => {
    SIDES.forEach((front) => {
      expect(inFrame("U D2 U'", front)).toBe("U D2 U'");
    });
  });

  it("имена граней и слотов переводятся в обе стороны", () => {
    SIDES.forEach((front) => {
      FACES.forEach((face) => expect(frameFace(inFrame(face, front) as Face, front)).toBe(face));
      EDGES.forEach((slot) => expect(frameEdge(realEdge(slot, front), front)).toBe(slot));
      CORNERS.forEach((slot) => expect(frameCorner(realCorner(slot, front), front)).toBe(slot));
    });
  });

  it("называет слоты так же, как их назвал бы держащий кубик", () => {
    expect(realEdge("UF", "R")).toBe("UR");
    expect(realEdge("FR", "L")).toBe("FL");
    expect(realCorner("URF", "R")).toBe("UBR");
    expect(realCorner("DFR", "B")).toBe("DBL");
  });
});

describe("переименованный алгоритм делает с повёрнутым кубом то же самое", () => {
  const cases = ALL.flatMap((algorithm) => SIDES.map((front) => ({ algorithm, front })));

  it.each(cases)("$algorithm со стороны $front", ({ algorithm, front }) => {
    const plain = applyNotation(algorithm, SOLVED_CUBE);
    const turned = applyNotation(inFrame(algorithm, front), SOLVED_CUBE);

    EDGES.forEach((slot: Edge) =>
      [...slot].forEach((face) =>
        expect(edgeSeen(turned, front, slot, face as Face)).toBe(edgeColour(plain, slot, face as Face))
      )
    );
    CORNERS.forEach((slot: Corner) =>
      [...slot].forEach((face) =>
        expect(cornerSeen(turned, front, slot, face as Face)).toBe(
          cornerColour(plain, slot, face as Face)
        )
      )
    );
  });
});
