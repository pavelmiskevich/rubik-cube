"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLesson } from "@/content/lessons";
import { sanitizeEntry } from "@/lib/lessonProgress";

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
      update: entry.completed
        ? { stepIndex: entry.stepIndex, completed: true }
        : { stepIndex: entry.stepIndex },
    });
    return { success: true };
  } catch (error) {
    console.error("saveLessonProgress failed", error);
    return { success: false, error: "Не удалось сохранить прогресс" };
  }
}
