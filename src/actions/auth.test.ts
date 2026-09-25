/**
 * Регистрация и вход — публичные серверные действия, их дёргают с любым
 * содержимым формы и с любой частотой. Тесты закрепляют, что форма не
 * выдаёт, занят ли адрес, что поля проверяются до записи, и что попытки с
 * одного адреса ограничены. Ограничитель настоящий — подменены только
 * заголовки запроса. Его счётчики живут в памяти модуля, поэтому каждый тест
 * приходит со своего адреса и начинает с нуля.
 */

const create = jest.fn();
const hash = jest.fn();
const signIn = jest.fn();
const headers = jest.fn();

class MockAuthError extends Error {
  constructor(public type: string) {
    super(type);
  }
}

jest.mock("@/lib/prisma", () => ({
  prisma: { user: { create: (...args: unknown[]) => create(...args) } },
}));
jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: { hash: (...args: unknown[]) => hash(...args) },
}));
jest.mock("@/auth", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));
jest.mock("next-auth", () => ({ AuthError: MockAuthError }));
jest.mock("next/headers", () => ({ headers: () => headers() }));

import { loginUser, registerUser } from "./auth";

const TOO_MANY_ATTEMPTS = "Слишком много попыток. Попробуйте позже.";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = { name: "Иван", email: "ivan@example.com", password: "secret1" };

function fromIp(ip: string) {
  headers.mockResolvedValue(new Headers({ "x-forwarded-for": ip }));
}

/** Адрес клиента текущего теста — у каждого теста свой. */
let clientIp = "";
let testNo = 0;

beforeEach(() => {
  create.mockReset();
  hash.mockReset();
  signIn.mockReset();
  headers.mockReset();
  create.mockResolvedValue({});
  hash.mockResolvedValue("hashed");
  clientIp = `203.0.113.${++testNo}`;
  fromIp(clientIp);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("registerUser", () => {
  it("пишет нормализованный email, обрезанное имя и хеш пароля стоимости 12", async () => {
    const result = await registerUser(
      form({ name: "  Иван ", email: "  Ivan@Example.COM ", password: "secret1" })
    );

    expect(result).toEqual({ success: true });
    expect(hash).toHaveBeenCalledWith("secret1", 12);
    expect(create).toHaveBeenCalledWith({
      data: { name: "Иван", email: "ivan@example.com", password: "hashed" },
    });
  });

  it("пароль не обрезается и в открытом виде в базу не попадает", async () => {
    await registerUser(form({ ...valid, password: " secret1 " }));

    expect(hash).toHaveBeenCalledWith(" secret1 ", 12);
    expect(JSON.stringify(create.mock.calls)).not.toContain("secret1");
  });

  it("занятый email получает тот же ответ, что и свободный", async () => {
    const fresh = await registerUser(form(valid));

    create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), {
        code: "P2002",
      })
    );
    const taken = await registerUser(form(valid));

    expect(taken).toEqual(fresh);
    expect(taken).toEqual({ success: true });
  });

  it("прочая ошибка базы — общая ошибка, а не исключение", async () => {
    create.mockRejectedValue(Object.assign(new Error("connection refused"), { code: "P1001" }));

    const result = await registerUser(form(valid));

    expect(result).toEqual({ error: "Произошла ошибка при регистрации" });
    expect(console.error).toHaveBeenCalled();
  });

  it.each([
    ["имя короче двух символов", { ...valid, name: "И" }, "Имя должно содержать минимум 2 символа"],
    ["имя из пробелов вокруг одной буквы", { ...valid, name: "  И  " }, "Имя должно содержать минимум 2 символа"],
    ["email без домена", { ...valid, email: "ivan@" }, "Неверный формат email"],
    ["email без @", { ...valid, email: "ivan.example.com" }, "Неверный формат email"],
    ["пароль короче шести символов", { ...valid, password: "12345" }, "Пароль должен содержать минимум 6 символов"],
  ])("%s — сообщение поля, без хеширования и записи", async (_name, fields, message) => {
    const result = await registerUser(form(fields));

    expect(result).toEqual({ error: message });
    expect(hash).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["name", "email", "password"])("без поля %s — ошибка, без записи", async (field) => {
    const fields: Record<string, string> = { ...valid };
    delete fields[field];

    const result = await registerUser(form(fields));

    expect(result).toEqual({ error: expect.any(String) });
    expect(create).not.toHaveBeenCalled();
  });

  it("пять попыток с одного адреса за окно, шестая отклоняется до проверки полей", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await registerUser(form({ ...valid, email: `u${i}@example.com` }))).toEqual({
        success: true,
      });
    }

    const sixth = await registerUser(form({ ...valid, email: "u5@example.com" }));

    expect(sixth).toEqual({ error: TOO_MANY_ATTEMPTS });
    expect(hash).toHaveBeenCalledTimes(5);
    expect(create).toHaveBeenCalledTimes(5);
  });

  it("неудачные попытки тоже расходуют лимит", async () => {
    for (let i = 0; i < 5; i++) await registerUser(form({ ...valid, password: "1" }));

    expect(await registerUser(form(valid))).toEqual({ error: TOO_MANY_ATTEMPTS });
    expect(create).not.toHaveBeenCalled();
  });

  it("лимит считается по адресу клиента: другой адрес не заблокирован", async () => {
    for (let i = 0; i < 6; i++) await registerUser(form(valid));

    fromIp("198.51.100.1"); // адрес, которого нет среди тестовых
    expect(await registerUser(form(valid))).toEqual({ success: true });
  });

  it("клиент — крайний левый адрес цепочки, а не прокси", async () => {
    for (let i = 0; i < 5; i++) {
      fromIp(`${clientIp}, 10.0.0.${i}`);
      await registerUser(form(valid));
    }

    fromIp(`${clientIp}, 10.0.0.99`);
    expect(await registerUser(form(valid))).toEqual({ error: TOO_MANY_ATTEMPTS });
  });
});

