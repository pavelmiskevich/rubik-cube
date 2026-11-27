/*
  Вход через Google включается, только когда заданы оба ключа (#124). Прод-
  шаблон подставляет пустую строку, а не отсутствие переменной, поэтому пустое
  и пробельное значение — тоже «не задано».
*/

import { googleConfigured } from "./googleAuth";

describe("googleConfigured", () => {
  it("оба ключа заданы — вход через Google есть", () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" })).toBe(true);
  });

  it("нет ни одного ключа — нет", () => {
    expect(googleConfigured({})).toBe(false);
  });

  it("пустые строки, как подставляет прод-шаблон, — нет", () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "" })).toBe(false);
  });

  it("одного ключа мало", () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: "id" })).toBe(false);
    expect(googleConfigured({ AUTH_GOOGLE_SECRET: "secret" })).toBe(false);
    expect(googleConfigured({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "" })).toBe(false);
  });

  it("одни пробелы — тоже не задано", () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: " ", AUTH_GOOGLE_SECRET: "\t" })).toBe(false);
  });
});
