import { applyNotation } from "@/lib/cube/moves";
import { positionFor } from "./algorithms";
import { describePermutation, movedPieces } from "./caseText";
import { PERMUTATION_CASES } from "./speedAlgorithms";
import type { Lesson, LessonStep } from "./types";

const PRACTICE =
  "Разберите случаи урока в «Попробовать», затем замеряйте полные сборки. Незнакомый случай — расстановка в два захода, она по-прежнему работает.";

const cases = PERMUTATION_CASES.map((entry) => {
  const setup = positionFor(entry.algorithm);
  return { entry, setup, start: applyNotation(setup) };
});

const toStep = ({ entry, setup, start }: (typeof cases)[number]): LessonStep => ({
  id: entry.id,
  title: `Перестановка ${entry.name}`,
  explanation: describePermutation(start),
  setup,
  algorithm: entry.algorithm,
  goal: { kind: "solved" },
});

/**
 * Уроки 15–16: расстановка последнего слоя за один алгоритм, все 21 случай.
 *
 * Разложены по тому, что перепутано: сначала семь случаев, где двигаются одни
 * углы или одни рёбра — четыре из них уже знакомы по второму заходу, — затем
 * четырнадцать, где и те и другие. Раскладка вычисляется по позиции.
 */
export const fullPermutationLessons: readonly Lesson[] = [
  {
    slug: "permutation-single",
    title: "Расстановка за один алгоритм: одни углы или одни рёбра",
    summary:
      "Семь случаев, где перепутаны только углы или только рёбра. Рёбра вы уже знаете, к ним добавляются три случая одних углов.",
    diagram: "permutation",
    practice: PRACTICE,
    steps: cases.filter(({ start }) => movedPieces(start) !== "both").map(toStep),
  },
  {
    slug: "permutation-both",
    title: "Расстановка за один алгоритм: углы и рёбра вместе",
    summary:
      "Четырнадцать случаев, где перепутаны и углы, и рёбра. Выучив их, вы собираете последний слой за два алгоритма: ориентация и расстановка.",
    diagram: "permutation",
    practice: PRACTICE,
    steps: cases.filter(({ start }) => movedPieces(start) === "both").map(toStep),
  },
];