describe("loginUser", () => {
  it("передаёт в signIn нормализованный email и пароль как есть", async () => {
    await loginUser(form({ email: "  Ivan@Example.COM ", password: " Secret1 " }));

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ivan@example.com",
      password: " Secret1 ",
      redirectTo: "/profile",
    });
  });

  it("без полей уходят пустые строки, а не null", async () => {
    await loginUser(form({}));

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "",
      password: "",
      redirectTo: "/profile",
    });
  });

  it("неверные учётные данные — одно сообщение и для адреса, и для пароля", async () => {
    signIn.mockRejectedValue(new MockAuthError("CredentialsSignin"));

    const result = await loginUser(form({ email: "ivan@example.com", password: "wrong" }));

    expect(result).toEqual({ error: "Неверный email или пароль" });
  });

  it("прочая ошибка входа — общее сообщение", async () => {
    signIn.mockRejectedValue(new MockAuthError("CallbackRouteError"));

    const result = await loginUser(form(valid));

    expect(result).toEqual({ error: "Что-то пошло не так" });
  });

  it("управляющее исключение перенаправления пробрасывается, а не глотается", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/profile" });
    signIn.mockRejectedValue(redirect);

    await expect(loginUser(form(valid))).rejects.toBe(redirect);
  });

  it("десять попыток с одного адреса за окно, одиннадцатая отклоняется без signIn", async () => {
    signIn.mockRejectedValue(new MockAuthError("CredentialsSignin"));
    for (let i = 0; i < 10; i++) {
      expect(await loginUser(form(valid))).toEqual({ error: "Неверный email или пароль" });
    }

    expect(await loginUser(form(valid))).toEqual({ error: TOO_MANY_ATTEMPTS });
    expect(signIn).toHaveBeenCalledTimes(10);
  });

  it("счётчики входа и регистрации раздельные", async () => {
    signIn.mockRejectedValue(new MockAuthError("CredentialsSignin"));
    for (let i = 0; i < 10; i++) await loginUser(form(valid));

    expect(await registerUser(form(valid))).toEqual({ success: true });
  });

  it("с концом окна попытки снова разрешены", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
    try {
      signIn.mockRejectedValue(new MockAuthError("CredentialsSignin"));
      for (let i = 0; i < 11; i++) await loginUser(form(valid));
      expect(await loginUser(form(valid))).toEqual({ error: TOO_MANY_ATTEMPTS });

      jest.advanceTimersByTime(15 * 60 * 1000);

      expect(await loginUser(form(valid))).toEqual({ error: "Неверный email или пароль" });
    } finally {
      jest.useRealTimers();
    }
  });
});
