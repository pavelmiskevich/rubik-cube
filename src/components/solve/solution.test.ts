import { LESSONS } from "@/content/lessons";
import { applyNotation, parseSequence } from "@/lib/cube/moves";
import { SOLVED_CUBE } from "@/lib/cube/state";
import { moveCount, solutionFor } from "./solution";

const SCRAMBLE = "R U R' U' F2 L D' B R2 F U2";

describe("solutionFor", () => {
  it("у собранного кубика решения нет", () => {
    expect(solutionFor(SOLVED_CUBE)).toEqual({ kind: "solved" });
  });

  it("разбирает положение на шаги курса", () => {
    const solution = solutionFor(applyNotation(SCRAMBLE));

    expect(solution.kind).toBe("steps");
    if (solution.kind !== "steps") return;

    expect(solution.steps.length).toBeGreaterThan(0);
    for (const step of solution.steps) {
      expect(step.title).not.toHaveLength(0);
      expect(step.moves).not.toHaveLength(0);
    }
  });

  it("ведёт каждый шаг на урок, который его объясняет", () => {
    const solution = solutionFor(applyNotation(SCRAMBLE));
    if (solution.kind !== "steps") throw new Error("ожидались шаги");

    const slugs = new Set(LESSONS.map((lesson) => lesson.slug));
    for (const step of solution.steps) {
      // Ссылка на несуществующий урок — 404 в лицо человеку, который к нему пошёл.
      expect(slugs.has(step.lessonSlug)).toBe(true);
      expect(step.href).toBe(`/learn/${step.lessonSlug}`);
    }
  });

  it("считает ходы так же, как их понимает движок", () => {
    const solution = solutionFor(applyNotation(SCRAMBLE));
    if (solution.kind !== "steps") throw new Error("ожидались шаги");

    let total = 0;
    for (const step of solution.steps) {
      const moves = parseSequence(step.moves).length;
      expect(step.count).toBe(moves);
      total += moves;
    }

    expect(solution.total).toBe(total);
  });

  it("не падает на положении, которого не бывает", () => {
    // Одно перевёрнутое ребро: проверка раскраски такое отсеивает, но если две
    // проверки когда-нибудь разойдутся, экран обязан сказать это словами, а не
    // сломаться.
    const flipped = {
      ...SOLVED_CUBE,
      edgeOrientation: SOLVED_CUBE.edgeOrientation.map((value, slot) => (slot === 0 ? 1 : value)),
    };

    expect(solutionFor(flipped)).toEqual({ kind: "failed" });
  });
});

describe("moveCount", () => {
  it("склоняет ходы по-русски", () => {
    expect(moveCount(1)).toBe("1 ход");
    expect(moveCount(2)).toBe("2 хода");
    expect(moveCount(4)).toBe("4 хода");
    expect(moveCount(5)).toBe("5 ходов");
    expect(moveCount(11)).toBe("11 ходов");
    expect(moveCount(14)).toBe("14 ходов");
    expect(moveCount(21)).toBe("21 ход");
    expect(moveCount(22)).toBe("22 хода");
  });
});
