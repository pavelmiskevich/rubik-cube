/**
 * @jest-environment jsdom
 */

/*
  Шапка на телефоне (#58): вход и тема уходят под кнопку «Меню». Проверяются
  критерии той задачи — то, что человек видит и чем управляет с клавиатуры, —
  а не классы разметки. Раскрыта ли панель, видно по aria-expanded и по
  классу hidden: в jsdom нет вёрстки, и CSS-правило «до sm» не вычисляется.
*/

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar from "./Navbar";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
jest.mock("next-auth/react", () => ({ useSession: jest.fn(), signOut: jest.fn() }));
jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: jest.fn() }),
}));

const usePathnameMock = jest.mocked(usePathname);
const useSessionMock = jest.mocked(useSession);
const signOutMock = jest.mocked(signOut);

type SessionValue = ReturnType<typeof useSession>;

function signedOut() {
  useSessionMock.mockReturnValue({
    data: null,
    status: "unauthenticated",
    update: jest.fn(),
  } as SessionValue);
}

function signedIn() {
  useSessionMock.mockReturnValue({
    data: { user: { id: "u1", name: "Паша" }, expires: "2099-01-01" },
    status: "authenticated",
    update: jest.fn(),
  } as SessionValue);
}

beforeEach(() => {
  usePathnameMock.mockReturnValue("/");
  signedOut();
  signOutMock.mockReset();
});

afterEach(() => {
  delete document.documentElement.dataset.focus;
});

const menuButton = () => screen.getByRole("button", { name: /Меню|Закрыть/ });
const panel = () => document.getElementById(menuButton().getAttribute("aria-controls")!)!;
const isOpen = () => menuButton().getAttribute("aria-expanded") === "true";

describe("Navbar: меню на телефоне", () => {
  it("кнопка связана с панелью и сообщает, раскрыта ли она", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    expect(panel()).toBeTruthy();
    expect(isOpen()).toBe(false);
    expect(panel().classList.contains("hidden")).toBe(true);

    await user.click(menuButton());
    expect(isOpen()).toBe(true);
    expect(menuButton().textContent).toBe("Закрыть");
    expect(panel().classList.contains("hidden")).toBe(false);

    await user.click(menuButton());
    expect(isOpen()).toBe(false);
  });

  it("Escape закрывает меню и возвращает фокус на кнопку", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(menuButton());
    // Фокус внутри панели — как у того, кто дошёл до неё табом.
    act(() => screen.getByRole("link", { name: "Войти" }).focus());
    expect(panel().contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(menuButton());
  });

  it("клик вне шапки закрывает меню, клик внутри — нет", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Navbar />
        <main>Содержимое страницы</main>
      </>
    );

    await user.click(menuButton());
    // Переключатель темы внутри панели меню не закрывает.
    await user.click(await screen.findByRole("button", { name: "Тёмная" }));
    expect(isOpen()).toBe(true);

    await user.click(screen.getByText("Содержимое страницы"));
    expect(isOpen()).toBe(false);
  });

  it("переход по ссылке из панели закрывает меню", async () => {
    // Сам переход jsdom не умеет; меню закрывается по клику, до перехода.
    const stayOnPage = (event: Event) => event.preventDefault();
    document.addEventListener("click", stayOnPage, true);
    try {
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(menuButton());
      await user.click(screen.getByRole("link", { name: "Войти" }));
      expect(isOpen()).toBe(false);
    } finally {
      document.removeEventListener("click", stayOnPage, true);
    }
  });

  it("закрывается само, когда таймер включает режим фокуса", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(menuButton());
    expect(isOpen()).toBe(true);

    await act(async () => {
      document.documentElement.dataset.focus = "on";
    });
    expect(isOpen()).toBe(false);
  });

  it("выключение фокуса меню не открывает", async () => {
    render(<Navbar />);

    await act(async () => {
      document.documentElement.dataset.focus = "off";
    });
    expect(isOpen()).toBe(false);
  });
});

describe("Navbar: разделы", () => {
  it.each([
    ["/timer", "Таймер"],
    ["/learn/notation", "Учиться"],
    ["/stats", "Статистика"],
  ])("на %s подсвечен раздел «%s», и только он", (pathname, label) => {
    usePathnameMock.mockReturnValue(pathname);
    render(<Navbar />);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it("раздел с похожим началом адреса не подсвечивается", () => {
    usePathnameMock.mockReturnValue("/learning");
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Учиться" }).getAttribute("aria-current")).toBeNull();
  });

  it("разделы видны и без раскрытого меню", () => {
    render(<Navbar />);

    for (const label of ["Учиться", "Таймер", "Тренажёр", "Статистика"]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toMatch(/^\//);
    }
  });
});

describe("Navbar: вход", () => {
  it("гостю предлагает вход и регистрацию", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Войти" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("button", { name: "Выйти" })).toBeNull();
  });

  it("вошедшему — профиль и выход", async () => {
    signedIn();
    const user = userEvent.setup();
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Профиль" }).getAttribute("href")).toBe("/profile");
    expect(screen.queryByRole("link", { name: "Войти" })).toBeNull();

    await user.click(menuButton());
    await user.click(screen.getByRole("button", { name: "Выйти" }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
