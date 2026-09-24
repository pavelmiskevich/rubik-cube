import {
  CENTRE_FACELETS,
  FACELET_FACES,
  FACE_SIZE,
  Facelets,
  Sticker,
  checkFacelets,
  faceletIndex,
  stateToFacelets,
} from "@/lib/cube/facelets";
import { MOVES, applySequence } from "@/lib/cube/moves";
import { SOLVED_CUBE } from "@/lib/cube/state";
import {
  FaceSamples,
  Rgb,
  Scans,
  assign,
  colourDistance,
  isTooDark,
  recognise,
  sameCentreAs,
} from "./recognition";

/*
  Камеры здесь нет: кубик «фотографируется» арифметикой. Цвет наклейки при
  дневном свете умножается на свет лампы и на тень, к нему добавляется шум
  матрицы — ровно то, что портит распознавание в жизни. Случайности заданы
  зерном, чтобы упавший тест падал одинаково у всех.
*/

/** Так камера телефона видит наклейки при дневном свете. */
const DAYLIGHT: Readonly<Record<Sticker, Rgb>> = {
  U: [228, 230, 226],
  D: [238, 212, 38],
  F: [24, 158, 84],
  B: [22, 78, 180],
  R: [190, 28, 38],
  L: [245, 112, 28],
};

type Light = readonly [number, number, number];

const NEUTRAL: Light = [1, 1, 1];
/** Лампа накаливания: синего почти нет, зелёного меньше. */
const WARM_LAMP: Light = [1, 0.8, 0.5];
/** Тень у окна: свет неба, холоднее прямого. */
const COOL_SHADE: Light = [0.85, 0.95, 1.1];

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scrambled(seed: number): Facelets {
  const next = random(seed);
  const moves = Array.from({ length: 25 }, () => MOVES[Math.floor(next() * MOVES.length)]);
  return stateToFacelets(applySequence(SOLVED_CUBE, moves));
}

const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

interface Conditions {
  /** Свет на каждом из шести снимков — камера подстраивается под каждый кадр по-своему. */
  light?: (face: Sticker) => Light;
  /** Во сколько раз темнее наклейка: 1 — на свету, 0.3 — в глубокой тени. */
  shade?: (face: Sticker, cell: number, colour: Sticker) => number;
  /** Разброс шума матрицы, в единицах канала. */
  noise?: number;
  seed?: number;
}

/** Шесть снимков кубика с раскраской `facelets` при заданном освещении. */
function photograph(facelets: Facelets, conditions: Conditions = {}): Scans {
  const { light = () => NEUTRAL, shade = () => 1, noise = 0, seed = 1 } = conditions;
  const next = random(seed);
  const jitter = () => (next() * 2 - 1) * noise;

  const scans = {} as Record<Sticker, FaceSamples>;
  for (const face of FACELET_FACES) {
    const lamp = light(face);
    const samples: Rgb[] = [];
    for (let row = 0; row < FACE_SIZE; row++) {
      for (let column = 0; column < FACE_SIZE; column++) {
        const colour = facelets[faceletIndex(face, row, column)];
        const dim = shade(face, row * FACE_SIZE + column, colour);
        const base = DAYLIGHT[colour];
        samples.push([
          clamp(base[0] * lamp[0] * dim + jitter()),
          clamp(base[1] * lamp[1] * dim + jitter()),
          clamp(base[2] * lamp[2] * dim + jitter()),
        ]);
      }
    }
    scans[face] = samples;
  }
  return scans;
}

const SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);

