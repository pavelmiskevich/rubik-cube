/**
 * Распознавание раскраски по шести снимкам граней.
 *
 * Модуль чистый: на входе — цвета, уже выбранные из кадра (по девять на
 * грань, строками, как их видит камера), на выходе — раскраска для экрана
 * ввода. Ни камеры, ни DOM здесь нет, поэтому всё проверяется тестами на
 * образцах пикселей.
 *
 * ## Почему нет фиксированных порогов
 *
 * «Жёлтый — это когда синего меньше ста» ломается о первую же лампу
 * накаливания: под ней белый желтеет, жёлтый уходит в оранжевый, а камера
 * ещё и подстраивает баланс белого под каждый кадр по-своему. Поэтому эталоны
 * берутся с самого кубика: центр грани не двигается и всегда своего цвета,
 * значит шесть центров — это шесть образцов, снятых при том же свете, что и
 * остальные наклейки.
 *
 * ## Как сравниваются цвета
 *
 * Сначала у цвета убирается яркость: канал с наибольшим значением
 * дотягивается до полного, остальные — в той же пропорции. Белый в тени
 * становится белым на свету, красный в тени — красным: тень меняет яркость,
 * а не оттенок. Затем цвет переводится в пространство Lab, где расстояние
 * близко к тому, как различает цвета глаз, и белый от жёлтого отличается
 * насыщенностью по оси жёлто-синего, а не яркостью, которой больше нет.
 *
 * ## Почему каждого цвета ровно девять
 *
 * Самая частая ошибка — спорная наклейка: оранжевая в блике похожа на
 * красную. По отдельности её не решить, но вместе — можно: красных уже девять,
 * значит эта оранжевая. Наклейки раскладываются по цветам разом, так, чтобы
 * сумма расстояний до эталонов была наименьшей, а каждому цвету досталось
 * ровно по восемь наклеек кроме центра. Это задача о назначениях, и
 * венгерский алгоритм решает её точно.
 *
 * ## Что делается со светом каждого снимка
 *
 * После первой раскладки у каждого снимка есть свои белые наклейки, и по ним
 * виден свет этого кадра: белый под лампой желтоват ровно настолько, насколько
 * желтит лампа. Снимок выправляется так, чтобы его белые стали белыми, эталоны
 * пересчитываются по всем девяти наклейкам каждого цвета, а не по одному
 * центру, и раскладка повторяется. Снимку без белых наклеек достаётся
 * поправка, средняя по остальным.
 */

import {
  CENTRE_FACELETS,
  FACELET_COUNT,
  FACELET_FACES,
  FACELETS_PER_FACE,
  FACE_SIZE,
  Facelets,
  Sticker,
  faceletIndex,
} from "@/lib/cube/facelets";

/** Цвет пикселя: красный, зелёный, синий, 0–255. */
export type Rgb = readonly [number, number, number];

/** Девять цветов грани строками сверху вниз, слева направо — как в кадре. */
export type FaceSamples = readonly Rgb[];

/** Снимки всех шести граней. */
export type Scans = Readonly<Record<Sticker, FaceSamples>>;

export interface Recognition {
  /** Раскраска целиком: по девять наклеек каждого цвета, центры на месте. */
  readonly painting: Facelets;
  /** Наклейки, в цвете которых распознавание не уверено, — их стоит проверить. */
  readonly doubtful: readonly number[];
}

type Lab = readonly [number, number, number];

/* ------------------------------------------------------------------ */
/* Цвет                                                               */
/* ------------------------------------------------------------------ */

const toLinear = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const labCurve = (value: number): number =>
  value > 216 / 24389 ? Math.cbrt(value) : (24389 / 27 * value + 16) / 116;

/**
 * Цвет без яркости, в пространстве Lab.
 *
 * Яркость убирается до перевода: самый яркий канал становится полным. Чёрный
 * пиксель превращается в белый — и это неважно, потому что слишком тёмный
 * снимок отсекается раньше, `isTooDark`.
 */
