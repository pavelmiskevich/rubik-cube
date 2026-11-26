/**
 * Лимиты записи для вошедшего человека (#126): регистрация открыта всем, и без
 * них простой цикл забил бы базу на общем сервере.
 *
 * Лимиты частоты — по идентификатору пользователя, не по адресу: человек уже
 * опознан, а соседи за общим адресом не должны мешать друг другу (#101).
 * Счётчики живут в памяти процесса и сбрасываются при перезапуске (TECHDEBT,
 * пункт 6), поэтому настоящий предохранитель диска — потолок числа сборок.
 */

/**
 * Сборки подряд. Честная сборка с осмотром занимает секунды; сквозной
 * сценарий пишет пять за несколько секунд — запас двукратный.
 */
export const SOLVE_BURST = { limit: 10, windowMs: 10_000 };

/** Сборки за час: быстрый спидкубер делает их две-три сотни. */
export const SOLVE_HOURLY = { limit: 600, windowMs: 60 * 60_000 };

/** Сохранение места в уроке — на каждый шаг, поэтому щедро. */
export const PROGRESS_SAVE = { limit: 120, windowMs: 60_000 };

/** Перенос прогресса из браузера — раз при входе. */
export const PROGRESS_MERGE = { limit: 10, windowMs: 60_000 };

/** Потолок сборок одного человека; сверх него вытесняются самые старые. */
export const DEFAULT_MAX_SOLVES = 1000;

/**
 * Потолок из `MAX_SOLVES_PER_USER` — положительное целое; пустое или
 * негодное значение даёт значение по умолчанию, а не снимает потолок.
 */
export function maxSolvesPerUser(raw: string | undefined = process.env.MAX_SOLVES_PER_USER): number {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return DEFAULT_MAX_SOLVES;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_SOLVES;
}

/** Текст отказа по лимиту частоты: через сколько секунд можно снова. */
export function tooFrequent(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Слишком часто — попробуйте через ${seconds} с`;
}
