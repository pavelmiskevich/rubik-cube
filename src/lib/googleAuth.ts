/**
 * Задан ли вход через Google (#124). Без обоих ключей провайдер не
 * подключается, а кнопка не рисуется: иначе она вела бы на страницу ошибки
 * Google «Missing required parameter: client_id». Пустая строка — тоже «не
 * задано»: прод-шаблон подставляет именно её.
 *
 * Только на сервере. На клиент уходит лишь булево значение — сами ключи в
 * контекст страницы не попадают.
 */
export function googleConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim());
}
