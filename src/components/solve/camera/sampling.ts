/**
 * Откуда в кадре брать цвета наклеек.
 *
 * Видео показано в квадратной рамке с обрезкой по длинной стороне, поверх —
 * сетка 3×3 на `GUIDE_SHARE` рамки. Человек совмещает грань с сеткой, и
 * снимается ровно тот квадрат кадра, что лежит под ней. Здесь — чистая
 * арифметика этого совмещения и выборка цвета из пикселей: без DOM, чтобы
 * проверять тестами.
 */

import type { FaceSamples, Rgb } from "./recognition";

/** Пиксели RGBA строками — то, что отдаёт `getImageData`. */
export interface PixelImage {
  readonly data: ArrayLike<number>;
  readonly width: number;
  readonly height: number;
}

/**
 * Доля видимого квадрата под сеткой. Меньше — грань в кадре мелкая и цвет
 * берётся из горстки пикселей; больше — край грани уходит за рамку, стоит
 * руке чуть дрогнуть.
 */
export const GUIDE_SHARE = 0.7;

/**
 * Доля клетки, из середины которой берётся цвет. Сетка никогда не ложится
 * точно, а между наклейками чёрные щели: середина клетки — наклейка почти
 * при любом сдвиге.
 */
export const SPOT_SHARE = 0.4;

/** Квадрат кадра, что лежит под сеткой, в пикселях видео. */
export function guideSquare(
  videoWidth: number,
  videoHeight: number,
  share: number = GUIDE_SHARE
): { x: number; y: number; size: number } {
  const size = Math.round(Math.min(videoWidth, videoHeight) * share);
  return {
    x: Math.round((videoWidth - size) / 2),
    y: Math.round((videoHeight - size) / 2),
    size,
  };
}

/** Пиксель, в котором камера упёрлась в потолок: блик, а не цвет. */
const BLOWN = 250;

const middle = (values: number[]): number => {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

/**
 * Цвет пятна пикселей, которому не мешают блик и шум.
 *
 * Пересвеченные пиксели выбрасываются, пока их меньшинство: это блик лампы
 * на глянцевой наклейке. Если их большинство — пересвечена сама наклейка, и
 * это почти наверняка белая. Из оставшихся — медиана по каждому каналу:
 * пара случайных пикселей её не сдвигает, в отличие от среднего.
 */
export function robustColour(pixels: readonly Rgb[]): Rgb {
  const blown = pixels.filter((rgb) => Math.min(rgb[0], rgb[1], rgb[2]) >= BLOWN);
  const kept =
    blown.length * 2 > pixels.length
      ? blown
      : pixels.filter((rgb) => Math.min(rgb[0], rgb[1], rgb[2]) < BLOWN);

  return [
    middle(kept.map((rgb) => rgb[0])),
    middle(kept.map((rgb) => rgb[1])),
    middle(kept.map((rgb) => rgb[2])),
  ];
}

/**
 * Девять цветов грани из картинки, на которой грань занимает всё поле:
 * строками сверху вниз, слева направо.
 */
export function sampleFace(image: PixelImage, spot: number = SPOT_SHARE): FaceSamples {
  const cellWidth = image.width / 3;
  const cellHeight = image.height / 3;
  const samples: Rgb[] = [];

  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      const left = Math.round((column + 0.5 - spot / 2) * cellWidth);
      const right = Math.round((column + 0.5 + spot / 2) * cellWidth);
      const top = Math.round((row + 0.5 - spot / 2) * cellHeight);
      const bottom = Math.round((row + 0.5 + spot / 2) * cellHeight);

      const pixels: Rgb[] = [];
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const offset = (y * image.width + x) * 4;
          pixels.push([image.data[offset], image.data[offset + 1], image.data[offset + 2]]);
        }
      }
      samples.push(robustColour(pixels));
    }
  }

  return samples;
}
