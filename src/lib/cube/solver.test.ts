import { CubeState, EDGE_INDEX, SOLVED_CUBE } from "./state";
import { Face, applyNotation, formatSequence, parseSequence } from "./moves";
import {
  areTwoLayersSolved,
  isCrossSolved,
  isFirstLayerSolved,
  isLastLayerCrossFormed,
  isLastLayerOriented,
  isSolved,
} from "./predicates";
import { LESSONS, getLesson } from "@/content/lessons";
import { solve } from "./solver";

/**
 * Проверка решателя, а не примеров.
 *
 * Решатель обязан довести до собранного куба не показанную позицию, а любую,
 * поэтому главный тест здесь — прогон по сотням случайных скрамблов. Генератор
 * случайных чисел свой, с фиксированным зерном: тест, который зависит от удачи,
 * однажды падает на чужой ветке и никогда не воспроизводится.
 *
 * Каждый шаг проверяется не только на то, что он достиг своей цели, но и на то,
 * что он не сломал цели всех предыдущих шагов: решатель, который собирает верх
 * ценой низа, ничему не учит.
 */

/** Детерминированный генератор: тот же, что в `method.test.ts`. */
function seeded(seed: number) {
  let value = seed;
  return (bound: number) => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value % bound;
  };
}

const TOKENS = ["U", "D", "L", "R", "F", "B"].flatMap((face) => [face, `${face}'`, `${face}2`]);

/** Случайные позиции: собранный куб плюс случайные повороты граней. */
function scrambles(count: number, length = 25, seed = 20260920): CubeState[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    let state = SOLVED_CUBE;
    for (let move = 0; move < length; move++) state = applyNotation(TOKENS[random(TOKENS.length)], state);
    return state;
  });
}

/** Ходы, которые не трогают крест: верхний и средний слой. */
const ABOVE_CROSS = "U R U' R' U' F' U F U2 R U R' U R U2 R'";

/** Цель шага — предикат курса, который после него обязан быть правдой. */
const GOALS: Readonly<Record<string, (state: CubeState) => boolean>> = {
  cross: (state) => isCrossSolved(state, "D"),
  "first-layer": (state) => isFirstLayerSolved(state, "D"),
  "second-layer": (state) => areTwoLayersSolved(state, "D"),
  "last-layer-cross": (state) => isLastLayerCrossFormed(state, "U"),
  "last-layer-face": (state) => isLastLayerOriented(state, "U"),
  "last-layer-permutation": isSolved,
};

/** Порядок шагов решения — это порядок уроков курса. */
const COURSE_ORDER = LESSONS.map((lesson) => lesson.slug).filter((slug) => slug in GOALS);

const moveCount = (moves: string) => parseSequence(moves).length;

/** Проигрывает решение шаг за шагом, проверяя цели по дороге. */
function play(state: CubeState): { state: CubeState; moves: number } {
  const steps = solve(state);
  const reached: string[] = [];
  let current = state;
  let moves = 0;

  steps.forEach((step) => {
    current = applyNotation(step.moves, current);
    moves += moveCount(step.moves);
    reached.push(step.lessonSlug);
    // Цель шага достигнута — и ни одна прежняя не потеряна.
    reached.forEach((slug) => expect([slug, GOALS[slug](current)]).toEqual([slug, true]));
  });

  return { state: current, moves };
}

