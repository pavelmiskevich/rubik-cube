/**
 * Правило лимита входа (#101): считаются только неудачи, по паре «адрес +
 * email» и по адресу целиком. Каждый тест получает свежий модуль — счётчики
 * живут в его памяти — и подменённые часы.
 */

let throttle: typeof import("./loginThrottle");

const IP = "203.0.113.7";
const NEIGHBOUR_IP = "198.51.100.9";

beforeEach(async () => {
  jest.resetModules();
  // Счётчики живут на globalThis (общие для всех копий модуля) — чистим руками.
  delete (globalThis as { rateLimitBuckets?: unknown }).rateLimitBuckets;
  jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
  throttle = await import("./loginThrottle");
});

afterEach(() => {
  jest.useRealTimers();
});

const failTimes = (n: number, ip: string, email: string) => {
  for (let i = 0; i < n; i++) throttle.loginFailed(ip, email);
};

describe("пара «адрес + email»", () => {
  it("пятая неудача блокирует пару, четыре — ещё нет", () => {
    failTimes(4, IP, "ivan@example.com");
    expect(throttle.loginBlocked(IP, "ivan@example.com")).toBe(false);

    throttle.loginFailed(IP, "ivan@example.com");
    expect(throttle.loginBlocked(IP, "ivan@example.com")).toBe(true);
  });

  it("соседи за тем же адресом с другими почтами не блокируются", () => {
    failTimes(5, IP, "ivan@example.com");

    expect(throttle.loginBlocked(IP, "maria@example.com")).toBe(false);
    expect(throttle.loginBlocked(IP, "petr@example.com")).toBe(false);
  });

  it("тот же email с другого адреса не блокируется", () => {
    failTimes(5, IP, "ivan@example.com");

    expect(throttle.loginBlocked(NEIGHBOUR_IP, "ivan@example.com")).toBe(false);
  });

  it("успешный вход сбрасывает счётчик пары", () => {
    failTimes(4, IP, "ivan@example.com");
    throttle.loginSucceeded(IP, "ivan@example.com");
    failTimes(4, IP, "ivan@example.com");

    expect(throttle.loginBlocked(IP, "ivan@example.com")).toBe(false);
  });

  it("через 15 минут после первой неудачи пара снова свободна", () => {
    failTimes(5, IP, "ivan@example.com");

    jest.advanceTimersByTime(throttle.LOGIN_WINDOW_MS - 1);
    expect(throttle.loginBlocked(IP, "ivan@example.com")).toBe(true);

    jest.advanceTimersByTime(1);
    expect(throttle.loginBlocked(IP, "ivan@example.com")).toBe(false);
  });
});

describe("адрес целиком", () => {
  it("пятидесятая неудача по разным почтам блокирует адрес для всех", () => {
    for (let i = 0; i < 49; i++) throttle.loginFailed(IP, `user${i}@example.com`);
    expect(throttle.loginBlocked(IP, "fresh@example.com")).toBe(false);

    throttle.loginFailed(IP, "user49@example.com");
    expect(throttle.loginBlocked(IP, "fresh@example.com")).toBe(true);
    expect(throttle.loginBlocked(NEIGHBOUR_IP, "fresh@example.com")).toBe(false);
  });

  it("успешный вход счётчик адреса не сбрасывает — перебор не разбавить своим аккаунтом", () => {
    for (let i = 0; i < 49; i++) {
      throttle.loginFailed(IP, `user${i}@example.com`);
      throttle.loginSucceeded(IP, "attacker@example.com");
    }
    throttle.loginFailed(IP, "user49@example.com");

    expect(throttle.loginBlocked(IP, "anyone@example.com")).toBe(true);
  });
});

describe("успешные входы", () => {
  it("не расходуют лимит: сотня успешных входов с одного адреса проходит", () => {
    for (let i = 0; i < 100; i++) {
      expect(throttle.loginBlocked(IP, `user${i % 10}@example.com`)).toBe(false);
      throttle.loginSucceeded(IP, `user${i % 10}@example.com`);
    }
  });
});
