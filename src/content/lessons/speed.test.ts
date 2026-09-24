import { CORNERS, CORNER_INDEX, CubeState, EDGES, EDGE_INDEX, SOLVED_CUBE } from "@/lib/cube/state";
import { Face, applyNotation } from "@/lib/cube/moves";
import {
  areLastLayerCornersPlaced,
  cornerColour,
  edgeColour,
  isCrossSolved,
  isLastLayerCrossFormed,
  isLastLayerOriented,
  isSolved,
} from "@/lib/cube/predicates";
import { cornersUp, edgesUp, headlights, lastLayerView } from "@/lib/cube/lastLayer";
import { ALGORITHMS, repeat } from "./algorithms";
import { edgeShape, movedPieces } from "./caseText";
import { fullOrientationLessons } from "./fullOrientation";
import { fullPermutationLessons } from "./fullPermutation";
import { COURSE, LESSONS, getLesson, isLessonOpen, prerequisiteOf } from "./index";
import { pairsLesson } from "./pairs";
import {
  CORNER_ORIENTATION,
  CORNER_PERMUTATION,
  EDGE_ORIENTATION,
  EDGE_PERMUTATION,
  ORIENTATION_CASES,
  PERMUTATION_CASES,
  type CaseAlgorithm,
} from "./speedAlgorithms";
import { twoLookOrientationLesson, twoLookPermutationLesson } from "./twoLook";
import type { Lesson } from "./types";

/**
 * Скоростной блок курса.
 *
 * `lessons.test.ts` уже проверяет каждый шаг: алгоритм доводит показанную
 * позицию до цели. Здесь — то, чего по одному шагу не увидеть: что наборы
 * алгоритмов полные и без дублей. Это утверждается перебором, а не списком
 * «ожидаемых» случаев: строятся все позиции последнего слоя, какие бывают у
 * настоящего кубика с собранными двумя нижними слоями, и для каждой
 * выясняется, какие алгоритмы набора её решают с поворотом верхнего слоя до
 * (и, где это часть приёма, после). Ответ обязан быть ровно один.
 */

/* ------------------------------------------------ позиции последнего слоя */

const TOP = [0, 1, 2, 3];
const AUF = ["", "U", "U2", "U'"] as const;

/** Два нижних слоя собраны, верх — как сказано. */
function topLayer(cp: number[], co: number[], ep: number[], eo: number[]): CubeState {
  return {
    cornerPermutation: [...cp, 4, 5, 6, 7],
    cornerOrientation: [...co, 0, 0, 0, 0],
    edgePermutation: [...ep, 4, 5, 6, 7, 8, 9, 10, 11],
    edgeOrientation: [...eo, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

function permutations(items: number[]): number[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])
  );
}

const parity = (p: number[]): number =>
  p.reduce((count, a, i) => count + p.slice(i + 1).filter((b) => b < a).length, 0) % 2;

const digits = (value: number, base: number): number[] =>
  TOP.map((position) => Math.floor(value / base ** position) % base);

/**
 * Все 216 узоров ориентации: сумма поворотов углов кратна трём, перевёрнутых
 * рёбер чётное число. Других у настоящего кубика не бывает.
 */
const ORIENTATIONS: CubeState[] = Array.from({ length: 81 }, (_, c) => digits(c, 3))
  .filter((co) => co.reduce((a, b) => a + b) % 3 === 0)
  .flatMap((co) =>
    Array.from({ length: 16 }, (_, e) => digits(e, 2))
      .filter((eo) => eo.reduce((a, b) => a + b) % 2 === 0)
      .map((eo) => topLayer(TOP, co, TOP, eo))
  );

/** Все 288 перестановок верха: чётности углов и рёбер совпадают. */
const PERMUTATIONS: CubeState[] = permutations(TOP).flatMap((cp) =>
  permutations(TOP)
    .filter((ep) => parity(ep) === parity(cp))
    .map((ep) => topLayer(cp, [0, 0, 0, 0], ep, [0, 0, 0, 0]))
);

type Goal = (state: CubeState) => boolean;