describe("recognise: раскраска по шести снимкам", () => {
  it("узнаёт собранный кубик при дневном свете и ни в чём не сомневается", () => {
    const solved = stateToFacelets(SOLVED_CUBE);
    const result = recognise(photograph(solved));

    expect(result.painting).toEqual(solved);
    expect(result.doubtful).toEqual([]);
  });

  it("узнаёт скрамблы при дневном свете с тенями и шумом", () => {
    for (const seed of SEEDS) {
      const facelets = scrambled(seed);
      const next = random(seed * 3);
      const result = recognise(
        photograph(facelets, {
          seed,
          noise: 8,
          shade: () => 0.5 + next() * 0.5,
        })
      );
      expect(result.painting).toEqual(facelets);
    }
  });

  it("узнаёт скрамблы под лампой накаливания: жёлтый не становится белым", () => {
    for (const seed of SEEDS) {
      const facelets = scrambled(seed);
      const next = random(seed * 7);
      const result = recognise(
        photograph(facelets, {
          seed,
          noise: 10,
          light: () => WARM_LAMP,
          shade: () => 0.5 + next() * 0.5,
        })
      );
      expect(result.painting).toEqual(facelets);
    }
  });

  it("узнаёт белый в глубокой тени: он не становится ни синим, ни жёлтым", () => {
    for (const seed of SEEDS) {
      const facelets = scrambled(seed);
      const result = recognise(
        photograph(facelets, {
          seed,
          noise: 6,
          shade: (_face, _cell, colour) => (colour === "U" ? 0.3 : 1),
          light: (face) => (face === "U" || face === "B" ? COOL_SHADE : NEUTRAL),
        })
      );
      expect(result.painting).toEqual(facelets);
    }
  });

  it("узнаёт кубик, когда камера на каждом снимке подстроилась под свет по-своему", () => {
    const lights: Readonly<Record<Sticker, Light>> = {
      U: WARM_LAMP,
      R: NEUTRAL,
      F: [1, 0.88, 0.7],
      D: COOL_SHADE,
      L: WARM_LAMP,
      B: [0.95, 1, 1.05],
    };

    for (const seed of SEEDS) {
      const facelets = scrambled(seed);
      const result = recognise(
        photograph(facelets, { seed, noise: 8, light: (face) => lights[face] })
      );
      expect(result.painting).toEqual(facelets);
    }
  });

  it("узнаёт кубик, когда жёлтый снят под лампой, а оранжевый — в тени у окна", () => {
    // Худший случай: жёлтый центр в кадре уходит в оранжевый, оранжевый — в бледный.
    const lights: Readonly<Record<Sticker, Light>> = {
      U: NEUTRAL,
      R: [1, 0.85, 0.6],
      F: COOL_SHADE,
      D: WARM_LAMP,
      L: COOL_SHADE,
      B: [1, 0.75, 0.45],
    };

    for (const seed of SEEDS) {
      const facelets = scrambled(seed);
      const result = recognise(
        photograph(facelets, { seed, noise: 6, light: (face) => lights[face] })
      );
      expect(result.painting).toEqual(facelets);
    }
  });

  it("узнаёт кубик, когда белую грань сняли под сильной лампой, а остальные — днём", () => {
    // Белый центр здесь желтее, чем жёлтые наклейки на других снимках в тени:
    // по одним центрам не решить, помогает выправление каждого снимка по его белым.
    for (let seed = 1; seed <= 60; seed++) {
      const facelets = scrambled(seed);
      const result = recognise(
        photograph(facelets, {
          seed,
          noise: 6,
          light: (face) => (face === "U" ? [1, 0.72, 0.38] : NEUTRAL),
        })
      );
      expect(result.painting).toEqual(facelets);
    }
  });

  it("центры ставит по граням, что бы ни показала камера", () => {
    const scans = photograph(stateToFacelets(SOLVED_CUBE));
    const result = recognise(scans);

    for (const face of FACELET_FACES) {
      expect(result.painting[CENTRE_FACELETS[face]]).toBe(face);
    }
  });

  it("раздаёт каждого цвета ровно по девять наклеек", () => {
    const result = recognise(photograph(scrambled(3), { noise: 25, seed: 3 }));

    for (const face of FACELET_FACES) {
      expect(result.painting.filter((sticker) => sticker === face)).toHaveLength(9);
    }
  });

  it("спорную наклейку решает счётом цветов и отмечает как сомнительную", () => {
    const solved = stateToFacelets(SOLVED_CUBE);
    const scans = photograph(solved) as Record<Sticker, Rgb[]>;
    // Оранжевая наклейка в блике лампы: по цвету она ближе к красному.
    scans.L = [...scans.L];
    scans.L[0] = [205, 50, 36];

    const result = recognise(scans);
    const index = faceletIndex("L", 0, 0);

    expect(colourDistance(scans.L[0], DAYLIGHT.R)).toBeLessThan(
      colourDistance(scans.L[0], DAYLIGHT.L)
    );
    expect(result.painting[index]).toBe("L");
    expect(result.doubtful).toContain(index);
  });
});

