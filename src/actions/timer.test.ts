/**
 * saveSolve — публичная точка входа: урок в неё приходит из адреса, который
 * пишется руками. Тесты закрепляют, что подложенный урок не ломает сохранение
 * и не попадает в базу, а принятый — пишется рядом со своим скрамблом.
 */

const auth = jest.fn();
const upsert = jest.fn();
const create = jest.fn();

jest.mock("@/auth", () => ({ auth: () => auth() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { upsert: (...args: unknown[]) => upsert(...args) },
    solve: { create: (...args: unknown[]) => create(...args) },
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
  auth.mockResolvedValue({ user: { id: "user-1" } });
  upsert.mockResolvedValue({});
  create.mockResolvedValue({});
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
