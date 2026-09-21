/**
 * Раскраска, пока её вводят: те же 54 наклейки, но ещё не все названы.
 *
 * Проверка собираемости в `src/lib/cube/facelets.ts` работает с готовой
 * раскраской, и правильно делает: «ещё не ввели» — это состояние экрана, а не
 * свойство кубика. Незаполненные наклейки живут здесь, и здесь же правило,
 * которое иначе расползлось бы по компоненту: центры не красят.
 *
 * Логика вынесена из компонента по образцу `playerState.ts` — тесты в
 * окружении `node`, без браузера.
 */

import {
  CENTRE_FACELETS,
  FACELET_COUNT,
  FACELET_FACES,
  Facelets,
  Sticker,
  stateToFacelets,
} from "@/lib/cube/facelets";
import { SOLVED_CUBE } from "@/lib/cube/state";

/** `null` — наклейку ещё не назвали. */
export type Painting = readonly (Sticker | null)[];

const CENTRES: ReadonlySet<number> = new Set(
  FACELET_FACES.map((face) => CENTRE_FACELETS[face])
);

/**
 * Центр — не наклейка, которую вводят, а подпись грани.
 *
 * Центры не двигаются друг относительно друга, поэтому именно они говорят,
 * какого цвета грань. Если позволить их красить, человек первым делом
 * «исправит» их под свой кубик в руках, и вся раскраска поедет.
 */
export const isCentre = (index: number): boolean => CENTRES.has(index);

export function emptyPainting(): Painting {
  const painting = new Array<Sticker | null>(FACELET_COUNT).fill(null);
  for (const face of FACELET_FACES) {
    painting[CENTRE_FACELETS[face]] = face;
  }
  return painting;
}

/** Собранный куб: удобная отправная точка, если отличий от него немного. */
export function solvedPainting(): Painting {
  return [...stateToFacelets(SOLVED_CUBE)];
}

/** Та же раскраска с перекрашенной наклейкой; центр возвращает её как есть. */
export function paintSticker(
  painting: Painting,
  index: number,
  sticker: Sticker | null
): Painting {
  if (isCentre(index) || painting[index] === sticker) return painting;

  const next = [...painting];
  next[index] = sticker;
  return next;
}

export const countOf = (painting: Painting, sticker: Sticker): number =>
  painting.filter((value) => value === sticker).length;

export const remaining = (painting: Painting): number =>
  painting.filter((value) => value === null).length;

/** Раскраска целиком, если названы все наклейки; иначе `null`. */
export function finishedPainting(painting: Painting): Facelets | null {
  return painting.every((sticker) => sticker !== null) ? (painting as Facelets) : null;
}