/*
  Образцы ниже — значения пикселей, какими их отдаёт камера телефона, а не
  арифметика: так выглядят наклейки под лампой накаливания и в тени.
*/
describe("recognise: живые образцы пикселей", () => {
  /** Собранный кубик под тёплой лампой; тень задевает часть белой грани. */
  const LAMP: Readonly<Record<Sticker, Rgb>> = {
    U: [246, 222, 172],
    D: [252, 184, 46],
    F: [58, 150, 62],
    B: [34, 70, 120],
    R: [205, 34, 22],
    L: [250, 112, 20],
  };

  const faceOf = (colour: Rgb, overrides: Record<number, Rgb> = {}): Rgb[] =>
    Array.from({ length: 9 }, (_, cell) => overrides[cell] ?? colour);

  it("жёлтый под лампой накаливания остаётся жёлтым, а белый — белым", () => {
    const scans: Scans = {
      U: faceOf(LAMP.U, { 0: [238, 214, 160], 8: [250, 230, 186] }),
      D: faceOf(LAMP.D, { 2: [246, 176, 40], 6: [255, 196, 64] }),
      F: faceOf(LAMP.F),
      B: faceOf(LAMP.B),
      R: faceOf(LAMP.R),
      L: faceOf(LAMP.L),
    };

    const result = recognise(scans);
    expect(result.painting).toEqual(stateToFacelets(SOLVED_CUBE));
  });

  it("белый в тени — это белый, а не синий и не серый жёлтый", () => {
    const shaded: Rgb = [88, 92, 104];
    const deeper: Rgb = [62, 64, 76];
    const scans: Scans = {
      U: faceOf([224, 226, 222], { 0: shaded, 1: shaded, 3: deeper, 4: [220, 222, 220] }),
      D: faceOf(DAYLIGHT.D),
      F: faceOf(DAYLIGHT.F),
      B: faceOf(DAYLIGHT.B),
      R: faceOf(DAYLIGHT.R),
      L: faceOf(DAYLIGHT.L),
    };

    const result = recognise(scans);
    expect(result.painting).toEqual(stateToFacelets(SOLVED_CUBE));
  });

  it("под одной лампой жёлтый ближе к жёлтому центру, чем к белому", () => {
    const yellow: Rgb = [255, 196, 64];
    expect(colourDistance(yellow, LAMP.D)).toBeLessThan(colourDistance(yellow, LAMP.U));

    const white: Rgb = [238, 214, 160];
    expect(colourDistance(white, LAMP.U)).toBeLessThan(colourDistance(white, LAMP.D));
  });

  it("яркость на цвет не влияет: белый в тени рядом с белым на свету", () => {
    expect(colourDistance([88, 92, 104], [224, 226, 222])).toBeLessThan(
      colourDistance([88, 92, 104], DAYLIGHT.B)
    );
    expect(colourDistance([95, 14, 19], DAYLIGHT.R)).toBeLessThan(
      colourDistance([95, 14, 19], DAYLIGHT.L)
    );
  });
});

describe("ошибка распознавания", () => {
  it("кубик, снятый не той стороной, ловит проверка собираемости", () => {
    const facelets = scrambled(11);
    const scans = photograph(facelets) as Record<Sticker, Rgb[]>;
    // Верх сняли, повернув кубик на четверть: строки стали столбцами.
    const up = scans.U;
    scans.U = Array.from({ length: 9 }, (_, cell) => {
      const row = Math.floor(cell / 3);
      const column = cell % 3;
      return up[column * 3 + (2 - row)];
    });

    const check = checkFacelets(recognise(scans).painting);

    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.problems.length).toBeGreaterThan(0);
      expect(check.problems[0].message).toMatch(/[а-я]/);
    }
  });
});

describe("assign", () => {
  it("находит назначение с наименьшей суммой, а не жадное", () => {
    // Жадно: строка 0 берёт столбец 0 (1), строке 1 остаётся 100. Лучше 2 + 3.
    const cost = [
      [1, 2],
      [3, 100],
    ];
    expect(assign(cost)).toEqual([1, 0]);
  });

  it("раздаёт столбцы без повторов и при лишних столбцах", () => {
    const cost = [
      [5, 1, 9, 9],
      [5, 1, 9, 9],
      [9, 9, 2, 9],
    ];
    const result = assign(cost);

    expect(new Set(result).size).toBe(3);
    expect(result[2]).toBe(2);
    expect(result.slice(0, 2).sort()).toEqual([0, 1]);
  });
});

describe("isTooDark", () => {
  it("узнаёт снимок, на котором ничего не видно", () => {
    expect(isTooDark(Array.from({ length: 9 }, (): Rgb => [18, 14, 12]))).toBe(true);
  });

  it("не путает с темнотой синюю грань", () => {
    expect(isTooDark(Array.from({ length: 9 }, (): Rgb => [22, 60, 140]))).toBe(false);
  });

  it("не путает с темнотой грань в полутени", () => {
    expect(isTooDark(Array.from({ length: 9 }, (): Rgb => [90, 70, 40]))).toBe(false);
  });
});

describe("sameCentreAs", () => {
  const solvedScans = photograph(stateToFacelets(SOLVED_CUBE), { noise: 6, seed: 5 });

  it("узнаёт, что грань с этим центром уже снимали", () => {
    const taken = { F: solvedScans.F, R: solvedScans.R };
    expect(sameCentreAs(taken, "B", solvedScans.F)).toBe("F");
  });

  it("молчит, когда центр новый", () => {
    const taken = { F: solvedScans.F, R: solvedScans.R };
    expect(sameCentreAs(taken, "B", solvedScans.B)).toBeNull();
  });

  it("не сравнивает грань с её же прежним снимком", () => {
    const taken = { F: solvedScans.F };
    expect(sameCentreAs(taken, "F", solvedScans.F)).toBeNull();
  });
});
