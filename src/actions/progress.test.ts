/**
 * Серверное действие — публичная точка входа: его может дёрнуть кто угодно и с
 * чем угодно. Тесты закрепляют три вещи: пишет только от имени сессии, пишет
 * одну строку на урок и не падает, когда база недоступна.
 */

const auth = jest.fn();
const upsert = jest.fn();
const findMany = jest.fn();
const transaction = jest.fn();

jest.mock("@/auth", () => ({ auth: () => auth() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    lessonProgress: {
      upsert: (...args: unknown[]) => upsert(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { mergeLessonProgress, saveLessonProgress } from "./progress";
import { getLessonProgressForUser } from "@/lib/lessonProgressDb";
import { LESSONS } from "@/content/lessons";

const lesson = LESSONS[0];
const lastStep = lesson.steps.length - 1;

beforeEach(() => {
  auth.mockReset();
  upsert.mockReset();
  findMany.mockReset();
  transaction.mockReset();
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

describe("mergeLessonProgress — прогресс анонима в аккаунт при входе", () => {
  const other = LESSONS[1];

  /** Каждый upsert в транзакции узнаётся по своим аргументам. */
  function signedIn(rows: { lessonSlug: string; stepIndex: number; completed: boolean }[]) {
    auth.mockResolvedValue({ user: { id: "user-1" } });
    findMany.mockResolvedValue(rows);
    upsert.mockImplementation((args: unknown) => ({ upsert: args }));
    transaction.mockImplementation(async (ops: unknown[]) => ops);
  }

  const written = () =>
    (transaction.mock.calls[0]?.[0] ?? []).map((op: { upsert: unknown }) => op.upsert);

  it("без входа ничего не читает и не пишет", async () => {
    auth.mockResolvedValue(null);

    const result = await mergeLessonProgress({ [lesson.slug]: { stepIndex: 1, completed: false } });

    expect(result.success).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("пустой базе достаётся всё, что прошёл аноним, от имени текущей сессии", async () => {
    signedIn([]);

    const result = await mergeLessonProgress({
      [lesson.slug]: { stepIndex: 1, completed: false },
      [other.slug]: { stepIndex: 0, completed: true },
    });

    expect(result).toEqual({ success: true, written: 2 });
    expect(findMany.mock.calls[0][0].where.userId).toBe("user-1");
    expect(written()).toEqual([
      {
        where: { userId_lessonSlug: { userId: "user-1", lessonSlug: lesson.slug } },
        create: { userId: "user-1", lessonSlug: lesson.slug, stepIndex: 1, completed: false },
        update: { stepIndex: 1 },
      },
      {
        where: { userId_lessonSlug: { userId: "user-1", lessonSlug: other.slug } },
        create: { userId: "user-1", lessonSlug: other.slug, stepIndex: 0, completed: true },
        update: { stepIndex: 0, completed: true },
      },
    ]);
  });

  it("аккаунт, где урок пройден дальше, назад не откатывается", async () => {
    signedIn([{ lessonSlug: lesson.slug, stepIndex: 3, completed: true }]);

    const result = await mergeLessonProgress({ [lesson.slug]: { stepIndex: 1, completed: false } });

    expect(result).toEqual({ success: true, written: 0 });
    expect(transaction).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("пишет слитую запись: больший шаг из базы и отметку анонима", async () => {
    signedIn([{ lessonSlug: lesson.slug, stepIndex: 3, completed: false }]);

    await mergeLessonProgress({ [lesson.slug]: { stepIndex: 1, completed: true } });

    expect(written()).toEqual([
      expect.objectContaining({ update: { stepIndex: 3, completed: true } }),
    ]);
  });

  it("незавершённая запись в update не несёт поля completed — снять отметку нечем", async () => {
    signedIn([{ lessonSlug: lesson.slug, stepIndex: 0, completed: false }]);

    await mergeLessonProgress({ [lesson.slug]: { stepIndex: 2, completed: false } });

    expect(written()[0].update).toEqual({ stepIndex: 2 });
  });

  it("мусор и неизвестные уроки отбрасываются, база не трогается", async () => {
    signedIn([]);

    const junk = [null, "строка", [1, 2], { "no-such-lesson": { stepIndex: 1, completed: true } }];
    for (const bad of junk) {
      expect(await mergeLessonProgress(bad)).toEqual({ success: true, written: 0 });
    }
    expect(findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("шаг за пределами урока прижимается к последнему", async () => {
    signedIn([]);

    await mergeLessonProgress({ [lesson.slug]: { stepIndex: 999, completed: false } });

    expect(written()[0].create.stepIndex).toBe(lastStep);
  });

  it("недоступная при чтении база — размеченная ошибка и ни одной записи", async () => {
    signedIn([]);
    findMany.mockRejectedValue(new Error("connection refused"));

    const result = await mergeLessonProgress({ [lesson.slug]: { stepIndex: 1, completed: false } });

    // Прочитать не вышло — писать вслепую нельзя: так можно откатить прогресс,
    // который в базе дальше локального.
    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(transaction).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("сбой записи — размеченная ошибка, а не исключение", async () => {
    signedIn([]);
    transaction.mockRejectedValue(new Error("deadlock"));

    const result = await mergeLessonProgress({ [lesson.slug]: { stepIndex: 1, completed: false } });

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(console.error).toHaveBeenCalled();
  });
});
