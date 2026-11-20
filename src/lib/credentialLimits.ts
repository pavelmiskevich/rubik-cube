/**
 * Границы учётных данных — одни для регистрации и для входа (#117).
 *
 * Нижние границы были всегда, верхних не было, и это стоило дорого:
 * - имя попадает в JWT сессии, а JWT — в cookie. Имя в несколько тысяч букв
 *   раздувает cookie так, что браузер перестаёт открывать сайт вовсе;
 * - bcrypt берёт только первые 72 байта пароля и молча отбрасывает хвост:
 *   пароль из 80 символов принимался и с любым другим хвостом.
 *
 * Пароль меряется в байтах UTF-8, а не в символах: буква кириллицы — два
 * байта, так что предел — 72 латинские буквы или 36 русских.
 */

/** Имя показывается в шапке и лежит в cookie сессии. */
export const NAME_MAX_LENGTH = 64;

/** Предел длины адреса почты по стандарту (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

export const PASSWORD_MIN_LENGTH = 8;

/** Сколько байт пароля учитывает bcrypt; всё дальше он отбрасывает. */
export const PASSWORD_MAX_BYTES = 72;

const encoder = new TextEncoder();

export function utf8Length(value: string): number {
  return encoder.encode(value).length;
}

/** Пароль, который bcrypt учёл бы целиком. */
export const passwordFits = (password: string): boolean =>
  utf8Length(password) <= PASSWORD_MAX_BYTES;
