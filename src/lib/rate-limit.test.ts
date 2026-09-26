/**
 * Ограничитель попыток входа и регистрации. Счётчики живут в памяти модуля,
 * поэтому каждый тест получает свежий экземпляр модуля, а время подменяется
 * часами Jest. Адрес клиента берётся из заголовков обратного прокси — их
 * подменяет мок `next/headers`.
 */

const headers = jest.fn();

jest.mock("next/headers", () => ({ headers: () => headers() }));

let rateLimit: typeof import("./rate-limit").rateLimit;
let getClientIp: typeof import("./rate-limit").getClientIp;
let checkLimit: typeof import("./rate-limit").checkLimit;
let recordFailure: typeof import("./rate-limit").recordFailure;
let resetLimit: typeof import("./rate-limit").resetLimit;

const WINDOW = 60_000;
const opts = { limit: 3, windowMs: WINDOW };

beforeEach(async () => {
  jest.resetModules();
  // Счётчики живут на globalThis (общие для всех копий модуля) — чистим руками.
  delete (globalThis as { rateLimitBuckets?: unknown }).rateLimitBuckets;
  jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
  headers.mockReset();
  ({ rateLimit, getClientIp, checkLimit, recordFailure, resetLimit } = await import("./rate-limit"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("rateLimit", () => {
  it("пропускает ровно limit попыток за окно, следующую отклоняет", () => {
    const results = Array.from({ length: opts.limit + 1 }, () => rateLimit("k", opts).allowed);

    expect(results).toEqual([true, true, true, false]);
  });

  it("отказ сообщает, сколько осталось до конца окна", () => {
    for (let i = 0; i < opts.limit; i++) rateLimit("k", opts);
    jest.advanceTimersByTime(20_000);

    expect(rateLimit("k", opts)).toEqual({ allowed: false, retryAfterMs: WINDOW - 20_000 });
  });

  it("отклонённые попытки не продлевают окно", () => {
    for (let i = 0; i < opts.limit; i++) rateLimit("k", opts);
    for (let i = 0; i < 50; i++) {
      jest.advanceTimersByTime(1_000);
      rateLimit("k", opts);
    }

    // 50 с долбёжки не сдвинули конец окна: до него по-прежнему 10 с.
    expect(rateLimit("k", opts).retryAfterMs).toBe(WINDOW - 50_000);
  });

  it("до конца окна отказ держится, с концом окна счёт начинается заново", () => {
    for (let i = 0; i < opts.limit; i++) rateLimit("k", opts);

    jest.advanceTimersByTime(WINDOW - 1);
    expect(rateLimit("k", opts).allowed).toBe(false);

    jest.advanceTimersByTime(1);
    const fresh = Array.from({ length: opts.limit + 1 }, () => rateLimit("k", opts).allowed);
    expect(fresh).toEqual([true, true, true, false]);
  });

  it("окно отсчитывается от первой попытки, а не от последней", () => {
    rateLimit("k", opts);
    jest.advanceTimersByTime(WINDOW - 1_000);
    rateLimit("k", opts);
    rateLimit("k", opts);
    expect(rateLimit("k", opts).allowed).toBe(false);

    jest.advanceTimersByTime(1_000);
    expect(rateLimit("k", opts).allowed).toBe(true);
  });

  it("счётчики разных ключей независимы", () => {
    for (let i = 0; i < opts.limit; i++) rateLimit("login:1.1.1.1", opts);

    expect(rateLimit("login:1.1.1.1", opts).allowed).toBe(false);
    expect(rateLimit("login:2.2.2.2", opts).allowed).toBe(true);
    expect(rateLimit("register:1.1.1.1", opts).allowed).toBe(true);
  });

  it("поток уникальных ключей не сбрасывает живые счётчики", () => {
    for (let i = 0; i < opts.limit; i++) rateLimit("attacker", opts);

    // Заполняем карту до предела: на переполнении идёт чистка, и она не
    // должна задеть ещё действующее окно — иначе поток мусорных ключей
    // снимал бы блокировку.
    for (let i = 0; i < 10_001; i++) rateLimit(`junk:${i}`, opts);

    expect(rateLimit("attacker", opts).allowed).toBe(false);
  });

  it("чистка на переполнении не мешает новым ключам после истечения старых", () => {
    for (let i = 0; i < 10_000; i++) rateLimit(`old:${i}`, opts);
    jest.advanceTimersByTime(WINDOW);

    const fresh = Array.from({ length: opts.limit + 1 }, () => rateLimit("new", opts).allowed);
    expect(fresh).toEqual([true, true, true, false]);
    expect(rateLimit("old:0", opts).allowed).toBe(true);
  });
});

describe("checkLimit, recordFailure, resetLimit: лимит на неудачи", () => {
  const fail = (key = "k") => recordFailure(key, opts);
  const allowed = (key = "k") => checkLimit(key, opts).allowed;

  it("проверка ничего не расходует: сколько ни спрашивай, отказа нет", () => {
    for (let i = 0; i < 10; i++) expect(allowed()).toBe(true);
  });

  it("отказ после limit неудач, не раньше", () => {
    fail();
    fail();
    expect(allowed()).toBe(true);
    fail();
    expect(allowed()).toBe(false);
  });

  it("отказ сообщает, сколько осталось до конца окна от первой неудачи", () => {
    fail();
    jest.advanceTimersByTime(10_000);
    fail();
    fail();

    expect(checkLimit("k", opts)).toEqual({ allowed: false, retryAfterMs: WINDOW - 10_000 });
  });

  it("с концом окна неудачи забываются", () => {
    for (let i = 0; i < opts.limit; i++) fail();
    jest.advanceTimersByTime(WINDOW);

    expect(allowed()).toBe(true);
    fail();
    expect(allowed()).toBe(true);
  });

  it("сброс забывает неудачи ключа, и только его", () => {
    for (let i = 0; i < opts.limit; i++) {
      fail("a");
      fail("b");
    }
    resetLimit("a");

    expect(allowed("a")).toBe(true);
    expect(allowed("b")).toBe(false);
  });

  it("две копии модуля делят счётчики — как обработчик входа и серверное действие формы (#101)", async () => {
    for (let i = 0; i < opts.limit; i++) fail("login:1.1.1.1:ivan@example.com");

    // Вторая копия — как у Next в другом слое сборки: модуль загружен заново.
    jest.resetModules();
    const other = await import("./rate-limit");

    expect(other.checkLimit("login:1.1.1.1:ivan@example.com", opts).allowed).toBe(false);
  });

  it("счётчики неудач и rateLimit с разными ключами не пересекаются", () => {
    for (let i = 0; i < opts.limit; i++) fail("login:1.1.1.1");

    expect(rateLimit("register:1.1.1.1", opts).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  const withHeaders = (init: Record<string, string>) =>
    headers.mockResolvedValue(new Headers(init));

  it.each([
    ["одиночный адрес", { "x-forwarded-for": "203.0.113.7" }, "203.0.113.7"],
    [
      "крайний левый адрес цепочки — клиент, остальные — прокси",
      { "x-forwarded-for": "203.0.113.7, 10.0.0.2, 10.0.0.1" },
      "203.0.113.7",
    ],
    ["пробелы вокруг адреса срезаются", { "x-forwarded-for": "  203.0.113.7  ,10.0.0.1" }, "203.0.113.7"],
    [
      "x-forwarded-for важнее x-real-ip",
      { "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.1" },
      "203.0.113.7",
    ],
    ["без x-forwarded-for — x-real-ip", { "x-real-ip": " 198.51.100.1 " }, "198.51.100.1"],
    [
      "пустой x-forwarded-for — x-real-ip",
      { "x-forwarded-for": "", "x-real-ip": "198.51.100.1" },
      "198.51.100.1",
    ],
    [
      "пустой левый элемент цепочки не подменяется адресом прокси",
      { "x-forwarded-for": " , 10.0.0.1", "x-real-ip": "198.51.100.1" },
      "198.51.100.1",
    ],
    ["без заголовков — unknown", {}, "unknown"],
    ["только пробелы — unknown", { "x-forwarded-for": "   ", "x-real-ip": "  " }, "unknown"],
  ])("%s", async (_name, init, expected) => {
    withHeaders(init);

    await expect(getClientIp()).resolves.toBe(expected);
  });
});
