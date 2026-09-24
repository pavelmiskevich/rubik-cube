import { FACELET_FACES, FACE_SIZE, faceletIndex, stateToFacelets } from "@/lib/cube/facelets";
import { applyNotation } from "@/lib/cube/moves";
import { SOLVED_CUBE } from "@/lib/cube/state";
import {
  CAPTURE_ORDER,
  HOLD_HINT,
  TOP_NEIGHBOUR,
  cameraSupport,
  problemOf,
  PROBLEM_TEXT,
} from "./capturePlan";

const SOLVED = stateToFacelets(SOLVED_CUBE);
const COLUMNS = Array.from({ length: FACE_SIZE }, (_, column) => column);

describe("порядок съёмки", () => {
  it("снимает каждую грань ровно один раз", () => {
    expect([...CAPTURE_ORDER].sort()).toEqual([...FACELET_FACES].sort());
  });

  it("у каждой грани есть подсказка, как держать кубик", () => {
    for (const face of FACELET_FACES) {
      expect(HOLD_HINT[face].length).toBeGreaterThan(10);
    }
  });

  /*
    Главное свойство экрана: строка снимка, которая сверху в кадре, — это
    нулевая строка грани на развёртке. Проверяется движком, а не глазами:
    поворот верхнего соседа двигает верхнюю строку грани и не трогает нижнюю.
  */
  it("грань, названная в подсказке верхней, прилегает к верхней строке снимка", () => {
    for (const face of FACELET_FACES) {
      const turned = stateToFacelets(applyNotation(TOP_NEIGHBOUR[face]));
      const moved = (row: number) =>
        COLUMNS.some(
          (column) =>
            turned[faceletIndex(face, row, column)] !== SOLVED[faceletIndex(face, row, column)]
        );

      expect(moved(0)).toBe(true);
      expect(moved(2)).toBe(false);
    }
  });

  it("верхняя грань снимка у боковых — белая, у белой — синяя, у жёлтой — зелёная", () => {
    expect(TOP_NEIGHBOUR).toEqual({ F: "U", R: "U", B: "U", L: "U", U: "B", D: "F" });
  });
});

describe("cameraSupport", () => {
  it("без защищённого соединения камеры нет", () => {
    expect(cameraSupport({ isSecureContext: false, hasGetUserMedia: false })).toBe("insecure");
  });

  it("без поддержки в браузере камеры нет", () => {
    expect(cameraSupport({ isSecureContext: true, hasGetUserMedia: false })).toBe("unsupported");
  });

  it("иначе можно просить", () => {
    expect(cameraSupport({ isSecureContext: true, hasGetUserMedia: true })).toBeNull();
  });
});

describe("problemOf", () => {
  const error = (name: string) => Object.assign(new Error(name), { name });

  it("отказ человека и запрет сайта — это отказ в доступе", () => {
    expect(problemOf(error("NotAllowedError"))).toBe("denied");
    expect(problemOf(error("SecurityError"))).toBe("denied");
  });

  it("нет камеры — так и говорит", () => {
    expect(problemOf(error("NotFoundError"))).toBe("missing");
    expect(problemOf(error("OverconstrainedError"))).toBe("missing");
  });

  it("камеру держит другое приложение", () => {
    expect(problemOf(error("NotReadableError"))).toBe("busy");
  });

  it("незнакомая ошибка — общая, но не пустая", () => {
    expect(problemOf("что-то странное")).toBe("failed");
    expect(problemOf(error("WeirdError"))).toBe("failed");
  });

  it("каждая беда объяснена и отправляет к ручному вводу", () => {
    for (const text of Object.values(PROBLEM_TEXT)) {
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.body).toMatch(/вручную/);
    }
  });
});
