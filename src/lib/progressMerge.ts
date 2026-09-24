/**
 * Слияние анонимного прогресса с прогрессом вошедшего пользователя.
 *
 * Аноним проходит уроки, и прогресс копится в localStorage. Когда он входит
 * или регистрируется, этот прогресс переезжает в базу и сливается с тем, что
 * уже лежит в аккаунте. Выбора «чей прогресс оставить» нет — правило одно,
 * предсказуемое и без диалога.
 *
 * Модуль не знает ни про базу, ни про браузер: правило — чистые функции, а
 * перенос получает хранилище и отправку аргументами. Поэтому всё здесь
 * проверяется тестами без базы и без браузера.
 */

import {
  COURSE_SHAPES,
  LOCAL_PROGRESS_KEY,
  readLocalProgress,
  type ProgressEntry,
  type ProgressMap,
} from "@/lib/lessonProgress";

/**
 * Правило по одному уроку: побеждает больший номер шага, а отметка о
 * завершении никогда не снимается.
 *
 * Обе половины — максимум, поэтому итог не зависит ни от того, какая запись
 * слева, ни от порядка, в котором сливаются несколько источников, а повторное
 * слияние с тем же ничего не меняет.
 */
export function mergeEntry(a: ProgressEntry, b: ProgressEntry): ProgressEntry {
  return {
    stepIndex: Math.max(a.stepIndex, b.stepIndex),
    completed: a.completed || b.completed,
  };
}

/**
 * Какие уроки переписать в базе после слияния локального прогресса с ней.
 *
 * Пишется слитая запись, и только там, где она отличается от записи в базе:
 * урок, где аккаунт уже впереди или вровень, не трогается вовсе.
 */
export function progressToWrite(local: ProgressMap, remote: ProgressMap): ProgressMap {
  const result: ProgressMap = {};
  for (const [slug, entry] of Object.entries(local)) {
    const stored = remote[slug];
    const merged = stored ? mergeEntry(entry, stored) : entry;
    if (
      !stored ||
      stored.stepIndex !== merged.stepIndex ||
      stored.completed !== merged.completed
    ) {
      result[slug] = merged;
    }
  }
  return result;
}

/** Ответ серверного действия слияния. `written` — сколько уроков переписано. */
export type MergeLessonProgressResult =
  | { success: true; written: number }
  | { success: false; error: string };

/** Та часть контракта localStorage, которая нужна переносу. */
export type LocalProgressStore = Pick<Storage, "getItem" | "removeItem">;

/**
 * Чем кончился перенос: локального прогресса не было; был, но аккаунт уже
 * впереди; слит и изменил базу; не удался.
 */
export type LocalMergeOutcome = "nothing-local" | "unchanged" | "merged" | "failed";

/**
 * Переносит прогресс анонима в аккаунт: читает localStorage, отправляет на
 * сервер и после успеха очищает локальную копию — иначе следующий вход
 * воскресил бы уже устаревшее.
 *
 * Никогда не бросает: вход не должен падать из-за прогресса. Неудача пишется
 * в лог, а локальная копия остаётся до следующей попытки — повторное слияние
 * той же копии безвредно, правило идемпотентно.
 */
export async function mergeLocalProgress(
  storage: LocalProgressStore | null,
  send: (local: ProgressMap) => Promise<MergeLessonProgressResult>
): Promise<LocalMergeOutcome> {
  const local = readLocalProgress(storage, COURSE_SHAPES);
  if (Object.keys(local).length === 0) return "nothing-local";

  let result: MergeLessonProgressResult;
  try {
    result = await send(local);
  } catch (error) {
    console.warn("mergeLessonProgress failed", error);
    return "failed";
  }
  if (!result.success) {
    console.warn("mergeLessonProgress:", result.error);
    return "failed";
  }

  try {
    storage?.removeItem(LOCAL_PROGRESS_KEY);
  } catch (error) {
    console.warn("clearing local progress failed", error);
  }
  return result.written > 0 ? "merged" : "unchanged";
}
