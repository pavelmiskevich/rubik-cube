import { CubeState, SOLVED_CUBE } from "./state";
import { applyNotation, applySequence, formatSequence } from "./moves";
import { isSolved } from "./predicates";
import { generateScramble } from "@/lib/scrambler";
import {
  DEFAULT_TARGET_LENGTH,
  DEFAULT_TIME_LIMIT_MS,
  MAX_SOLUTION_LENGTH,
  solveShort,
} from "./shortSolver";
import { getTables } from "./shortSolverTables";

/**
 * Проверка короткого решателя на выборке, а не на примерах.
 *
 * Главное свойство — любое собираемое положение решается: решение, применённое
 * движком к исходному положению, даёт собранный куб. Оно проверяется на сотне
 * скрамблов из `scrambler.ts` и на положениях, выбранных равномерно из всех
 * возможных, — у скрамбла из двадцати пяти ходов распределение немного другое.
 *
 * Генератор случайных чисел с фиксированным зерном: тест, зависящий от удачи,
 * однажды падает на чужой ветке и не воспроизводится.
 *
 * Таблицы строятся один раз на весь файл (`getTables` хранит их в модуле) —
 * это треть секунды, и платить её в каждом тесте незачем.
 */

/**
 * Пороги, закреплённые тестом. Длина — с запасом над тем, что поиск выдаёт на
 * этой выборке (в среднем около 21,5 хода при цели 22), чтобы медленная машина
 * CI, упёршаяся в предел времени чаще, не роняла проверку. Время — предел
 * поиска плюс запас на последний отрезок между чтениями часов.
 */
const SAMPLE_TARGET = 22;
const MAX_LENGTH = 24;
const MAX_AVERAGE_LENGTH = 22.5;
const TIME_LIMIT_MS = 1000;
const TIME_SLACK_MS = 300;

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

/** Скрамблы настоящего генератора, но с воспроизводимым случаем. */
function scrambles(count: number, seed: number): string[] {
  const spy = jest.spyOn(Math, "random").mockImplementation(seeded(seed));
  try {
    return Array.from({ length: count }, () => generateScramble(25));
  } finally {
    spy.mockRestore();
  }
}

function shuffle(length: number, random: () => number): number[] {
  const values = Array.from({ length }, (_, index) => index);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function parity(values: readonly number[]): number {
  let inversions = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) if (values[j] < values[i]) inversions++;
  }
  return inversions % 2;
}

/** Равномерно случайное собираемое положение: чётности равны, суммы ориентаций сходятся. */
function randomState(random: () => number): CubeState {
  const cornerPermutation = shuffle(8, random);
  const edgePermutation = shuffle(12, random);
  if (parity(cornerPermutation) !== parity(edgePermutation)) {
    [edgePermutation[0], edgePermutation[1]] = [edgePermutation[1], edgePermutation[0]];
  }
  const cornerOrientation = Array.from({ length: 8 }, () => Math.floor(random() * 3));
  cornerOrientation[7] = (3 - (cornerOrientation.slice(0, 7).reduce((a, b) => a + b, 0) % 3)) % 3;
  const edgeOrientation = Array.from({ length: 12 }, () => Math.floor(random() * 2));
  edgeOrientation[11] = edgeOrientation.slice(0, 11).reduce((a, b) => a + b, 0) % 2;
  return { cornerPermutation, cornerOrientation, edgePermutation, edgeOrientation };
}

function timed<T>(run: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = run();
  return { value, ms: performance.now() - start };
}

beforeAll(() => {
  getTables();
});

