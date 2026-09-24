import { LOCAL_PROGRESS_KEY, type ProgressEntry, type ProgressMap } from "./lessonProgress";
import {
  mergeEntry,
  mergeLocalProgress,
  progressToWrite,
  type LocalProgressStore,
  type MergeLessonProgressResult,
} from "./progressMerge";
import { LESSONS } from "@/content/lessons";

const e = (stepIndex: number, completed: boolean): ProgressEntry => ({ stepIndex, completed });

describe("mergeEntry — правило по одному уроку", () => {
  /*
    Таблица правила: [локальное, из базы, итог]. Побеждает больший номер шага,
    отметка о завершении никогда не снимается — и эти две половины независимы:
    завершённость не тянет за собой шаг, а шаг не тянет завершённость.
  */
  const table: [string, ProgressEntry, ProgressEntry, ProgressEntry][] = [
    ["одинаковые записи", e(2, false), e(2, false), e(2, false)],
    ["локально дальше — шаг берётся локальный", e(4, false), e(1, false), e(4, false)],
    ["в базе дальше — прогресс не откатывается", e(1, false), e(4, false), e(4, false)],
    ["пройден локально — отметка переходит в базу", e(0, true), e(3, false), e(3, true)],
    ["пройден в базе — локальное не снимает отметку", e(5, false), e(0, true), e(5, true)],
    ["пройден с обеих сторон", e(2, true), e(6, true), e(6, true)],
    ["нулевой шаг с обеих сторон", e(0, false), e(0, false), e(0, false)],
  ];

  it.each(table)("%s", (_name, local, remote, expected) => {
    expect(mergeEntry(local, remote)).toEqual(expected);
  });

  /** Все сочетания из небольшой сетки — порядок слияния не должен ни на что влиять. */
  const grid: ProgressEntry[] = [0, 1, 3, 6].flatMap((step) => [e(step, false), e(step, true)]);

  it("не зависит от того, кто слева, а кто справа", () => {
    for (const a of grid) {
      for (const b of grid) {
        expect(mergeEntry(a, b)).toEqual(mergeEntry(b, a));
      }
    }
  });

  it("не зависит от порядка, в котором сливаются три источника", () => {
    for (const a of grid) {
      for (const b of grid) {
        for (const c of grid) {
          expect(mergeEntry(mergeEntry(a, b), c)).toEqual(mergeEntry(a, mergeEntry(b, c)));
        }
      }
    }
  });

  it("завершённый урок не становится незавершённым ни в каком сочетании", () => {
    for (const a of grid) {
      for (const b of grid) {
        if (a.completed || b.completed) expect(mergeEntry(a, b).completed).toBe(true);
      }
    }
  });

  it("повторное слияние с тем же ничего не меняет", () => {
    for (const a of grid) {
      for (const b of grid) {
        const merged = mergeEntry(a, b);
        expect(mergeEntry(merged, b)).toEqual(merged);
        expect(mergeEntry(merged, a)).toEqual(merged);
      }
    }
  });
});

describe("progressToWrite — какие уроки переписать в базе", () => {
  it("урок, которого в базе нет, пишется как есть", () => {
    expect(progressToWrite({ cross: e(2, false) }, {})).toEqual({ cross: e(2, false) });
  });

  it("урок, где база уже впереди или вровень, не пишется вовсе", () => {
    const local: ProgressMap = { cross: e(1, false), "first-layer": e(3, true) };
    const remote: ProgressMap = { cross: e(4, false), "first-layer": e(3, true) };

    expect(progressToWrite(local, remote)).toEqual({});
  });

  it("пишется слитая запись, а не локальная", () => {
    expect(progressToWrite({ cross: e(1, true) }, { cross: e(4, false) })).toEqual({
      cross: e(4, true),
    });
  });

  it("уроки, которых нет в локальном, не трогаются", () => {
    expect(progressToWrite({ cross: e(2, false) }, { "first-layer": e(5, true) })).toEqual({
      cross: e(2, false),
    });
  });
});

/** Хранилище в памяти с тем же контрактом, что у localStorage. */
function memoryStorage(initial: Record<string, string> = {}): LocalProgressStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe("mergeLocalProgress — перенос прогресса анонима в аккаунт", () => {
  const slug = LESSONS[0].slug;
  const saved = () => ({ [LOCAL_PROGRESS_KEY]: JSON.stringify({ [slug]: e(1, false) }) });
  const ok = (written: number) =>
    jest.fn(async (): Promise<MergeLessonProgressResult> => ({ success: true, written }));

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("без локального прогресса на сервер не ходит", async () => {
    const send = ok(0);

    await expect(mergeLocalProgress(memoryStorage(), send)).resolves.toBe("nothing-local");
    await expect(mergeLocalProgress(null, send)).resolves.toBe("nothing-local");
    expect(send).not.toHaveBeenCalled();
  });

  it("отправляет прочитанный прогресс и после успеха очищает локальную копию", async () => {
    const storage = memoryStorage(saved());
    const send = ok(1);

    await expect(mergeLocalProgress(storage, send)).resolves.toBe("merged");
    expect(send).toHaveBeenCalledWith({ [slug]: e(1, false) });
    expect(storage.data).toEqual({});
  });

  it("если база уже впереди, локальная копия всё равно очищается", async () => {
    const storage = memoryStorage(saved());

    await expect(mergeLocalProgress(storage, ok(0))).resolves.toBe("unchanged");
    expect(storage.data).toEqual({});
  });

  it("повторный вход не восстанавливает уже слитый прогресс", async () => {
    const storage = memoryStorage(saved());
    const send = ok(1);

    await mergeLocalProgress(storage, send);
    await expect(mergeLocalProgress(storage, send)).resolves.toBe("nothing-local");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("отказ сервера оставляет локальную копию до следующего входа", async () => {
    const storage = memoryStorage(saved());
    const send = jest.fn(
      async (): Promise<MergeLessonProgressResult> => ({ success: false, error: "база недоступна" })
    );

    await expect(mergeLocalProgress(storage, send)).resolves.toBe("failed");
    expect(storage.data).toEqual(saved());
    expect(console.warn).toHaveBeenCalled();
  });

  it("обрыв связи не бросает исключение и тоже оставляет локальную копию", async () => {
    const storage = memoryStorage(saved());
    const send = jest.fn(async (): Promise<MergeLessonProgressResult> => {
      throw new Error("Failed to fetch");
    });

    await expect(mergeLocalProgress(storage, send)).resolves.toBe("failed");
    expect(storage.data).toEqual(saved());
  });

  it("хранилище, бросающее на каждое обращение, не роняет вход", async () => {
    const hostile: LocalProgressStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const send = ok(1);

    await expect(mergeLocalProgress(hostile, send)).resolves.toBe("nothing-local");
    expect(send).not.toHaveBeenCalled();
  });

  it("не удалось очистить копию после слияния — вход всё равно проходит", async () => {
    const storage: LocalProgressStore = {
      getItem: () => saved()[LOCAL_PROGRESS_KEY],
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };

    // Повторное слияние той же копии безвредно: правило идемпотентно.
    await expect(mergeLocalProgress(storage, ok(1))).resolves.toBe("merged");
  });
});
