/**
 * Прогресс по урокам: где человек остановился и прошёл ли урок до конца.
 *
 * Правило хранения: вошёл — база, не вошёл — localStorage. При входе
 * локальный прогресс сливается с базой и очищается — это `progressMerge.ts`.
 * Этот модуль не знает, куда пишется прогресс: он решает, что писать, и
 * проверяет то, что прочитано.
 * Поэтому он годится и клиенту, и серверному действию, и закрыт тестами без
 * браузера и базы.
 */

import { LESSONS } from "@/content/lessons";

export interface ProgressEntry {
  /** Номер открытого шага, с нуля. */
  stepIndex: number;
  /** Урок пройден до конца. Однажды поставленная отметка не снимается. */
  completed: boolean;
}

/** Прогресс по всем урокам, ключ — slug урока. */
export type ProgressMap = Record<string, ProgressEntry>;

/** Урок глазами прогресса: только slug и сколько в нём шагов. */
export interface LessonShape {
  slug: string;
  steps: number;
}

/** Курс глазами прогресса. */
export const COURSE_SHAPES: readonly LessonShape[] = LESSONS.map((lesson) => ({
  slug: lesson.slug,
  steps: lesson.steps.length,
}));

/** Версия в ключе — чтобы формат можно было сменить, не разбирая старый. */
export const LOCAL_PROGRESS_KEY = "rubik:lesson-progress:v1";

/**
 * Что записать после действия в уроке, или `null`, если записывать нечего.
 *
 * `null` не только экономит запросы: без него каждое открытие урока писало бы
 * нулевой шаг поверх сохранённого ещё до того, как сохранённый успел
 * прочитаться.
 */
export function nextProgress(
  prev: ProgressEntry | undefined,
  stepIndex: number,
  completed: boolean
): ProgressEntry | null {
  const next: ProgressEntry = {
    stepIndex,
    completed: Boolean(prev?.completed) || completed,
  };

  if (!prev) {
    return next.stepIndex === 0 && !next.completed ? null : next;
  }
  return prev.stepIndex === next.stepIndex && prev.completed === next.completed
    ? null
    : next;
}

/**
 * Запись, пришедшая извне, — из localStorage или от клиента в серверное
 * действие. Всё, что не похоже на прогресс, отбрасывается.
 *
 * Шаг за пределами урока прижимается к последнему, а не отбрасывается: урок
 * могли укоротить после того, как человек его прошёл, и терять отметку о
 * пройденном из-за этого незачем.
 */
export function sanitizeEntry(value: unknown, stepCount: number): ProgressEntry | null {
  if (stepCount <= 0 || typeof value !== "object" || value === null) return null;

  const { stepIndex, completed } = value as Record<string, unknown>;
  if (typeof stepIndex !== "number" || !Number.isInteger(stepIndex) || stepIndex < 0) {
    return null;
  }
  if (typeof completed !== "boolean") return null;

  return { stepIndex: Math.min(stepIndex, stepCount - 1), completed };
}

/** Разбор сохранённой строки. Неизвестные уроки и битые записи выпадают молча. */
export function parseProgressMap(raw: string | null, lessons: readonly LessonShape[]): ProgressMap {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  return sanitizeProgressMap(parsed, lessons);
}

/**
 * Прогресс по курсу из чего угодно: из разобранного localStorage или из строк
 * базы. Остаются только уроки, которые есть в курсе, и только корректные записи.
 */
export function sanitizeProgressMap(value: unknown, lessons: readonly LessonShape[]): ProgressMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const result: ProgressMap = {};
  for (const lesson of lessons) {
    const entry = sanitizeEntry((value as Record<string, unknown>)[lesson.slug], lesson.steps);
    if (entry) result[lesson.slug] = entry;
  }
  return result;
}

/** Та часть контракта localStorage, которая здесь нужна. */
export type ProgressStorage = Pick<Storage, "getItem" | "setItem">;

/*
  localStorage может не быть вовсе (сервер) или бросать на каждое обращение
  (приватный режим, запрет сайта на данные, переполненная квота). Курс от этого
  не должен ломаться — он просто перестаёт помнить.
*/

export function readLocalProgress(
  storage: Pick<Storage, "getItem"> | null,
  lessons: readonly LessonShape[]
): ProgressMap {
  if (!storage) return {};
  try {
    return parseProgressMap(storage.getItem(LOCAL_PROGRESS_KEY), lessons);
  } catch {
    return {};
  }
}

/**
 * Записывает прогресс одного урока, не трогая остальные. Чужие ключи в
 * сохранённом объекте переносятся как есть: их мог записать урок, которого в
 * этой сборке уже или ещё нет.
 */
export function writeLocalProgress(
  storage: ProgressStorage | null,
  slug: string,
  entry: ProgressEntry
): void {
  if (!storage) return;
  try {
    let current: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(storage.getItem(LOCAL_PROGRESS_KEY) ?? "{}");
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        current = parsed as Record<string, unknown>;
      }
    } catch {
      // Битое значение перезаписывается.
    }
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify({ ...current, [slug]: entry }));
  } catch (error) {
    console.warn("writeLocalProgress failed", error);
  }
}
