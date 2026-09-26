import { checkLimit, recordFailure, resetLimit } from "@/lib/rate-limit";

/*
  Ограничение входа по паролю (#101). Считаются только неудачи — верный
  пароль лимит не расходует, — и по двум ключам сразу:

  - пара «адрес + email»: подбор пароля к одному аккаунту. Соседи за общим
    адресом (офис, мобильный оператор) входят каждый в свой аккаунт и друг
    друга не блокируют. Успешный вход этот счётчик сбрасывает;
  - адрес целиком: перебор многих аккаунтов с одного адреса. Успешный вход его
    не сбрасывает — иначе перебор разбавлялся бы входами в собственный аккаунт.

  Проверка стоит в authorize, а не в форме: адрес входа библиотеки принимает
  запросы и напрямую, мимо формы.
*/

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILURES_PER_ACCOUNT = 5;
export const LOGIN_FAILURES_PER_IP = 50;

/** Код отказа по лимиту — его видит форма и адрес перенаправления библиотеки. */
export const LOGIN_RATE_LIMITED = "rate_limited";

const accountKey = (ip: string, email: string) => `login:${ip}:${email}`;
const ipKey = (ip: string) => `login:${ip}`;

/** Исчерпан ли лимит неудач для пары или для адреса. Попытку не расходует. */
export function loginBlocked(ip: string, email: string): boolean {
  return (
    !checkLimit(accountKey(ip, email), { limit: LOGIN_FAILURES_PER_ACCOUNT }).allowed ||
    !checkLimit(ipKey(ip), { limit: LOGIN_FAILURES_PER_IP }).allowed
  );
}

/** Неудача: неверный пароль или неизвестный адрес — считаются одинаково. */
export function loginFailed(ip: string, email: string): void {
  recordFailure(accountKey(ip, email), { windowMs: LOGIN_WINDOW_MS });
  recordFailure(ipKey(ip), { windowMs: LOGIN_WINDOW_MS });
}

/** Успех сбрасывает счётчик пары, но не адреса. */
export function loginSucceeded(ip: string, email: string): void {
  resetLimit(accountKey(ip, email));
}