export function colourFeature(rgb: Rgb): Lab {
  const top = Math.max(rgb[0], rgb[1], rgb[2], 1);
  const [r, g, b] = rgb.map((channel) => toLinear((Math.max(channel, 0) / top) * 255));

  // sRGB → XYZ при белой точке D65, сразу поделённое на эту точку.
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;

  const fx = labCurve(x);
  const fy = labCurve(y);
  const fz = labCurve(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const labDistance = (a: Lab, b: Lab): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Насколько различаются два цвета, если не смотреть на яркость. */
export const colourDistance = (a: Rgb, b: Rgb): number =>
  labDistance(colourFeature(a), colourFeature(b));

/* ------------------------------------------------------------------ */
/* Проверки отдельного снимка                                         */
/* ------------------------------------------------------------------ */

/**
 * Самый яркий канал, ниже которого снимок считается тёмным. Синяя наклейка в
 * полутени даёт около ста по синему, пустой тёмный кадр — единицы и десятки.
 */
const DARK_LEVEL = 45;

/** Снимок, на котором цвета не различить: в нём попросту мало света. */
export function isTooDark(samples: FaceSamples): boolean {
  const levels = samples.map((rgb) => Math.max(rgb[0], rgb[1], rgb[2])).sort((a, b) => a - b);
  return levels[Math.floor(levels.length / 2)] < DARK_LEVEL;
}

/**
 * Ближе этого два центра разных граней не бывают даже под лампой; ближе —
 * значит, одну грань показали дважды.
 */
const SAME_CENTRE = 12;

const CENTRE_CELL = Math.floor(FACELETS_PER_FACE / 2);

/**
 * Какую из уже снятых граней напоминает этот снимок по центру. Центр у каждой
 * грани свой, поэтому совпадение почти всегда значит, что кубик повернули не
 * той стороной.
 */
export function sameCentreAs(
  taken: Partial<Record<Sticker, FaceSamples>>,
  face: Sticker,
  samples: FaceSamples
): Sticker | null {
  const centre = colourFeature(samples[CENTRE_CELL]);
  let closest: Sticker | null = null;
  let best = SAME_CENTRE;

  for (const other of FACELET_FACES) {
    const scan = taken[other];
    if (other === face || !scan) continue;
    const distance = labDistance(centre, colourFeature(scan[CENTRE_CELL]));
    if (distance < best) {
      best = distance;
      closest = other;
    }
  }

  return closest;
}

/* ------------------------------------------------------------------ */
/* Раскладка по цветам                                                */
/* ------------------------------------------------------------------ */

/**
 * Задача о назначениях: строке — столбец, каждый столбец не более одного раза,
 * сумма стоимостей наименьшая. Классический венгерский алгоритм за n³;
 * здесь n = 48, и считается он за доли миллисекунды.
 */
export function assign(cost: readonly (readonly number[])[]): number[] {
  const rows = cost.length;
  const columns = rows === 0 ? 0 : cost[0].length;
  const INF = Number.POSITIVE_INFINITY;

  // Нумерация с единицы: нулевой столбец — фиктивный, так короче сам алгоритм.
  const u = new Array<number>(rows + 1).fill(0);
  const v = new Array<number>(columns + 1).fill(0);
  const owner = new Array<number>(columns + 1).fill(0);
  const way = new Array<number>(columns + 1).fill(0);

  for (let row = 1; row <= rows; row++) {
    owner[0] = row;
    let column0 = 0;
    const least = new Array<number>(columns + 1).fill(INF);
    const used = new Array<boolean>(columns + 1).fill(false);

    do {
      used[column0] = true;
      const row0 = owner[column0];
      let delta = INF;
      let column1 = 0;

      for (let column = 1; column <= columns; column++) {
        if (used[column]) continue;
        const reduced = cost[row0 - 1][column - 1] - u[row0] - v[column];
        if (reduced < least[column]) {
          least[column] = reduced;
          way[column] = column0;
        }
        if (least[column] < delta) {
          delta = least[column];
          column1 = column;
        }
      }

      for (let column = 0; column <= columns; column++) {
        if (used[column]) {
          u[owner[column]] += delta;
          v[column] -= delta;
        } else {
          least[column] -= delta;
        }
      }
      column0 = column1;
    } while (owner[column0] !== 0);

    do {
      const column1 = way[column0];
      owner[column0] = owner[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const result = new Array<number>(rows).fill(-1);
  for (let column = 1; column <= columns; column++) {
    if (owner[column] !== 0) result[owner[column] - 1] = column - 1;
  }
  return result;
}

/** Наклейка на снимке: где она в раскраске и какого цвета в кадре. */
interface Sample {
  readonly face: Sticker;
  readonly index: number;
  readonly rgb: Rgb;
}

const samplesOf = (scans: Scans): Sample[] =>
  FACELET_FACES.flatMap((face) =>
    scans[face].map((rgb, cell) => ({
      face,
      index: faceletIndex(face, Math.floor(cell / FACE_SIZE), cell % FACE_SIZE),
      rgb,
    }))
  );

const isCentreIndex = (index: number): boolean =>
  FACELET_FACES.some((face) => CENTRE_FACELETS[face] === index);

/** Наклеек каждого цвета, кроме центра. */
const PER_COLOUR = FACELETS_PER_FACE - 1;

/**
 * Раскладывает наклейки по цветам: каждому цвету — ровно восемь, сумма
 * расстояний до эталонов наименьшая.
 */
function distribute(
  features: readonly Lab[],
  references: Readonly<Record<Sticker, Lab>>
): Sticker[] {
  const cost = features.map((feature) =>
    FACELET_FACES.flatMap((colour) =>
      new Array<number>(PER_COLOUR).fill(labDistance(feature, references[colour]))
    )
  );
  return assign(cost).map((column) => FACELET_FACES[Math.floor(column / PER_COLOUR)]);
}

/**
 * Во сколько раз спорная наклейка ближе к своему цвету, чем к любому другому:
 * если меньше, чем в полтора раза, — отметить.
 */
const DOUBT_RATIO = 0.67;

function doubtfulOf(
  features: readonly Lab[],
  colours: readonly Sticker[],
  references: Readonly<Record<Sticker, Lab>>
): boolean[] {
  return features.map((feature, position) => {
    const own = labDistance(feature, references[colours[position]]);
    const other = Math.min(
      ...FACELET_FACES.filter((colour) => colour !== colours[position]).map((colour) =>
        labDistance(feature, references[colour])
      )
    );
    return own > other * DOUBT_RATIO;
  });
}

type Gains = readonly [number, number, number];

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Поправка к каждому каналу снимка, после которой его белые наклейки белые.
 * Самый яркий канал белого не трогается, остальные дотягиваются до него.
 */
function whiteBalance(all: readonly Sample[], colours: ReadonlyMap<number, Sticker>): Record<Sticker, Gains> {
  const measured = new Map<Sticker, Gains>();

  for (const face of FACELET_FACES) {
    const whites = all.filter(
      (sample) => sample.face === face && colours.get(sample.index) === "U"
    );
    if (whites.length === 0) continue;

    const white = [0, 1, 2].map((channel) =>
      Math.max(median(whites.map(({ rgb }) => rgb[channel])), 1)
    );
    const top = Math.max(...white);
    measured.set(face, [top / white[0], top / white[1], top / white[2]]);
  }

  // Снимку без белых — средняя поправка остальных; белый центр есть всегда.
  const known = [...measured.values()];
  const average = [0, 1, 2].map((channel) =>
    Math.exp(known.reduce((sum, gains) => sum + Math.log(gains[channel]), 0) / known.length)
  ) as unknown as Gains;

  return Object.fromEntries(
    FACELET_FACES.map((face) => [face, measured.get(face) ?? average])
  ) as Record<Sticker, Gains>;
}

const corrected = (rgb: Rgb, gains: Gains): Rgb => [
  rgb[0] * gains[0],
  rgb[1] * gains[1],
  rgb[2] * gains[2],
];

/** Эталон цвета — середина всех его наклеек, а не один центр. */
function meanReferences(
  features: readonly Lab[],
  colours: readonly Sticker[]
): Record<Sticker, Lab> {
  return Object.fromEntries(
    FACELET_FACES.map((colour) => {
      const own = features.filter((_, position) => colours[position] === colour);
      const mean = [0, 1, 2].map(
        (axis) => own.reduce((sum, feature) => sum + feature[axis], 0) / own.length
      );
      return [colour, mean as unknown as Lab];
    })
  ) as Record<Sticker, Lab>;
}

/**
 * Раскраска по шести снимкам. Центры ставятся по граням, остальные 48
 * наклеек раскладываются по цветам — по восемь на цвет.
 */
export function recognise(scans: Scans): Recognition {
  const all = samplesOf(scans);
  const stickers = all.filter(({ index }) => !isCentreIndex(index));

  // Первый проход: эталоны — центры, свет у каждого снимка свой.
  const centres = Object.fromEntries(
    FACELET_FACES.map((face) => [face, colourFeature(scans[face][CENTRE_CELL])])
  ) as Record<Sticker, Lab>;
  const first = distribute(
    stickers.map(({ rgb }) => colourFeature(rgb)),
    centres
  );

  /*
    Второй: каждый снимок выправлен по своим белым, эталоны — по девяти
    наклейкам. Третий проход пробовался и не исправил ни одного кубика из
    почти пятисот в пробных прогонах: ошибка второго прохода — это белый, принятый
    за жёлтый ещё в первом, и выправление её уже не видит.
  */
  const known = new Map<number, Sticker>(
    FACELET_FACES.map((face) => [CENTRE_FACELETS[face], face])
  );
  stickers.forEach(({ index }, position) => known.set(index, first[position]));

  const gains = whiteBalance(all, known);
  const references = meanReferences(
    all.map(({ face, rgb }) => colourFeature(corrected(rgb, gains[face]))),
    all.map(({ index }) => known.get(index) as Sticker)
  );
  const features = stickers.map(({ face, rgb }) => colourFeature(corrected(rgb, gains[face])));
  const colours = distribute(features, references);
  const doubts = doubtfulOf(features, colours, references);

  const painting = new Array<Sticker>(FACELET_COUNT);
  for (const face of FACELET_FACES) painting[CENTRE_FACELETS[face]] = face;
  stickers.forEach(({ index }, position) => {
    painting[index] = colours[position];
  });

  const doubtful = stickers
    .filter((_, position) => doubts[position])
    .map(({ index }) => index)
    .sort((a, b) => a - b);

  return { painting, doubtful };
}
