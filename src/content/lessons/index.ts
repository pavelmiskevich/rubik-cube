import { crossLesson } from "./cross";
import { firstLayerLesson } from "./firstLayer";
import { lastLayerCrossLesson } from "./lastLayerCross";
import { lastLayerFaceLesson } from "./lastLayerFace";
import { lastLayerPermutationLesson } from "./lastLayerPermutation";
import { notationLesson } from "./notation";
import { secondLayerLesson } from "./secondLayer";
import type { Lesson } from "./types";

/**
 * Курс целиком. Порядок здесь — порядок прохождения: каждый следующий урок
 * начинается там, где закончился предыдущий, и пользуется его словами.
 *
 * Метод один — послойный: нижний слой, средний, верхний. Скоростных методов в
 * курсе нет намеренно: он доводит до собранного куба, а не до разряда.
 */
export const LESSONS: readonly Lesson[] = [
  notationLesson,
  crossLesson,
  firstLayerLesson,
  secondLayerLesson,
  lastLayerCrossLesson,
  lastLayerFaceLesson,
  lastLayerPermutationLesson,
];

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.slug === slug);
}

export type { Lesson, LessonStep, LessonGoal } from "./types";
export { isGoalReached, goalLabel } from "./types";