/** Алгоритмы набора, решающие позицию: поворот верха, алгоритм и, если можно, ещё поворот. */
function solvers(state: CubeState, set: readonly CaseAlgorithm[], goal: Goal, turnAfter: boolean) {
  const after = turnAfter ? AUF : [""];
  return set
    .filter(({ algorithm }) =>
      AUF.some((before) =>
        after.some((turn) => goal(applyNotation(`${before} ${algorithm} ${turn}`, state)))
      )
    )
    .map(({ id }) => id);
}

/**
 * Полнота и отсутствие дублей разом: каждая позиция, где цель ещё не
 * достигнута, решается ровно одним алгоритмом, и каждый алгоритм что-то
 * решает.
 */
function expectExactCover(
  states: readonly CubeState[],
  set: readonly CaseAlgorithm[],
  goal: Goal,
  turnAfter: boolean
) {
  const done = (state: CubeState) =>
    (turnAfter ? AUF : [""]).some((turn) => goal(applyNotation(turn, state)));
  const open = states.filter((state) => !done(state));
  const used = new Set<string>();

  const misses = open
    .map((state) => ({ state, ids: solvers(state, set, goal, turnAfter) }))
    .filter(({ ids }) => {
      ids.forEach((id) => used.add(id));
      return ids.length !== 1;
    });

  expect(open.length).toBeGreaterThan(0);
  // Пустой список — полнота, по одному — нет дублей.
  expect(misses.map(({ ids }) => ids)).toEqual([]);
  expect([...used].sort()).toEqual(set.map(({ id }) => id).sort());
}

const oriented = (state: CubeState) => state.edgeOrientation.slice(0, 4).every((flip) => flip === 0);
const cornersHome = (state: CubeState) => TOP.every((slot) => state.cornerPermutation[slot] === slot);

describe("перебор позиций", () => {
  it("находит все узоры и все перестановки верха", () => {
    expect(ORIENTATIONS).toHaveLength(216);
    expect(PERMUTATIONS).toHaveLength(288);
  });
});

describe("наборы полные и без дублей", () => {
  it("крест в первый заход: три алгоритма на все узоры рёбер", () => {
    expectExactCover(ORIENTATIONS, EDGE_ORIENTATION, (s) => isLastLayerCrossFormed(s, "U"), false);
  });

  it("углы во второй заход: семь алгоритмов на все узоры углов при готовом кресте", () => {
    expectExactCover(
      ORIENTATIONS.filter(oriented),
      CORNER_ORIENTATION,
      (s) => isLastLayerOriented(s, "U"),
      false
    );
  });

  it("углы расстановки: два алгоритма на все перестановки углов", () => {
    expectExactCover(PERMUTATIONS, CORNER_PERMUTATION, (s) => areLastLayerCornersPlaced(s, "U"), true);
  });

  it("рёбра расстановки: четыре алгоритма на все перестановки рёбер при стоящих углах", () => {
    expectExactCover(PERMUTATIONS.filter(cornersHome), EDGE_PERMUTATION, isSolved, true);
  });

  it("полная ориентация: 57 алгоритмов на все 216 узоров", () => {
    expect(ORIENTATION_CASES).toHaveLength(57);
    expectExactCover(ORIENTATIONS, ORIENTATION_CASES, (s) => isLastLayerOriented(s, "U"), false);
  });

  it("полная расстановка: 21 алгоритм на все 288 перестановок", () => {
    expect(PERMUTATION_CASES).toHaveLength(21);
    expectExactCover(PERMUTATIONS, PERMUTATION_CASES, isSolved, true);
  });

  it.each([
    ["крест", EDGE_ORIENTATION],
    ["углы", CORNER_ORIENTATION],
    ["углы расстановки", CORNER_PERMUTATION],
    ["рёбра расстановки", EDGE_PERMUTATION],
    ["полная ориентация", ORIENTATION_CASES],
    ["полная расстановка", PERMUTATION_CASES],
  ] as const)("%s: идентификаторы и записи уникальны", (_, set) => {
    expect(new Set(set.map(({ id }) => id)).size).toBe(set.length);
    expect(new Set(set.map(({ algorithm }) => algorithm)).size).toBe(set.length);
  });
});

