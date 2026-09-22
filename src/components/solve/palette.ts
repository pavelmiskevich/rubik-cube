/**
 * Слова и цвета экрана ввода.
 *
 * Цвета берутся у 3D-куба, а не подбираются заново: человек смотрит на свой
 * кубик, на тренажёр и на этот экран подряд, и красный должен быть везде одним
 * и тем же красным. Названия граней — те же, что в уроках: «верх», «фронт»,
 * «тыл», а не U, F и B.
 */

import { STICKER_COLORS } from "@/components/cube/cubeTheme";
import type { Sticker } from "@/lib/cube/facelets";

/** Порядок STICKER_COLORS — грани сцены: +X, -X, +Y, -Y, +Z, -Z. */
export const STICKER_FILL: Readonly<Record<Sticker, string>> = {
  R: STICKER_COLORS[0],
  L: STICKER_COLORS[1],
  U: STICKER_COLORS[2],
  D: STICKER_COLORS[3],
  F: STICKER_COLORS[4],
  B: STICKER_COLORS[5],
};

export const STICKER_NAME: Readonly<Record<Sticker, string>> = {
  U: "белый",
  D: "жёлтый",
  F: "зелёный",
  B: "синий",
  R: "красный",
  L: "оранжевый",
};

export const FACE_NAME: Readonly<Record<Sticker, string>> = {
  U: "Верх",
  D: "Низ",
  F: "Фронт",
  B: "Тыл",
  R: "Право",
  L: "Лево",
};

/** Противоположные цвета идут парами: так их труднее перепутать при выборе. */
export const BRUSHES: readonly Sticker[] = ["U", "D", "F", "B", "R", "L"];

/** Цифры 1–6 ставят цвет на наклейке, на которой стоит курсор. */
export const BRUSH_KEYS: Readonly<Record<string, Sticker>> = Object.fromEntries(
  BRUSHES.map((sticker, index) => [String(index + 1), sticker])
);

/**
 * «1 наклейку», «2 наклейки», «5 наклеек».
 *
 * Счётчик оставшегося человек читает десятки раз за ввод, и «осталось 2
 * наклеек» в такой строке выглядит небрежностью ровно там, где нужна
 * аккуратность.
 */
export function stickerCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} наклеек`;
  if (last === 1) return `${count} наклейку`;
  if (last >= 2 && last <= 4) return `${count} наклейки`;
  return `${count} наклеек`;
}
