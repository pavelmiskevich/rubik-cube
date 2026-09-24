import { applyNotation } from "@/lib/cube/moves";
import { ALGORITHMS, positionFor } from "./algorithms";
import { describeOrientation, describePermutation } from "./caseText";
import {
  CORNER_ORIENTATION,
  CORNER_PERMUTATION,
  EDGE_ORIENTATION,
  EDGE_PERMUTATION,
  type CaseAlgorithm,
} from "./speedAlgorithms";
import type { Lesson, LessonGoal, LessonStep } from "./types";

/**
 * Перемешивание, которое не трогает то, что шаг проверяет.
 *
 * Для ориентации — перестановка верха: детали меняются местами, но ни одна не
 * поворачивается. Для креста — ещё и повёрнутые углы: после алгоритма креста
 * углы остаются как были. Для углов расстановки — перестановка одних рёбер.
 */
const PLACES_MIXED = `${ALGORITHMS.lastCorners} U ${ALGORITHMS.lastEdges}`;
const CORNERS_TWISTED = `${ALGORITHMS.lastFace} U ${PLACES_MIXED}`;
const EDGES_MIXED = ALGORITHMS.lastEdges;

/** Шаг-случай: позиция ставится обратным алгоритмом поверх перемешивания. */
function caseStep(
  entry: CaseAlgorithm,
  rest: string,
  goal: LessonGoal,
  explain: (setup: string) => string,
  intro = ""
): LessonStep {
  const setup = positionFor(entry.algorithm, rest);
  return {
    id: entry.id,
    title: entry.name ?? entry.id,
    explanation: `${intro}${intro ? " " : ""}${explain(setup)}`,
    setup,
    algorithm: entry.algorithm,
    goal,
  };
}

/* ------------------------------------------------------------ ориентация */

const CROSS_EXPLANATION: Readonly<Record<string, string>> = {
  line:
    "Белым вверх два ребра напротив друг друга — линия. Держите её поперёк, слева направо, и сделайте F R U R' U' F': крест готов. Это тот же алгоритм, что в уроке про крест, только теперь случай узнаётся сразу, без повторов.",
  angle:
    "Белым вверх два соседних ребра — уголок. Поставьте его сзади и слева и сделайте F U R U' R' F': это брат алгоритма линии, где U и R поменялись местами, и крест получается за один раз вместо двух.",
  dot:
    "Белым вверх ни одного ребра, только центр — точка. Алгоритм линии, U2 и алгоритм уголка подряд: первый делает уголок, U2 ставит его сзади слева, второй доводит до креста.",
};

const edgeSteps = EDGE_ORIENTATION.map((entry) =>
  caseStep(entry, CORNERS_TWISTED, { kind: "lastLayerCross", face: "U" }, () => CROSS_EXPLANATION[entry.id])
);

const cornerSteps = CORNER_ORIENTATION.map((entry, index) =>
  caseStep(
    entry,
    PLACES_MIXED,
    { kind: "lastLayerOriented", face: "U" },
    (setup) => describeOrientation(applyNotation(setup)),
    index === 0
      ? "Крест есть, остались углы. Раскладов углов всего семь, и на каждый — свой алгоритм, без повторов. Первый вы знаете: это рыбка из метода слоёв."
      : ""
  )
);

/**
 * Урок 9: ориентация последнего слоя в два захода.
 *
 * Первый заход — белый крест, одним алгоритмом из трёх. Второй — углы, одним
 * из семи. Итого десять алгоритмов вместо одного, зато белый верх получается
 * за два алгоритма, а не за пять-шесть повторов.
 */
export const twoLookOrientationLesson: Lesson = {
  slug: "two-look-orientation",
  title: "Белый верх в два захода",
  summary:
    "Сначала крест одним из трёх алгоритмов, затем углы одним из семи. Больше никаких повторов одного алгоритма, пока не выйдет.",
  diagram: "orientation",
  practice:
    "Собирайте кубик целиком: первые два слоя парами, а белый верх — в два захода. Следите, узнаёте ли случай сразу: пауза перед алгоритмом стоит дороже самого алгоритма.",
  steps: [...edgeSteps, ...cornerSteps],
};

/* ------------------------------------------------------------ расстановка */

const cornerPermutationSteps = CORNER_PERMUTATION.map((entry) =>
  caseStep(
    entry,
    EDGES_MIXED,
    { kind: "lastLayerCorners", face: "U" },
    (setup) => describePermutation(applyNotation(setup)),
    entry.id === "headlights"
      ? "Первый заход — углы. Фары поставьте сзади: это знакомый алгоритм из метода слоёв."
      : "Если фар нет нигде, углы меняются по диагонали, и на это есть свой алгоритм — вместо двух повторов прежнего."
  )
);

const edgePermutationSteps = EDGE_PERMUTATION.map((entry, index) =>
  caseStep(
    entry,
    "",
    { kind: "solved" },
    (setup) => describePermutation(applyNotation(setup)),
    index === 0 ? "Второй заход — рёбра: углы уже стоят, раскладов рёбер четыре." : ""
  )
);

/**
 * Урок 10: расстановка последнего слоя в два захода.
 *
 * Углы — одним алгоритмом из двух, рёбра — одним из четырёх. Два из шести
 * алгоритмов знакомы по методу слоёв; новое здесь — что рёбра больше не
 * крутят по кругу до победы, а узнают расклад и делают его алгоритм один раз.
 */
export const twoLookPermutationLesson: Lesson = {
  slug: "two-look-permutation",
  title: "Расстановка в два захода",
  summary:
    "Верх белый — осталось поставить его детали по местам: углы одним алгоритмом из двух, рёбра одним из четырёх.",
  diagram: "permutation",
  practice:
    "Замеряйте полные сборки: пары, белый верх в два захода, расстановка в два захода. Это уже полный скоростной метод — дальше он только сокращается.",
  steps: [...cornerPermutationSteps, ...edgePermutationSteps],
};
