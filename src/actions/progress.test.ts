/**
 * Серверное действие — публичная точка входа: его может дёрнуть кто угодно и с
 * чем угодно. Тесты закрепляют три вещи: пишет только от имени сессии, пишет
 * одну строку на урок и не падает, когда база недоступна.
 */

const auth = jest.fn();
const upsert = jest.fn();
const findMany = jest.fn();

jest.mock("@/auth", () => ({ auth: () => auth() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    lessonProgress: {
      upsert: (...args: unknown[]) => upsert(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

import { saveLessonProgress } from "./progress";
import { getLessonProgressForUser } from "@/lib/lessonProgressDb";
import { LESSONS } from "@/content/lessons";

const lesson = LESSONS[0];
const lastStep = lesson.steps.length - 1;

beforeEach(() => {
  auth.mockReset();
  upsert.mockReset();
  findMany.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("saveLessonProgress", () => {
  it("без входа ничего не пишет", async () => {
    auth.mockResolvedValue(null);

    const result = await saveLessonProgress(lesson.slug, 1, false);

    expect(result.success).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("пишет от имени текущей сессии, одной строкой на пару «пользователь + урок»", async () => {
    auth.mockResolvedValue({ user: { id: "user-1" } });
    upsert.mockResolvedValue({});

    const result = await saveLessonProgress(lesson.slug, 1, false);

    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_lessonSlug: { userId: "user-1", lessonSlug: lesson.slug } },
      create: { userId: "user-1", lessonSlug: lesson.slug, stepIndex: 1, completed: false },
      update: { stepIndex: 1 },
    });
  });

  it("завершение ставит отметку, а незавершённый шаг её не снимает", async () => {
    auth.mockResolvedValue({ user: { id: "user-1" } });
    upsert.mockResolvedValue({});

    await saveLessonProgress(lesson.slug, lastStep, true);
    expect(upsert.mock.calls[0][0].update).toEqual({ stepIndex: lastStep, completed: true });

    await saveLessonProgress(lesson.slug, 0, false);
    // Нет поля completed — нет и способа сбросить отметку повторным проходом.
    expect(upsert.mock.calls[1][0].update).toEqual({ stepIndex: 0 });
  });

  it("не принимает неизвестный урок", async () => {
    auth.mockResolvedValue({ user: { id: "user-1" } });

    const result = await saveLessonProgress("no-such-lesson", 0, true);

    expect(result.success).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("не принимает мусор вместо шага", async () => {
    auth.mockResolvedValue({ user: { id: "user-1" } });

    for (const bad of [-1, 1.5, Number.NaN, "1" as unknown as number]) {
      expect((await saveLessonProgress(lesson.slug, bad, false)).success).toBe(false);
    }
    expect(
      (await saveLessonProgress(lesson.slug, 0, "true" as unknown as boolean)).success
    ).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("шаг за пределами урока прижимается к последнему", async () => {
    auth.mockResolvedValue({ user: { id: "user-1" } });
    upsert.mockResolvedValue({});

    await saveLessonProgress(lesson.slug, 999, false);

    expect(upsert.mock.calls[0][0].create.stepIndex).toBe(lastStep);
  });

  it("недоступная база даёт размеченную ошибку, а не исключение", async () => {
    auth.mockResolvedValue({ user: { id: "user-1" } });
    upsert.mockRejectedValue(new Error("connection refused"));

    const result = await saveLessonProgress(lesson.slug, 1, false);

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("getLessonProgressForUser", () => {
  it("читает только строки этого пользователя и раскладывает по урокам", async () => {
    findMany.mockResolvedValue([
      { lessonSlug: lesson.slug, stepIndex: 2, completed: true },
      { lessonSlug: "removed-lesson", stepIndex: 1, completed: false },
    ]);

    const progress = await getLessonProgressForUser("user-1");

    expect(findMany.mock.calls[0][0].where).toEqual({ userId: "user-1" });
    expect(progress).toEqual({ [lesson.slug]: { stepIndex: 2, completed: true } });
  });

  it("недоступная база даёт пустой прогресс, а не пятисотку", async () => {
    findMany.mockRejectedValue(new Error("connection refused"));

    await expect(getLessonProgressForUser("user-1")).resolves.toEqual({});
    expect(console.error).toHaveBeenCalled();
  });
});