describe("решатель: контракт вывода", () => {
  it("на собранном кубе выдаёт пустое решение, а не набор ходов", () => {
    expect(solve(SOLVED_CUBE)).toEqual([]);
  });

  it("каждый шаг назван словами курса и ведёт на существующий урок", () => {
    const steps = solve(applyNotation("R U R' U' F2 L D B' R2 U"));

    expect(steps.length).toBeGreaterThan(0);
    steps.forEach((step) => {
      const lesson = getLesson(step.lessonSlug);
      expect(lesson).toBeDefined();
      expect(step.title).toBe(lesson!.title);
      expect(step.moves.trim()).not.toBe("");
      // Ходы — разбираемая нотация курса, без срезов и поворотов куба.
      expect(formatSequence(parseSequence(step.moves))).toBe(step.moves);
    });
  });

  it("шаги идут в порядке уроков курса", () => {
    scrambles(20, 25, 7).forEach((state) => {
      const slugs = solve(state).map((step) => step.lessonSlug);

      expect(slugs).toEqual(COURSE_ORDER.filter((slug) => slugs.includes(slug)));
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  it("не выдаёт шаг, которого на этой позиции делать не нужно", () => {
    // Крест уже собран: уроку про крест в решении делать нечего.
    const state = applyNotation(ABOVE_CROSS);

    expect(isCrossSolved(state, "D")).toBe(true);
    expect(solve(state).map((step) => step.lessonSlug)).not.toContain("cross");
  });

  it("на одной и той же позиции даёт одно и то же решение и не трогает её саму", () => {
    const state = applyNotation("B2 D' F R2 U' L F' U2 R B");
    const before = JSON.stringify(state);

    expect(solve(state)).toEqual(solve(state));
    // Позиция пришла с экрана ввода и остаётся нужна тому, кто её ввёл.
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("решатель: любая собираемая позиция", () => {
  const cases = scrambles(300);

  it("строит по-настоящему перемешанные позиции", () => {
    expect(cases.filter((state) => isCrossSolved(state, "D"))).toHaveLength(0);
    expect(new Set(cases.map((state) => state.cornerPermutation.join(""))).size).toBeGreaterThan(290);
  });

  it("доводит каждую до собранного куба, не ломая собранного по дороге", () => {
    const lengths = cases.map((state) => {
      const { state: solved, moves } = play(state);
      expect(isSolved(solved)).toBe(true);
      return moves;
    });

    const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    // Послойная сборка длинная по устройству, но не бесконечная: если среднее
    // уедет вдвое, значит решатель перестал пользоваться правилами курса.
    expect(average).toBeLessThan(160);
    expect(Math.max(...lengths)).toBeLessThan(260);
  });

  it("решение применимо целиком: все шаги подряд от исходного состояния", () => {
    cases.slice(0, 50).forEach((state) => {
      const whole = solve(state)
        .map((step) => step.moves)
        .join(" ");

      expect(isSolved(applyNotation(whole, state))).toBe(true);
    });
  });
});

describe("решатель: позиции, до которых курс уже дошёл", () => {
  it("на почти собранном кубе выдаёт только оставшиеся уроки", () => {
    const state = applyNotation("R U' R U R U R U' R' U' R2");

    expect(areTwoLayersSolved(state, "D")).toBe(true);
    expect(solve(state).map((step) => step.lessonSlug)).toEqual(["last-layer-permutation"]);
  });

  it("продолжает с середины: решение, разрезанное пополам, доходит до конца", () => {
    scrambles(25, 25, 99).forEach((state) => {
      const steps = solve(state);
      const half = steps.slice(0, Math.ceil(steps.length / 2));
      const middle = applyNotation(half.map((step) => step.moves).join(" "), state);

      expect(isSolved(play(middle).state)).toBe(true);
    });
  });
});

describe("решатель: несобираемая позиция", () => {
  it("не зацикливается, а честно отказывается", () => {
    // Одно перевёрнутое ребро — на настоящем кубике такого не бывает.
    const impossible: CubeState = {
      ...SOLVED_CUBE,
      edgeOrientation: SOLVED_CUBE.edgeOrientation.map((flip, slot) =>
        slot === EDGE_INDEX.DF ? 1 : flip
      ),
    };

    expect(() => solve(impossible)).toThrow(/собрать/i);
  });
});

describe("решатель: ходы записаны экономно", () => {
  it("не оставляет подряд двух поворотов одной грани", () => {
    scrambles(40, 25, 4242).forEach((state) => {
      solve(state).forEach((step) => {
        const faces = parseSequence(step.moves).map((move) => move.face as Face);
        faces.forEach((face, index) => expect(face === faces[index - 1]).toBe(false));
      });
    });
  });
});
