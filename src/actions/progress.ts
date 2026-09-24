"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLesson } from "@/content/lessons";
import {
  COURSE_SHAPES,
  sanitizeEntry,
  sanitizeProgressMap,
  type ProgressEntry,
} from "@/lib/lessonProgress";
import { progressToWrite, type MergeLessonProgressResult } from "@/lib/progressMerge";

export type SaveLessonProgressResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Запоминает, где вошедший человек остановился в уроке.
 *
 * Устроено по образцу saveSolve: серверное действие — публичная точка входа,
 * поэтому сначала сессия, потом проверка аргументов, и только потом база.
 * Идентификатор пользователя берётся из сессии и никогда из аргументов: писать
 * чужой прогресс нечем.
 */
export async function saveLessonProgress(
  lessonSlug: string,
  stepIndex: number,
  completed: boolean
): Promise<SaveLessonProgressResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "Войдите, чтобы сохранять прогресс" };
  }

  const lesson = typeof lessonSlug === "string" ? getLesson(lessonSlug) : undefined;
  if (!lesson) {
    return { success: false, error: "Нет такого урока" };
  }

  const entry = sanitizeEntry({ stepIndex, completed }, lesson.steps.length);
  if (!entry) {
    return { success: false, error: "Некорректный прогресс" };
  }

  try {
    // Уникальность по паре «пользователь + урок» делает upsert единственной
    // строкой на урок: повторное прохождение обновляет её, а не плодит новые,
    // и две вкладки, сохраняющие одновременно, не разводят историю надвое.
    // Отметка о завершении в update только ставится: вернуться к первому шагу
    // пройденного урока не значит его «разпройти».
    await prisma.lessonProgress.upsert({
      where: { userId_lessonSlug: { userId, lessonSlug: lesson.slug } },
      create: { userId, lessonSlug: lesson.slug, ...entry },
      update: updateOf(entry),
    });
    return { success: true };
  } catch (error) {
    console.error("saveLessonProgress failed", error);
    return { success: false, error: "Не удалось сохранить прогресс" };
  }
}

/**
 * Поля для update существующей строки. Отметка о завершении в update только
 * ставится: поля completed со значением false здесь не бывает, поэтому ни
 * повторный проход, ни слияние, ни их гонка между собой не снимут её.
 */
function updateOf(entry: ProgressEntry): { stepIndex: number; completed?: true } {
  return entry.completed
    ? { stepIndex: entry.stepIndex, completed: true }
    : { stepIndex: entry.stepIndex };
}

/**
 * Сливает прогресс, накопленный анонимом в localStorage, с прогрессом
 * вошедшего пользователя. Зовётся клиентом сразу после входа или регистрации;
 * правило слияния — `mergeEntry` в `src/lib/progressMerge.ts`.
 *
 * Как saveLessonProgress: сессия первым делом, аргумент — чужие данные и
 * проверяется целиком, ошибка базы — размеченный ответ и запись в лог, а не
 * исключение. Клиент по неудаче сохраняет локальную копию до следующего входа,
 * так что упавшее слияние стоит лишь повторной попытки, а вход не роняет.
 */
export async function mergeLessonProgress(local: unknown): Promise<MergeLessonProgressResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "Войдите, чтобы сохранять прогресс" };
  }

  // Неизвестные уроки и битые записи выпадают, шаг прижимается к уроку:
  // больше, чем по строке на урок курса, отсюда не написать.
  const incoming = sanitizeProgressMap(local, COURSE_SHAPES);
  const slugs = Object.keys(incoming);
  if (slugs.length === 0) return { success: true, written: 0 };

  try {
    // Своё чтение, а не getLessonProgressForUser: та на сбое базы отдаёт
    // пустой прогресс, и слияние записало бы локальное поверх того, что в
    // аккаунте дальше. Не прочитали — не пишем.
    const rows = await prisma.lessonProgress.findMany({
      where: { userId, lessonSlug: { in: slugs } },
      select: { lessonSlug: true, stepIndex: true, completed: true },
    });
    const stored = sanitizeProgressMap(
      Object.fromEntries(
        rows.map((row) => [row.lessonSlug, { stepIndex: row.stepIndex, completed: row.completed }])
      ),
      COURSE_SHAPES
    );

    const writes = Object.entries(progressToWrite(incoming, stored));
    if (writes.length > 0) {
      // Одной транзакцией: слияние либо целиком в базе, либо нет вовсе и
      // повторится при следующем входе с той же локальной копией.
      await prisma.$transaction(
        writes.map(([lessonSlug, entry]) =>
          prisma.lessonProgress.upsert({
            where: { userId_lessonSlug: { userId, lessonSlug } },
            create: { userId, lessonSlug, ...entry },
            update: updateOf(entry),
          })
        )
      );
    }
    return { success: true, written: writes.length };
  } catch (error) {
    console.error("mergeLessonProgress failed", error);
    return { success: false, error: "Не удалось перенести прогресс" };
  }
}
