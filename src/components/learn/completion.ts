/**
 * Когда шаг засчитан и когда урок пройден.
 *
 * Урок пройден на последнем шаге, и путей к этому два, по одному на режим:
 *
 * - «Посмотреть» — алгоритм последнего шага показан до конца;
 * - «Попробовать» — человек сам выполнил последний шаг, и шаг засчитан.
 *
 * Засчитывается шаг, выполненный именно тем алгоритмом, которому он учит.
 * Цель, достигнутая другим путём, — не засчитанный шаг: урок учит алгоритму, а
 * не цели, и человек, собравший крест наугад, алгоритму не научился. Так решил
 * владелец в #69. Различать эти случаи заново не нужно — `assessTry` уже
 * отдаёт порознь «цель достигнута» и «дошёл ли алгоритмом».
 *
 * Не засчитывается и шаг, проверка которого остановлена поворотом среднего
 * слоя: модель разошлась с картинкой, и её «выполнено» ничего не стоит.
 *
 * Каждый режим отвечает только за себя. Оценка «Попробовать» существует и в
 * «Посмотреть», но там она посчитана по пустой истории и ничего не значит.
 */

import type { TryAssessment } from "./tryCheck";

/** Шаг в режиме «Попробовать» выполнен и засчитан. */
export function isTryStepCounted(
  assessment: Pick<TryAssessment, "status" | "onAlgorithm">,
  desynced: boolean
): boolean {
  return assessment.status === "done" && assessment.onAlgorithm && !desynced;
}

export interface CompletionInput {
  stepIndex: number;
  stepCount: number;
  mode: "watch" | "try";
  /** Алгоритм открытого шага показан до конца. */
  watchFinished: boolean;
  /** Открытый шаг засчитан в режиме «Попробовать» — см. `isTryStepCounted`. */
  tryCounted: boolean;
}

export function isLessonCompleted({
  stepIndex,
  stepCount,
  mode,
  watchFinished,
  tryCounted,
}: CompletionInput): boolean {
  if (stepIndex !== stepCount - 1) return false;
  return mode === "try" ? tryCounted : watchFinished;
}