describe("solveShort", () => {
  it("собранный куб даёт пустое решение", () => {
    expect(solveShort(SOLVED_CUBE)).toEqual([]);
  });

  it("один поворот снимается одним поворотом", () => {
    expect(formatSequence(solveShort(applyNotation("R")))).toBe("R'");
    expect(formatSequence(solveShort(applyNotation("F2")))).toBe("F2");
    expect(formatSequence(solveShort(applyNotation("R U")))).toBe("U' R'");
  });

  it("решает сотню скрамблов: куб собран, длина и время в пределах", () => {
    const lengths: number[] = [];
    for (const scramble of scrambles(100, 20260923)) {
      const state = applyNotation(scramble);
      const { value: solution, ms } = timed(() =>
        solveShort(state, { targetLength: SAMPLE_TARGET, timeLimitMs: TIME_LIMIT_MS })
      );

      if (!isSolved(applySequence(state, solution))) {
        throw new Error(`Скрамбл «${scramble}» не собран решением «${formatSequence(solution)}»`);
      }
      expect(solution.length).toBeLessThanOrEqual(MAX_LENGTH);
      expect(ms).toBeLessThan(TIME_LIMIT_MS + TIME_SLACK_MS);
      lengths.push(solution.length);
    }

    const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    expect(average).toBeLessThanOrEqual(MAX_AVERAGE_LENGTH);
  });

  it("решает равномерно случайные положения с настройками экрана", () => {
    const random = seeded(54);
    for (let sample = 0; sample < 12; sample++) {
      const state = randomState(random);
      const { value: solution, ms } = timed(() => solveShort(state));

      expect(isSolved(applySequence(state, solution))).toBe(true);
      expect(solution.length).toBeLessThanOrEqual(MAX_LENGTH);
      expect(ms).toBeLessThan(DEFAULT_TIME_LIMIT_MS + TIME_SLACK_MS);
    }
  });

  it("решает суперфлип — положение, до которого двадцать ходов от любого начала", () => {
    const superflip = applyNotation("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
    expect(superflip.edgeOrientation.every((value) => value === 1)).toBe(true);
    expect(superflip.edgePermutation).toEqual(SOLVED_CUBE.edgePermutation);
    const solution = solveShort(superflip);
    expect(isSolved(applySequence(superflip, solution))).toBe(true);
    expect(solution.length).toBeLessThanOrEqual(MAX_LENGTH);
  });

  it("останавливается на цели: решение не длиннее заданного обрывает поиск", () => {
    const state = applyNotation(scrambles(1, 7)[0]);
    const solution = solveShort(state, { targetLength: MAX_SOLUTION_LENGTH, timeLimitMs: 60_000 });
    expect(isSolved(applySequence(state, solution))).toBe(true);
    expect(solution.length).toBeLessThanOrEqual(MAX_SOLUTION_LENGTH);
  });

  it("укладывается в предел времени, даже когда цель недостижима", () => {
    const state = applyNotation(scrambles(1, 11)[0]);
    const { value: solution, ms } = timed(() =>
      solveShort(state, { targetLength: 0, timeLimitMs: 150 })
    );
    expect(isSolved(applySequence(state, solution))).toBe(true);
    expect(ms).toBeLessThan(150 + TIME_SLACK_MS);
  });

  it("без единого найденного решения время не обрывает поиск", () => {
    // Часы, по которым время вышло ещё до начала: решение всё равно будет.
    let tick = 0;
    const state = applyNotation(scrambles(1, 13)[0]);
    const solution = solveShort(state, { timeLimitMs: 0, now: () => tick++ });
    expect(isSolved(applySequence(state, solution))).toBe(true);
    expect(solution.length).toBeLessThanOrEqual(MAX_SOLUTION_LENGTH);
  });

  it("по умолчанию целится в экранные настройки", () => {
    expect(DEFAULT_TARGET_LENGTH).toBeLessThanOrEqual(SAMPLE_TARGET);
    expect(DEFAULT_TIME_LIMIT_MS).toBeLessThanOrEqual(TIME_LIMIT_MS);
  });

  describe("невозможные положения", () => {
    const flipped = (state: CubeState): CubeState => ({
      ...state,
      edgeOrientation: state.edgeOrientation.map((value, slot) => (slot === 0 ? 1 - value : value)),
    });
    const twisted = (state: CubeState): CubeState => ({
      ...state,
      cornerOrientation: state.cornerOrientation.map((value, slot) =>
        slot === 0 ? (value + 1) % 3 : value
      ),
    });
    const swapped = (state: CubeState): CubeState => {
      const edgePermutation = [...state.edgePermutation];
      [edgePermutation[0], edgePermutation[1]] = [edgePermutation[1], edgePermutation[0]];
      return { ...state, edgePermutation };
    };

    it.each([
      ["перевёрнутое ребро", flipped],
      ["повёрнутый угол", twisted],
      ["два переставленных ребра", swapped],
    ])("%s — ошибка, а не зависание", (_, spoil) => {
      expect(() => solveShort(spoil(SOLVED_CUBE))).toThrow("не бывает");
    });
  });
});
