import { LESSONS, getLesson, type Lesson } from "@/content/lessons";

/*
  Одно правило на три места: таймер показывает «Сейчас тренируете», сервер
  помечает сборку уроком, /stats предлагает урок в выборе. Разойдись они — и
  таймер обещал бы тренировку урока, которую сервер молча запишет свободной
  сборкой.
*/

/**
 * Урок, который тренируется на таймере: существующий урок с полем `practice`.
 * Адрес пишется руками кем угодно, а серверное действие зовут с чем угодно,
 * поэтому всё остальное — незнакомый slug, урок без `practice`, повторённый
 * параметр адреса, мусор — это «ничего не тренирует», а не ошибка.
 */
export function practisedLesson(value: unknown): Lesson | undefined {
  if (typeof value !== "string") return undefined;
  const lesson = getLesson(value);
  return lesson?.practice ? lesson : undefined;
}

/** Что записать в `Solve.lessonSlug`: slug тренируемого урока или `null` — свободная сборка. */
export function solveLessonSlug(value: unknown): string | null {
  return practisedLesson(value)?.slug ?? null;
}

/**
 * Уроки для выбора на /stats: те, по которым у человека есть сборки, в порядке
 * курса. Свободные сборки (`null`) и уроки, которых в курсе больше нет, в
 * выбор не попадают — их сборки остаются видны во «всех сборках».
 */
export function statsLessonOptions(slugs: readonly (string | null)[]): Lesson[] {
  const present = new Set(slugs);
  return LESSONS.filter((lesson) => present.has(lesson.slug) && practisedLesson(lesson.slug));
}

/**
 * Урок, выбранный на /stats параметром `?lesson=`, или `undefined` — «все
 * сборки». Принимается только урок из предложенных: подложенный в адрес урок
 * без сборок показал бы пустую статистику вместо честного «всё».
 */
export function selectedStatsLesson(
  value: unknown,
  options: readonly Lesson[]
): Lesson | undefined {
  return typeof value === "string"
    ? options.find((lesson) => lesson.slug === value)
    : undefined;
}
