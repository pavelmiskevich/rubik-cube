/**
 * Ответ проверки здоровья (#120): 200 «ok», если база ответила за `timeoutMs`,
 * иначе 503 «unavailable». Подробности ошибки наружу не уходят — адрес открыт
 * всем. Таймаут свой: у пула pg ожидание соединения по умолчанию бесконечное,
 * а HEALTHCHECK образа ждёт ответа три секунды.
 */
export async function healthResponse(
  query: () => Promise<unknown>,
  timeoutMs: number,
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });

  try {
    await Promise.race([query(), timeout]);
    return plain("ok", 200);
  } catch {
    return plain("unavailable", 503);
  } finally {
    clearTimeout(timer);
  }
}

function plain(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
