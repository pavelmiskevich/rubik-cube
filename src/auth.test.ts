/**
 * Вход по паролю — `authorize` провайдера Credentials. NextAuth под Jest не
 * поднимается: мок конструктора перехватывает конфигурацию, и тест вызывает
 * ровно ту функцию, что стоит в провайдере. Закрепляется то, чего не видно
 * снаружи: ответ не выдаёт, зарегистрирован ли адрес, ни результатом, ни
 * работой bcrypt, а пароль не утекает в токен.
 */

import type { NextAuthConfig } from "next-auth";

const findUnique = jest.fn();
const compare = jest.fn();

let captured: NextAuthConfig | undefined;

jest.mock("next-auth", () => ({
  __esModule: true,
  default: (config: NextAuthConfig) => {
    captured = config;
    return { handlers: {}, signIn: jest.fn(), signOut: jest.fn(), auth: jest.fn() };
  },
}));
jest.mock("next-auth/providers/google", () => ({ __esModule: true, default: { id: "google" } }));
jest.mock("next-auth/providers/credentials", () => ({
  __esModule: true,
  default: (options: object) => ({ id: "credentials", type: "credentials", ...options }),
}));
jest.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
jest.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));
jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: { compare: (...args: unknown[]) => compare(...args) },
}));

import "./auth";

type Authorize = (credentials: Record<string, unknown> | undefined) => Promise<unknown>;

function authorize(credentials: Record<string, unknown> | undefined) {
  const provider = captured!.providers.find(
    (p) => typeof p === "object" && "id" in p && p.id === "credentials"
  ) as unknown as { authorize: Authorize };
  return provider.authorize(credentials);
}

const HASH = "$2b$12$hash-of-the-real-password-for-tests-only-000000000000";

const storedUser = {
  id: "user-1",
  name: "Иван",
  email: "ivan@example.com",
  password: HASH,
  image: null,
};

/** Хеш, с которым сравнивали пароль в последнем вызове bcrypt.compare. */
const comparedHash = () => compare.mock.calls.at(-1)?.[1];

beforeEach(() => {
  findUnique.mockReset();
  compare.mockReset();
  compare.mockResolvedValue(false);
});

describe("authorize: нормализация email", () => {
  it.each([
    ["как есть", "ivan@example.com"],
    ["заглавные буквы", "Ivan@Example.COM"],
    ["пробелы по краям", "  ivan@example.com\t"],
    ["и то и другое", "  IVAN@EXAMPLE.COM "],
  ])("%s — ищется ivan@example.com", async (_name, email) => {
    findUnique.mockResolvedValue(null);

    await authorize({ email, password: "secret1" });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "ivan@example.com" } })
    );
  });

  it("пароль не нормализуется: пробелы и регистр — часть пароля", async () => {
    findUnique.mockResolvedValue(storedUser);

    await authorize({ email: "ivan@example.com", password: " Secret1 " });

    expect(compare).toHaveBeenCalledWith(" Secret1 ", HASH);
  });
});

describe("authorize: неизвестный адрес неотличим от неверного пароля", () => {
  it("несуществующий адрес тоже проходит bcrypt.compare — с фиктивным хешем", async () => {
    findUnique.mockResolvedValue(null);

    const result = await authorize({ email: "nobody@example.com", password: "secret1" });

    expect(result).toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][0]).toBe("secret1");
  });

  it("аккаунт без пароля (вход через Google) тоже проходит сравнение с фиктивным хешем", async () => {
    findUnique.mockResolvedValue({ ...storedUser, password: null });

    const result = await authorize({ email: "ivan@example.com", password: "secret1" });

    expect(result).toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(comparedHash()).not.toBeNull();
  });

  it("фиктивный хеш — настоящий bcrypt-хеш с той же стоимостью 12", async () => {
    findUnique.mockResolvedValue(null);
    await authorize({ email: "nobody@example.com", password: "secret1" });
    const dummy = comparedHash();

    // Битый хеш bcrypt отбрасывает сразу, без хеширования, и быстрый ответ
    // выдал бы, что адреса нет. Стоимость должна совпадать с хешами
    // регистрации (bcrypt.hash(password, 12)), иначе время всё равно разное.
    const realBcrypt = jest.requireActual<typeof import("bcryptjs")>("bcryptjs");
    expect(dummy).toHaveLength(60);
    expect(realBcrypt.getRounds(dummy)).toBe(12);
    await expect(realBcrypt.compare("secret1", dummy)).resolves.toBe(false);
  });

  it.each([
    ["несуществующий адрес", null],
    ["аккаунт без пароля", { ...storedUser, password: null }],
    ["неверный пароль", storedUser],
  ])("%s: null и ровно одно сравнение bcrypt", async (_name, user) => {
    findUnique.mockResolvedValue(user);

    const result = await authorize({ email: "ivan@example.com", password: "wrong-pass" });

    expect(result).toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][0]).toBe("wrong-pass");
  });
});

describe("authorize: верный пароль", () => {
  it("возвращает пользователя без поля password — хеш не попадает в токен", async () => {
    findUnique.mockResolvedValue(storedUser);
    compare.mockResolvedValue(true);

    const result = await authorize({ email: "ivan@example.com", password: "secret1" });

    expect(compare).toHaveBeenCalledWith("secret1", HASH);
    expect(result).toEqual({
      id: "user-1",
      name: "Иван",
      email: "ivan@example.com",
      image: null,
    });
    expect(result).not.toHaveProperty("password");
  });

  it("пароль запрашивается явно: глобально он исключён из выборок Prisma", async () => {
    findUnique.mockResolvedValue(null);

    await authorize({ email: "ivan@example.com", password: "secret1" });

    expect(findUnique.mock.calls[0][0].select).toMatchObject({ id: true, password: true });
  });
});

describe("authorize: неполные учётные данные", () => {
  it.each([
    ["без учётных данных", undefined],
    ["без email", { password: "secret1" }],
    ["без пароля", { email: "ivan@example.com" }],
    ["пустой email", { email: "", password: "secret1" }],
    ["пустой пароль", { email: "ivan@example.com", password: "" }],
  ])("%s — null без обращения к базе", async (_name, credentials) => {
    const result = await authorize(credentials);

    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("колбэки сессии", () => {
  it("jwt кладёт id пользователя в sub при входе и не трогает токен потом", async () => {
    const jwt = captured!.callbacks!.jwt! as unknown as (args: object) => Promise<object>;

    await expect(jwt({ token: {}, user: { id: "user-1" } })).resolves.toEqual({ sub: "user-1" });
    await expect(jwt({ token: { sub: "user-1" } })).resolves.toEqual({ sub: "user-1" });
  });

  it("session отдаёт id из токена в session.user.id", async () => {
    const session = captured!.callbacks!.session! as unknown as (args: object) => Promise<{
      user: { id?: string };
    }>;

    const result = await session({ session: { user: {} }, token: { sub: "user-1" } });

    expect(result.user.id).toBe("user-1");
  });
});