/* ---------------------------------------------------------- уроки и наборы */

const ids = (lessons: readonly Lesson[]) => lessons.flatMap((lesson) => lesson.steps.map((step) => step.id));
const start = (setup: string) => applyNotation(setup);

describe("уроки учат ровно своим наборам", () => {
  it("два захода ориентации — три алгоритма креста и семь углов", () => {
    expect(twoLookOrientationLesson.steps.map((step) => step.algorithm)).toEqual(
      [...EDGE_ORIENTATION, ...CORNER_ORIENTATION].map(({ algorithm }) => algorithm)
    );
  });

  it("два захода расстановки — два алгоритма углов и четыре рёбер", () => {
    expect(twoLookPermutationLesson.steps.map((step) => step.algorithm)).toEqual(
      [...CORNER_PERMUTATION, ...EDGE_PERMUTATION].map(({ algorithm }) => algorithm)
    );
  });

  it("четыре урока полной ориентации вместе — весь набор, каждый случай один раз", () => {
    expect(ids(fullOrientationLessons).sort()).toEqual(ORIENTATION_CASES.map(({ id }) => id).sort());
  });

  it.each([
    ["orientation-cross", "cross", 7],
    ["orientation-line", "line", 15],
    ["orientation-angle", "angle", 27],
    ["orientation-dot", "dot", 8],
  ] as const)("%s: %s, случаев — %i, как обещает описание", (slug, shape, count) => {
    const lesson = getLesson(slug)!;
    expect(lesson.steps).toHaveLength(count);
    lesson.steps.forEach((step) => expect(edgeShape(start(step.setup))).toBe(shape));
  });

  it("два урока полной расстановки вместе — весь набор, каждый случай один раз", () => {
    expect(ids(fullPermutationLessons).sort()).toEqual(PERMUTATION_CASES.map(({ id }) => id).sort());
  });

  it("одни углы или одни рёбра — семь случаев, и среди них четыре знакомых по рёбрам", () => {
    const single = getLesson("permutation-single")!;
    expect(single.steps).toHaveLength(7);
    single.steps.forEach((step) => expect(movedPieces(start(step.setup))).not.toBe("both"));
    expect(single.steps.filter((step) => movedPieces(start(step.setup)) === "edges")).toHaveLength(4);
    expect(single.steps.filter((step) => movedPieces(start(step.setup)) === "corners")).toHaveLength(3);
  });

  it("углы и рёбра вместе — четырнадцать случаев", () => {
    const both = getLesson("permutation-both")!;
    expect(both.steps).toHaveLength(14);
    both.steps.forEach((step) => expect(movedPieces(start(step.setup))).toBe("both"));
  });

  it.each(COURSE.find((block) => block.id === "speed")!.lessons.map((lesson) => [lesson.slug, lesson]))(
    "%s: названия шагов не повторяются",
    (_, lesson) => {
      const titles = lesson.steps.map((step) => step.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  );

  it("каждый урок скоростного блока говорит, что замерять на таймере", () => {
    COURSE.find((block) => block.id === "speed")!.lessons.forEach((lesson) =>
      expect(lesson.practice?.length ?? 0).toBeGreaterThan(40)
    );
  });

  it("у уроков последнего слоя есть схема, у пар — нет", () => {
    expect(pairsLesson.diagram).toBeUndefined();
    [twoLookOrientationLesson, ...fullOrientationLessons].forEach((lesson) =>
      expect(lesson.diagram).toBe("orientation")
    );
    [twoLookPermutationLesson, ...fullPermutationLessons].forEach((lesson) =>
      expect(lesson.diagram).toBe("permutation")
    );
  });
});

/* ------------------------------------------------- имена не врут про случай */

const stepOf = (lesson: Lesson, id: string) => lesson.steps.find((step) => step.id === id)!;
const startOf = (lesson: Lesson, id: string) => start(stepOf(lesson, id).setup);

/** Сколько белых наклеек на верхнем ряду каждой стороны: F R B L. */
const whiteOnSides = (state: CubeState) => {
  const view = lastLayerView(state);
  return (["F", "R", "B", "L"] as const).map(
    (side) => view.sides[side].filter((colour) => colour === "U").length
  );
};

describe("крест в первый заход: объяснения совпадают с позицией", () => {
  const lesson = twoLookOrientationLesson;

  it("линия стоит поперёк, слева направо", () => {
    expect(edgesUp(startOf(lesson, "line"))).toEqual(["R", "L"]);
  });

  it("уголок стоит сзади и слева", () => {
    expect(edgesUp(startOf(lesson, "angle"))).toEqual(["B", "L"]);
  });

  it("точка: алгоритм линии делает уголок, U2 ставит его сзади слева", () => {
    const dot = startOf(lesson, "dot");
    expect(edgesUp(dot)).toEqual([]);

    const afterLine = applyNotation(ALGORITHMS.lastCross, dot);
    expect(edgeShape(afterLine)).toBe("angle");
    expect(edgesUp(applyNotation("U2", afterLine))).toEqual(["B", "L"]);
  });

  it("линия — тот же алгоритм, что в уроке про крест", () => {
    expect(stepOf(lesson, "line").algorithm).toBe(ALGORITHMS.lastCross);
  });
});

describe("углы во второй заход: имена совпадают с узором", () => {
  const lesson = twoLookOrientationLesson;
  const upCount = (id: string) => cornersUp(startOf(lesson, id)).length;

  it("рыбка — знакомый алгоритм из метода слоёв, один угол вверх", () => {
    expect(stepOf(lesson, "fish").algorithm).toBe(ALGORITHMS.lastFace);
    expect(upCount("fish")).toBe(1);
    expect(upCount("fish-back")).toBe(1);
  });

  it("две пары фар: углов вверх нет, белое — парами на двух противоположных сторонах", () => {
    expect(upCount("two-pairs")).toBe(0);
    const sides = whiteOnSides(startOf(lesson, "two-pairs"));
    expect([sides[0] + sides[2], sides[1] + sides[3]].sort()).toEqual([0, 4]);
    expect(sides.filter((count) => count === 2)).toHaveLength(2);
  });

  it("фары сбоку: углов вверх нет, фары только на одной стороне", () => {
    expect(upCount("pair-and-two")).toBe(0);
    expect(whiteOnSides(startOf(lesson, "pair-and-two")).filter((count) => count === 2)).toHaveLength(1);
  });

  it("фары: два соседних угла вверх, белое остальных — на одной стороне", () => {
    expect(upCount("headlights")).toBe(2);
    expect(whiteOnSides(startOf(lesson, "headlights")).sort()).toEqual([0, 0, 0, 2]);
  });

  it("буква Т: два соседних угла вверх, белое остальных — на противоположных сторонах", () => {
    const state = startOf(lesson, "letter-t");
    expect(upCount("letter-t")).toBe(2);
    const sides = whiteOnSides(state);
    expect(sides.filter((count) => count === 1)).toHaveLength(2);
    expect(sides[0] === sides[2] || sides[1] === sides[3]).toBe(true);
  });

  it("бабочка: два угла вверх — по диагонали", () => {
    const up = cornersUp(startOf(lesson, "bowtie"));
    expect(up).toHaveLength(2);
    const diagonal = [["URF", "ULB"], ["UFL", "UBR"]].some((pair) => pair.every((slot) => up.includes(slot as never)));
    expect(diagonal).toBe(true);
  });
});

describe("расстановка в два захода: имена совпадают с позицией", () => {
  const lesson = twoLookPermutationLesson;

  it("фары стоят сзади, и это алгоритм углов из метода слоёв", () => {
    expect(headlights(lastLayerView(startOf(lesson, "headlights")))).toEqual(["B"]);
    expect(stepOf(lesson, "headlights").algorithm).toBe(ALGORITHMS.lastCorners);
  });

  it("по диагонали фар нет нигде", () => {
    expect(headlights(lastLayerView(startOf(lesson, "diagonal")))).toEqual([]);
  });

  /** Куда алгоритм уносит ребро с места `from`, если смотреть на собранный куб. */
  const destination = (algorithm: string, from: "UF" | "UR" | "UB" | "UL") => {
    const after = applyNotation(algorithm);
    return EDGES[after.edgePermutation.indexOf(EDGE_INDEX[from])];
  };

  it("три ребра по часовой и против часовой — направление сверху", () => {
    // Места рёбер по часовой, если смотреть сверху: так их обходит U.
    const clockwise = ["UF", "UL", "UB", "UR"] as const;
    expect(destination("U", "UF")).toBe("UL");

    /** Каждое сдвинутое ребро уходит на следующее сдвинутое место в сторону `step`. */
    const cycles = (algorithm: string, step: 1 | 3) => {
      const moved = clockwise.filter((slot) => destination(algorithm, slot) !== slot);
      expect(moved).toHaveLength(3);
      moved.forEach((slot) => {
        let index = clockwise.indexOf(slot);
        do index = (index + step) % 4;
        while (!moved.includes(clockwise[index]));
        expect(destination(algorithm, slot)).toBe(clockwise[index]);
      });
    };

    cycles(stepOf(lesson, "ub").algorithm, 1);
    cycles(stepOf(lesson, "ua").algorithm, 3);
  });

  it("две пары напротив и две пары рядом", () => {
    const pairs = (algorithm: string) =>
      (["UF", "UR", "UB", "UL"] as const).map((slot) => [slot, destination(algorithm, slot)]);
    const opposite = { UF: "UB", UB: "UF", UR: "UL", UL: "UR" } as const;

    pairs(stepOf(lesson, "h").algorithm).forEach(([from, to]) =>
      expect(to).toBe(opposite[from as keyof typeof opposite])
    );
    pairs(stepOf(lesson, "z").algorithm).forEach(([from, to]) => {
      expect(to).not.toBe(from);
      expect(to).not.toBe(opposite[from as keyof typeof opposite]);
    });
  });
});

/* ------------------------------------------------------------ пары */

/** Где стоит деталь зелёно-красной пары и какой цвет у неё на каждой грани места. */
function pairPieces(state: CubeState) {
  const cornerSlot = CORNERS[state.cornerPermutation.indexOf(CORNER_INDEX.DFR)];
  const edgeSlot = EDGES[state.edgePermutation.indexOf(EDGE_INDEX.FR)];
  const cornerFaces = Object.fromEntries(
    [...cornerSlot].map((face) => [face, cornerColour(state, cornerSlot, face as Face)])
  );
  const edgeFaces = Object.fromEntries(
    [...edgeSlot].map((face) => [face, edgeColour(state, edgeSlot, face as Face)])
  );
  return { cornerSlot, cornerFaces, edgeSlot, edgeFaces };
}

describe("пары: объяснения описывают ту позицию, что на кубе", () => {
  const pieces = (id: string) => pairPieces(startOf(pairsLesson, id));

  it.each([
    // шаг, где угол, его цвета, где ребро, его цвета
    ["joined-right", "URF", { U: "F", R: "R", F: "D" }, "UR", { U: "F", R: "R" }],
    ["joined-front", "URF", { U: "R", F: "F", R: "D" }, "UF", { U: "R", F: "F" }],
    ["corner-right-edge-back", "URF", { R: "D" }, "UB", { U: "F" }],
    ["corner-front-edge-left", "URF", { F: "D" }, "UL", { U: "R" }],
    ["split", "URF", { U: "R" }, "UR", { U: "F" }],
    ["yellow-up", "URF", { U: "D" }, "UR", {}],
    ["corner-home", "DFR", { D: "D", F: "F", R: "R" }, "UF", { U: "R" }],
    ["edge-home", "URF", { U: "D" }, "FR", { F: "F", R: "R" }],
    ["both-in-slot", "DFR", { F: "D" }, "FR", { F: "F", R: "R" }],
  ])("%s: угол %s, ребро %s", (id, cornerSlot, cornerFaces, edgeSlot, edgeFaces) => {
    const actual = pieces(id);
    expect(actual.cornerSlot).toBe(cornerSlot);
    expect(actual.cornerFaces).toMatchObject(cornerFaces);
    expect(actual.edgeSlot).toBe(edgeSlot);
    expect(actual.edgeFaces).toMatchObject(edgeFaces);
  });

  it("рядом, но не пара: после U' R U' R' U — знакомый случай «угол над местом, жёлтым вправо»", () => {
    expect(pairPieces(applyNotation("U' R U' R' U", startOf(pairsLesson, "split")))).toEqual(
      pieces("corner-right-edge-back")
    );
    expect(stepOf(pairsLesson, "split").algorithm.endsWith("R U R'")).toBe(true);
  });

  it("жёлтое вверх: после R U2 R' U' — тот же знакомый случай", () => {
    expect(pairPieces(applyNotation("R U2 R' U'", startOf(pairsLesson, "yellow-up")))).toEqual(
      pieces("corner-right-edge-back")
    );
  });

  it("угол на месте — алгоритм среднего слоя, ребро на месте — угол первого слоя трижды", () => {
    expect(stepOf(pairsLesson, "corner-home").algorithm).toBe(ALGORITHMS.edgeRight);
    expect(stepOf(pairsLesson, "edge-home").algorithm).toBe(repeat(ALGORITHMS.corner, 3));
  });

  it("пара на месте неправильно: R U' R' поднимает наверх и угол, и ребро", () => {
    const lifted = pairPieces(applyNotation("R U' R'", startOf(pairsLesson, "both-in-slot")));
    expect(lifted.cornerSlot.startsWith("U")).toBe(true);
    expect(lifted.edgeSlot.startsWith("U")).toBe(true);
  });
});

/* ------------------------------------------------------ порядок курса */

describe("курс проходится подряд", () => {
  const layers = COURSE.find((block) => block.id === "layers")!;
  const speed = COURSE.find((block) => block.id === "speed")!;
  const lastLayerLesson = layers.lessons[layers.lessons.length - 1];

  it("скоростной блок идёт после метода слоёв, и LESSONS — это блоки подряд", () => {
    expect(COURSE.map((block) => block.id)).toEqual(["layers", "speed"]);
    expect(LESSONS).toEqual([...layers.lessons, ...speed.lessons]);
  });

  it("скоростной блок открывается после урока, которым собирается весь куб", () => {
    expect(speed.opensAfter).toBe(lastLayerLesson.slug);
    // Последний шаг этого урока — собранный куб.
    expect(lastLayerLesson.steps[lastLayerLesson.steps.length - 1].goal).toEqual({ kind: "solved" });
  });

  it("метод слоёв открыт сразу", () => {
    layers.lessons.forEach((lesson) => {
      expect(prerequisiteOf(lesson.slug)).toBeUndefined();
      expect(isLessonOpen(lesson.slug, () => false)).toBe(true);
    });
  });

  it("скоростные уроки закрыты, пока куб не собран уроком целиком", () => {
    const passed = new Set(layers.lessons.slice(0, -1).map((lesson) => lesson.slug));
    speed.lessons.forEach((lesson) => {
      expect(prerequisiteOf(lesson.slug)).toBe(lastLayerLesson);
      expect(isLessonOpen(lesson.slug, () => false)).toBe(false);
      // Все уроки, кроме последнего, пройдены — всё равно закрыт.
      expect(isLessonOpen(lesson.slug, (slug) => passed.has(slug))).toBe(false);
      expect(isLessonOpen(lesson.slug, (slug) => slug === lastLayerLesson.slug)).toBe(true);
    });
  });

  it("ни один шаг блока не начинается без креста: блок учит то, что после него", () => {
    speed.lessons.forEach((lesson) =>
      lesson.steps.forEach((step) => expect(isCrossSolved(start(step.setup), "D")).toBe(true))
    );
  });

  it("нет урока скоростного блока со стартом из собранного куба", () => {
    speed.lessons.forEach((lesson) =>
      lesson.steps.forEach((step) => expect(start(step.setup)).not.toEqual(SOLVED_CUBE))
    );
  });
});
