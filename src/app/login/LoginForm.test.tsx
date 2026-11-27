/**
 * @jest-environment jsdom
 */

/*
  Кнопка входа через Google и разделитель «Или» — только когда провайдер
  подключён (#124). Без ключей кнопка вела на страницу ошибки Google. Сквозной
  тест этого не увидит: в CI ключи заданы заглушками.
*/

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signIn = jest.fn();
jest.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock("@/actions/auth", () => ({ loginUser: jest.fn() }));
// Модуль создаёт TextEncoder при загрузке, а в jsdom его нет; форме нужна
// только эта константа.
jest.mock("@/lib/credentialLimits", () => ({ EMAIL_MAX_LENGTH: 254 }));

import LoginForm from "./LoginForm";

const googleButton = () => screen.queryByRole("button", { name: "Войти через Google" });

describe("LoginForm: вход через Google", () => {
  beforeEach(() => signIn.mockClear());

  it("без провайдера кнопки и разделителя нет", () => {
    render(<LoginForm google={false} />);

    expect(googleButton()).toBeNull();
    expect(screen.queryByText("Или")).toBeNull();
    expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();
  });

  it("с провайдером кнопка есть и ведёт во вход через Google", async () => {
    render(<LoginForm google />);

    expect(screen.getByText("Или")).toBeTruthy();
    await userEvent.click(googleButton()!);
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/profile" });
  });
});
