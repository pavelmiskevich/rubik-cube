/**
 * saveSolve — публичная точка входа: урок в неё приходит из адреса, который
 * пишется руками. Тесты закрепляют, что подложенный урок не ломает сохранение
 * и не попадает в базу, а принятый — пишется рядом со своим скрамблом.
 */

const auth = jest.fn();
const upsert = jest.fn();
const create = jest.fn();
const findMany = jest.fn();
const deleteMany = jest.fn();

jest.mock("@/auth", () => ({ auth: () => auth() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { upsert: (...args: unknown[]) => upsert(...args) },
    solve: {
      create: (...args: unknown[]) => create(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      deleteMany: (...args: unknown[]) => deleteMany(...args),
    },
  },
}));

import { saveSolve } from "./timer";
import { LESSONS } from "@/content/lessons";

const practised = LESSONS.find((lesson) => lesson.practice)!;
const plain = LESSONS.find((lesson) => !lesson.practice)!;

/** Что ушло в базу последним вызовом solve.create. */
const written = () => create.mock.calls.at(-1)?.[0].data;

beforeEach(() => {
  auth.mockReset();
  upsert.mockReset();
  create.mockReset();
  findMany.mockReset();
  deleteMany.mockReset();
  // Счётчики лимитов — на globalThis, общие для всех тестов файла.
  (globalThis as { rateLimitBuckets?: Map<string, unknown> }).rateLimitBuckets?.clear();
  delete process.env.MAX_SOLVES_PER_USER;
  auth.mockResolvedValue({ user: { id: "user-1" } });
  upsert.mockResolvedValue({});
  create.mockResolvedValue({});
  findMany.mockResolvedValue([]);
  deleteMany.mockResolvedValue({ count: 0 });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("saveSolve", () => {
  it("без входа ничего не пишет", async () => {
    auth.mockResolvedValue(null);

    const result = await saveSolve(12_345, "R U", practised.slug);

    expect(result.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("без урока — свободная сборка", async () => {
    const result = await saveSolve(12_345, "R U");

    expect(result).toEqual({ success: true });
    expect(written()).toEqual({
      timeMs: 12_345,
      scramble: "R U",
      trainingSessionId: "user-1",
      lessonSlug: null,
    });
  });

  it("сборка с тренируемого урока пишется с уроком и своим скрамблом", async () => {
    const result = await saveSolve(12_345.4, "R U F", practised.slug);

    expect(result).toEqual({ success: true });
    expect(written()).toEqual({
      timeMs: 12_345,
      scramble: "R U F",
      trainingSessionId: "user-1",
      lessonSlug: practised.slug,
    });
  });

  it("несуществующий урок не ломает сохранение и в базу не пишется", async () => {
    const result = await saveSolve(12_345, "R U", "no-such-lesson");

    expect(result).toEqual({ success: true });
    expect(written().lessonSlug).toBeNull();
  });

  it("урок без practice сохраняется свободной сборкой", async () => {
    const result = await saveSolve(12_345, "R U", plain.slug);

    expect(result).toEqual({ success: true });
    expect(written().lessonSlug).toBeNull();
  });

  it("мусор вместо урока сохраняется свободной сборкой", async () => {
    for (const bad of [[practised.slug], { slug: practised.slug }, 42, "x".repeat(10_000)]) {
      expect(await saveSolve(12_345, "R U", bad as unknown as string)).toEqual({ success: true });
      expect(written().lessonSlug).toBeNull();
    }
  });

  it("некорректное время отклоняется и с уроком", async () => {
    const result = await saveSolve(-1, "R U", practised.slug);

    expect(result.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("недоступная база даёт размеченную ошибку, а не исключение", async () => {
    create.mockRejectedValue(new Error("connection refused"));

    const result = await saveSolve(12_345, "R U", practised.slug);

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("saveSolve: лимиты частоты (#126)", () => {
  /** Подменяет часы: лимитер считает окна по Date.now. */
  const clockAt = (ms: number) => jest.spyOn(Date, "now").mockReturnValue(ms);

  it("цикл из тысячи вызовов подряд записывает не больше лимита", async () => {
    clockAt(1_000_000);
    const results = [];
    for (let i = 0; i < 1000; i++) results.push(await saveSolve(12_345, "R U"));

    expect(create).toHaveBeenCalledTimes(10);
    expect(results.filter((r) => r.success)).toHaveLength(10);
    expect(results.at(-1)).toEqual({
      success: false,
      error: expect.stringMatching(/^Слишком часто — попробуйте через \d+ с$/),
    });
  });

  it("обычная тренировка в лимит не упирается: десять сборок подряд проходят", async () => {
    clockAt(1_000_000);
    for (let i = 0; i < 10; i++) {
      expect(await saveSolve(12_345, "R U")).toEqual({ success: true });
    }
    expect(create).toHaveBeenCalledTimes(10);
  });

  it("одиннадцатая подряд отклоняется, а через десять секунд снова пишется", async () => {
    const clock = clockAt(1_000_000);
    for (let i = 0; i < 10; i++) await saveSolve(12_345, "R U");

    expect((await saveSolve(12_345, "R U")).success).toBe(false);

    clock.mockReturnValue(1_000_000 + 10_000);
    expect(await saveSolve(12_345, "R U")).toEqual({ success: true });
    expect(create).toHaveBeenCalledTimes(11);
  });

  it("за час — не больше шестисот, даже по сборке в десять секунд", async () => {
    const clock = clockAt(1_000_000);
    let saved = 0;
    for (let i = 0; i < 700; i++) {
      clock.mockReturnValue(1_000_000 + i * 5_000);
      if ((await saveSolve(12_345, "R U")).success) saved++;
    }
    // 700 сборок по одной в 5 секунд — меньше часа; пройти должны ровно 600.
    expect(saved).toBe(600);
  });

  it("лимит у каждого свой: соседу чужие сборки не мешают", async () => {
    clockAt(1_000_000);
    for (let i = 0; i < 10; i++) await saveSolve(12_345, "R U");

    auth.mockResolvedValue({ user: { id: "user-2" } });
    expect(await saveSolve(12_345, "R U")).toEqual({ success: true });
  });

  it("без входа лимит не расходуется", async () => {
    clockAt(1_000_000);
    auth.mockResolvedValue(null);
    for (let i = 0; i < 20; i++) await saveSolve(12_345, "R U");

    auth.mockResolvedValue({ user: { id: "user-1" } });
    expect(await saveSolve(12_345, "R U")).toEqual({ success: true });
  });
});

describe("saveSolve: потолок числа сборок (#126)", () => {
  it("ищет сборки сверх тысячи у этого человека, от новых к старым", async () => {
    await saveSolve(12_345, "R U");

    expect(findMany).toHaveBeenCalledWith({
      where: { trainingSession: { userId: "user-1" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 1000,
      select: { id: true },
    });
  });

  it("вытесняет самые старые сверх потолка", async () => {
    findMany.mockResolvedValue([{ id: "old-1" }, { id: "old-2" }]);

    expect(await saveSolve(12_345, "R U")).toEqual({ success: true });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old-1", "old-2"] } } });
  });

  it("в пределах потолка ничего не удаляет", async () => {
    await saveSolve(12_345, "R U");

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("потолок берётся из MAX_SOLVES_PER_USER", async () => {
    process.env.MAX_SOLVES_PER_USER = "50";

    await saveSolve(12_345, "R U");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50 }));
  });

  it("сбой вытеснения не теряет записанную сборку", async () => {
    findMany.mockRejectedValue(new Error("timeout"));

    expect(await saveSolve(12_345, "R U")).toEqual({ success: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("неудачная запись ничего не вытесняет", async () => {
    create.mockRejectedValue(new Error("connection refused"));

    await saveSolve(12_345, "R U");

    expect(findMany).not.toHaveBeenCalled();
  });
});
