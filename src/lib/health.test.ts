/**
 * Проверка здоровья (#120): на неё смотрят HEALTHCHECK образа, скрипт
 * выкладки и workflow Uptime. Тесты закрепляют, что недоступная или
 * зависшая база даёт 503, а не 200 и не бесконечное ожидание, и что наружу
 * не уходят подробности ошибки.
 */

import { healthResponse } from "./health";

describe("healthResponse", () => {
  it("отвечает 200, когда база ответила", async () => {
    const res = await healthResponse(async () => undefined, 1000);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("отвечает 503, когда запрос к базе упал", async () => {
    const query = async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret");
    };

    const res = await healthResponse(query, 1000);

    expect(res.status).toBe(503);
    const body = await res.text();
    expect(body).toBe("unavailable");
    expect(body).not.toMatch(/ECONNREFUSED|5432|secret/);
  });

  it("отвечает 503, когда база не ответила за отведённое время", async () => {
    const hanging = () => new Promise<never>(() => {});

    const started = Date.now();
    const res = await healthResponse(hanging, 50);

    expect(res.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("запрещает кэшировать ответ", async () => {
    const ok = await healthResponse(async () => undefined, 1000);
    const down = await healthResponse(async () => {
      throw new Error("down");
    }, 1000);

    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(down.headers.get("cache-control")).toBe("no-store");
  });
});
