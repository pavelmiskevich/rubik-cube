import { crossLesson } from "./cross";
import type { Lesson } from "./types";

/**
 * Курс целиком. Порядок здесь — порядок прохождения; остальные уроки
 * добавляются задачей H.
 */
export const LESSONS: readonly Lesson[] = [crossLesson];

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.slug === slug);
}

export type { Lesson, LessonStep, LessonGoal } from "./types";
export { isGoalReached, goalLabel } from "./types";
