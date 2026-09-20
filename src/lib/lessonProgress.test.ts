import {
  LOCAL_PROGRESS_KEY,
  nextProgress,
  parseProgressMap,
  readLocalProgress,
  sanitizeEntry,
  writeLocalProgress,
  type ProgressStorage,
} from "./lessonProgress";

/** Хранилище в памяти с тем же контрактом, что у localStorage. */
function memoryStorage(initial: Record<string, string> = {}): ProgressStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("nextProgress — что записать после действия в уроке", () => {
  it("первое открытие шага создаёт запись", () => {
    expect(nextProgress(undefined, 2, false)).toEqual({ stepIndex: 2, completed: false });
  });

  it("то же, что уже сохранено, повторно не пишется", () => {
    expect(nextProgress({ stepIndex: 2, completed: false }, 2, false)).toBeNull();
  });

  it("нулевой шаг без записи не пишется: открыть урок — ещё не прогресс", () => {
    expect(nextProgress(undefined, 0, false)).toBeNull();
  });

  it("завершение ставит отметку", () => {
    expect(nextProgress({ stepIndex: 3, completed: false }, 3, true)).toEqual({
      stepIndex: 3,
      completed: true,
    });
  });

  it("отметка о завершении не снимается при возврате к началу", () => {
    expect(nextProgress({ stepIndex: 3, completed: true }, 0, false)).toEqual({
      stepIndex: 0,
      completed: true,
    });
  });

  it("повторное завершение того же урока ничего не пишет", () => {
    expect(nextProgress({ stepIndex: 3, completed: true }, 3, true)).toBeNull();
  });
});

describe("sanitizeEntry — проверка того, что пришло извне", () => {
  it("принимает корректную запись", () => {
    expect(sanitizeEntry({ stepIndex: 1, completed: true }, 4)).toEqual({
      stepIndex: 1,
      completed: true,
    });
  });

  it("шаг за пределами урока прижимается к последнему", () => {
    // Урок могли укоротить после того, как человек его прошёл.
    expect(sanitizeEntry({ stepIndex: 9, completed: false }, 4)).toEqual({
      stepIndex: 3,
      completed: false,
    });
  });

  it("отбрасывает мусор", () => {
    expect(sanitizeEntry(null, 4)).toBeNull();
    expect(sanitizeEntry("x", 4)).toBeNull();
    expect(sanitizeEntry({ stepIndex: -1, completed: false }, 4)).toBeNull();
    expect(sanitizeEntry({ stepIndex: 1.5, completed: false }, 4)).toBeNull();
    expect(sanitizeEntry({ stepIndex: 1, completed: "да" }, 4)).toBeNull();
    expect(sanitizeEntry({ stepIndex: 0, completed: false }, 0)).toBeNull();
  });
});

describe("parseProgressMap — прогресс из хранилища", () => {
  const lessons = [
    { slug: "cross", steps: 4 },
    { slug: "corners", steps: 2 },
  ];

  it("оставляет только известные уроки и корректные записи", () => {
    const raw = JSON.stringify({
      cross: { stepIndex: 2, completed: false },
      corners: { stepIndex: "два" },
      gone: { stepIndex: 1, completed: true },
    });
    expect(parseProgressMap(raw, lessons)).toEqual({
      cross: { stepIndex: 2, completed: false },
    });
  });

  it("битый JSON и пустое значение дают пустой прогресс", () => {
    expect(parseProgressMap("{не json", lessons)).toEqual({});
    expect(parseProgressMap(null, lessons)).toEqual({});
    expect(parseProgressMap("[1,2]", lessons)).toEqual({});
  });
});

describe("локальное хранилище", () => {
  const lessons = [{ slug: "cross", steps: 4 }];

  it("записанное читается обратно", () => {
    const storage = memoryStorage();
    writeLocalProgress(storage, "cross", { stepIndex: 1, completed: false });
    expect(readLocalProgress(storage, lessons)).toEqual({
      cross: { stepIndex: 1, completed: false },
    });
  });

  it("запись одного урока не трогает остальные", () => {
    const storage = memoryStorage({
      [LOCAL_PROGRESS_KEY]: JSON.stringify({ other: { stepIndex: 1, completed: true } }),
    });
    writeLocalProgress(storage, "cross", { stepIndex: 2, completed: false });
    expect(JSON.parse(storage.data[LOCAL_PROGRESS_KEY])).toEqual({
      other: { stepIndex: 1, completed: true },
      cross: { stepIndex: 2, completed: false },
    });
  });

  it("недоступное хранилище не роняет урок", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    // Приватный режим, запрет сайта на данные, переполненная квота.
    const broken: ProgressStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(readLocalProgress(broken, lessons)).toEqual({});
    expect(() =>
      writeLocalProgress(broken, "cross", { stepIndex: 1, completed: false })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("без хранилища (на сервере) прогресс пустой", () => {
    expect(readLocalProgress(null, lessons)).toEqual({});
    expect(() => writeLocalProgress(null, "cross", { stepIndex: 1, completed: false })).not.toThrow();
  });
});
