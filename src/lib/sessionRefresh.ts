/**
 * Чтение сессии не продлевает её (#104).
 *
 * Библиотека в ответе на `GET /api/auth/session` переподписывает JWT и заново
 * ставит cookie сессии — так она сдвигает срок входа. Клиент спрашивает
 * сессию при каждой загрузке страницы, и если такой запрос был в пути во
 * время выхода, его ответ приходил после выхода и возвращал cookie: человек
 * нажимал «Выйти» и оставался вошедшим.
 *
 * Поэтому из ответа чтения сессии cookie сессии убираются: её пишут только
 * вход и выход, и опоздавший запрос ничего не воскресит. Цена принята
 * владельцем: вход живёт `maxAge` от момента входа (по умолчанию 30 дней), а
 * не от последнего визита.
 */

/** Имя cookie сессии в любом виде: `authjs.`/`__Secure-`, целиком или частями `.0`, `.1`. */
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?=/;

/** Запрос — чтение сессии, тот, что клиент шлёт при загрузке страницы. */
export function isSessionRead(request: Request): boolean {
  return new URL(request.url).pathname.endsWith("/api/auth/session");
}

/** Тот же ответ без cookie сессии; прочие cookie, тело и статус — как были. */
export function withoutSessionCookies(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("Set-Cookie");
  for (const cookie of response.headers.getSetCookie()) {
    if (!SESSION_COOKIE.test(cookie)) headers.append("Set-Cookie", cookie);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
