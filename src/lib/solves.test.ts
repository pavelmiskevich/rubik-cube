const findMany = jest.fn();
const groupBy = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    solve: {
      findMany: (...args: unknown[]) => findMany(...args),
      groupBy: (...args: unknown[]) => groupBy(...args),
    },
  },
}));

import { getSolveLessonSlugsForUser, getSolvesForUser, toSolveResults } from "./solves";

beforeEach(() => {
  findMany.mockReset();
  groupBy.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("отображение строк базы в доменную модель", () => {
  it("переносит идентификатор, время и флаги", () => {
    expect(
      toSolveResults([
        { id: "a", timeMs: 12450, isDNF: false, isPlusTwo: true },
        { id: "b", timeMs: 9800, isDNF: true, isPlusTwo: false },
      ])
    ).toEqual([
      { id: "a", timeMs: 12450, isDNF: false, isPlusTwo: true },
      { id: "b", timeMs: 9800, isDNF: true, isPlusTwo: false },
    ]);
  });

  it("на пустом списке возвращает пустой", () => {
    expect(toSolveResults([])).toEqual([]);
  });
});

describe("getSolvesForUser", () => {
  const rows = [
    { id: "new", timeMs: 9000, isDNF: false, isPlusTwo: false },
    { id: "old", timeMs: 11000, isDNF: false, isPlusTwo: false },
  ];

  it("без урока читает все сборки пользователя, включая свободные, и отдаёт их по порядку", async () => {
    findMany.mockResolvedValue(rows);

    const solves = await getSolvesForUser("user-1");

    expect(findMany.mock.calls[0][0].where).toEqual({ trainingSession: { userId: "user-1" } });
    expect(solves.map((solve) => solve.id)).toEqual(["old", "new"]);
  });

  it("с уроком читает только сборки этого урока", async () => {
    findMany.mockResolvedValue(rows);

    await getSolvesForUser("user-1", { lessonSlug: "pairs" });

    expect(findMany.mock.calls[0][0].where).toEqual({
      trainingSession: { userId: "user-1" },
      lessonSlug: "pairs",
    });
  });

  it("недоступная база даёт пустую историю, а не пятисотку", async () => {
    findMany.mockRejectedValue(new Error("connection refused"));

    await expect(getSolvesForUser("user-1", { lessonSlug: "pairs" })).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("getSolveLessonSlugsForUser", () => {
  it("читает уроки только этого пользователя, по одному, без свободных сборок", async () => {
    groupBy.mockResolvedValue([{ lessonSlug: "pairs" }, { lessonSlug: "two-look" }]);

    const slugs = await getSolveLessonSlugsForUser("user-1");

    // groupBy, а не findMany с distinct: distinct Prisma делает в памяти,
    // вытягивая из базы каждую размеченную сборку человека.
    expect(groupBy).toHaveBeenCalledWith({
      by: ["lessonSlug"],
      where: { trainingSession: { userId: "user-1" }, lessonSlug: { not: null } },
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(slugs).toEqual(["pairs", "two-look"]);
  });

  it("недоступная база даёт пустой выбор — остаются «все сборки»", async () => {
    groupBy.mockRejectedValue(new Error("connection refused"));

    await expect(getSolveLessonSlugsForUser("user-1")).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
