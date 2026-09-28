/**
 * Чтение сессии не продлевает её (#104): ответ `GET /api/auth/session`
 * уходит без cookie сессии, иначе запрос, который был в пути во время выхода,
 * возвращал бы её после выхода. Остальные ответы библиотеки — вход, выход,
 * CSRF — не тронуты: cookie сессии пишут именно они.
 */

import { isSessionRead, withoutSessionCookies } from "./sessionRefresh";

const SESSION = "authjs.session-token=eyJ.new; Path=/; Expires=Wed, 27 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax";
const SECURE_CHUNK = "__Secure-authjs.session-token.0=eyJ.part; Path=/; HttpOnly; Secure; SameSite=Lax";
const CSRF = "authjs.csrf-token=abc%7Cdef; Path=/; HttpOnly; SameSite=Lax";

function authResponse(cookies: string[]) {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "private, no-cache, no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify({ user: { name: "Кубист" } }), { status: 200, headers });
}

describe("isSessionRead", () => {
  it("узнаёт чтение сессии", () => {
    expect(isSessionRead(new Request("http://localhost:3000/api/auth/session"))).toBe(true);
  });

  it("не трогает остальные адреса библиотеки", () => {
    for (const action of ["csrf", "providers", "signout", "callback/credentials", "signin"]) {
      expect(isSessionRead(new Request(`http://localhost:3000/api/auth/${action}`))).toBe(false);
    }
  });
});

describe("withoutSessionCookies", () => {
  it("убирает cookie сессии, в том числе защищённые и разбитые на части", async () => {
    const response = withoutSessionCookies(authResponse([SESSION, SECURE_CHUNK]));

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("оставляет прочие cookie, тело, статус и заголовки", async () => {
    const response = withoutSessionCookies(authResponse([CSRF, SESSION]));

    expect(response.headers.getSetCookie()).toEqual([CSRF]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache, no-store");
    expect(await response.json()).toEqual({ user: { name: "Кубист" } });
  });
});
