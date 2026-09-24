import { crossLesson } from "./cross";
import { firstLayerLesson } from "./firstLayer";
import { lastLayerCrossLesson } from "./lastLayerCross";
import { lastLayerFaceLesson } from "./lastLayerFace";
import { lastLayerPermutationLesson } from "./lastLayerPermutation";
import { notationLesson } from "./notation";
import { secondLayerLesson } from "./secondLayer";
import { pairsLesson } from "./pairs";
import { twoLookOrientationLesson, twoLookPermutationLesson } from "./twoLook";
import { fullOrientationLessons } from "./fullOrientation";
import { fullPermutationLessons } from "./fullPermutation";
import type { Lesson } from "./types";

/**
 * Блок курса: уроки, которые проходят подряд, и условие, при котором блок
 * открывается.
 */
export interface CourseBlock {
  id: "layers" | "speed";
  title: string;
  summary: string;
  lessons: readonly Lesson[];
  /**
   * Урок, который нужно пройти, прежде чем блок откроется. Без него блок
   * открыт сразу.
   */
  opensAfter?: string;
}

/**
 * Курс целиком. Порядок здесь — порядок прохождения: каждый следующий урок
 * начинается там, где закончился предыдущий, и пользуется его словами.
 *
 * Первый блок — метод слоёв — доводит до собранного куба. Второй начинается
 * там, где первый кончается: учит собирать тот же куб быстрее. Он закрыт,
 * пока не пройден последний урок первого — новичку, который ещё не собрал
 * куб целиком, скоростной метод ничего не даст, кроме путаницы.
 */
export const COURSE: readonly CourseBlock[] = [
  {
    id: "layers",
    title: "Метод слоёв",
    summary: "От первого поворота до собранного куба: нижний слой, средний, верхний.",
    lessons: [
      notationLesson,
      crossLesson,
      firstLayerLesson,
      secondLayerLesson,
      lastLayerCrossLesson,
      lastLayerFaceLesson,
      lastLayerPermutationLesson,
    ],
  },
  {
    id: "speed",
    title: "Быстрее: скоростной метод",
    summary:
      "Тот же куб, но меньше ходов и меньше раздумий: первые два слоя парами, затем последний слой в два захода и, наконец, за один алгоритм.",
    lessons: [
      pairsLesson,
      twoLookOrientationLesson,
      twoLookPermutationLesson,
      ...fullOrientationLessons,
      ...fullPermutationLessons,
    ],
    opensAfter: lastLayerPermutationLesson.slug,
  },
];

export const LESSONS: readonly Lesson[] = COURSE.flatMap((block) => block.lessons);

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.slug === slug);
}

export function blockOf(slug: string): CourseBlock | undefined {
  return COURSE.find((block) => block.lessons.some((lesson) => lesson.slug === slug));
}

/** Урок, который нужно пройти, чтобы открылся этот, или `undefined`, если он открыт сразу. */
export function prerequisiteOf(slug: string): Lesson | undefined {
  const required = blockOf(slug)?.opensAfter;
  return required === undefined ? undefined : getLesson(required);
}

/**
 * Открыт ли урок человеку, прошедшему уроки, для которых `completed` отвечает
 * «да». Откуда берётся прогресс — из базы или из браузера, — здесь не важно.
 */
export function isLessonOpen(slug: string, completed: (slug: string) => boolean): boolean {
  const required = prerequisiteOf(slug);
  return required === undefined || completed(required.slug);
}

export type { Lesson, LessonStep, LessonGoal, CaseDiagram } from "./types";
export { isGoalReached, goalLabel } from "./types";
