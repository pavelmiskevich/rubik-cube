import { applyNotation } from "@/lib/cube/moves";
import { ALGORITHMS, positionFor } from "./algorithms";
import { EDGE_SHAPE_NAME, describeOrientation, edgeShape, orientationTitle, type EdgeShape } from "./caseText";
import { ORIENTATION_CASES } from "./speedAlgorithms";
import type { Lesson, LessonStep } from "./types";

/** Детали верха меняются местами, не поворачиваясь: узор белого тот же. */
const PLACES_MIXED = `${ALGORITHMS.lastCorners} U ${ALGORITHMS.lastEdges}`;

const PRACTICE =
  "Разберите случаи урока в «Попробовать», затем замеряйте полные сборки. Встретился случай из урока — делайте его алгоритм, не встретился — старые два захода, они никуда не делись.";

/** Шаги полного набора, чьи рёбра складываются в форму `shape`. */
function stepsOf(shape: EdgeShape): LessonStep[] {
  const cases = ORIENTATION_CASES.map((entry) => {
    const setup = positionFor(entry.algorithm, PLACES_MIXED);
    return { entry, setup, start: applyNotation(setup) };
  }).filter(({ start }) => edgeShape(start) === shape);

  // Одинаковые названия внутри урока различаются номером: «…, два угла вверх (2)».
  const seen = new Map<string, number>();
  const titles = cases.map(({ start }) => orientationTitle(start));
  const repeated = new Set(titles.filter((title, index) => titles.indexOf(title) !== index));

  return cases.map(({ entry, setup, start }, index) => {
    const title = titles[index];
    const count = (seen.get(title) ?? 0) + 1;
    seen.set(title, count);
    return {
      id: entry.id,
      title: repeated.has(title) ? `${title} (${count})` : title,
      explanation: describeOrientation(start),
      setup,
      algorithm: entry.algorithm,
      goal: { kind: "lastLayerOriented", face: "U" },
    };
  });
}

const lesson = (
  shape: EdgeShape,
  fields: Pick<Lesson, "slug" | "title" | "summary">
): Lesson => ({
  ...fields,
  diagram: "orientation",
  practice: PRACTICE,
  steps: stepsOf(shape),
});

/**
 * Уроки 11–14: белый верх за один алгоритм, все 57 случаев.
 *
 * Случаи разложены по тому, что видно первым делом, — по форме рёбер белым
 * вверх: крест, линия, уголок, точка. Раскладка вычисляется по позиции, а не
 * вписана руками, и `speed.test.ts` проверяет, что четыре урока вместе — это
 * весь набор, без пропусков и повторов.
 */
export const fullOrientationLessons: readonly Lesson[] = [
  lesson("cross", {
    slug: "orientation-cross",
    title: `Белый верх за один алгоритм: ${EDGE_SHAPE_NAME.cross.toLowerCase()}`,
    summary:
      "Семь случаев, где крест уже есть. Их вы знаете по второму заходу — теперь это часть полного набора.",
  }),
  lesson("line", {
    slug: "orientation-line",
    title: `Белый верх за один алгоритм: ${EDGE_SHAPE_NAME.line.toLowerCase()}`,
    summary:
      "Пятнадцать случаев, где белым вверх смотрят два ребра напротив — линия. Один алгоритм вместо креста и углов по отдельности.",
  }),
  lesson("angle", {
    slug: "orientation-angle",
    title: `Белый верх за один алгоритм: ${EDGE_SHAPE_NAME.angle.toLowerCase()}`,
    summary:
      "Двадцать семь случаев с уголком из двух соседних рёбер — самая большая группа. Учите по нескольку за раз.",
  }),
  lesson("dot", {
    slug: "orientation-dot",
    title: `Белый верх за один алгоритм: ${EDGE_SHAPE_NAME.dot.toLowerCase()}`,
    summary:
      "Восемь случаев, где белым вверх нет ни одного ребра. Самые длинные алгоритмы набора и самая большая экономия.",
  }),
];
