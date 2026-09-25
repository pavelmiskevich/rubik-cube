/**
 * @jest-environment jsdom
 */

/*
  Машина состояний таймера — глазами человека: клавиатура и касание, и что
  уходит в saveSolve. Сам компонент не трогается; время подменяется через
  performance.now, чтобы замер был точным числом, а не «сколько успело пройти».
*/

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SmartTimer from "./SmartTimer";
import { saveSolve } from "@/actions/timer";

// Серверное действие тянет за собой auth и Prisma; здесь важен только вызов.
jest.mock("@/actions/timer", () => ({ saveSolve: jest.fn() }));

const saveSolveMock = jest.mocked(saveSolve);

let now = 0;

beforeEach(() => {
  now = 1000;
  jest.spyOn(performance, "now").mockImplementation(() => now);
  saveSolveMock.mockReset();
  saveSolveMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const timer = () => screen.getByTestId("timer");
const state = () => timer().getAttribute("data-state");
/*
  Бегущее время пишется в DOM напрямую через innerText. jsdom innerText не
  реализует, и присваивание остаётся обычным свойством узла — его и читаем:
  это ровно то, что компонент показал бы на экране.
*/
const shown = () => (screen.getByTestId("timer-display") as HTMLElement).innerText;

/** Отдать микрозадачи: результат saveSolve приходит промисом. */
const flush = () => act(async () => {});

describe("SmartTimer: клавиатура", () => {
  it("удержание пробела — готов, отпускание — старт, любая клавиша — стоп", async () => {
    const user = userEvent.setup();
    const onStateChange = jest.fn();
    render(<SmartTimer onStateChange={onStateChange} />);

    expect(state()).toBe("IDLE");

    await user.keyboard("[Space>]");
    expect(state()).toBe("READY");

    await user.keyboard("[/Space]");
    expect(state()).toBe("RUNNING");

    now += 12_345;
    await user.keyboard("[KeyA>]");
    expect(state()).toBe("STOPPED");
    expect(shown()).toBe("12.34");

    await user.keyboard("[/KeyA]");
    expect(state()).toBe("IDLE");

    expect(onStateChange.mock.calls.map(([next]) => next)).toEqual([
      "READY",
      "RUNNING",
      "STOPPED",
      "IDLE",
    ]);
  });

  it("не взводится другой клавишей", async () => {
    const user = userEvent.setup();
    render(<SmartTimer />);

    await user.keyboard("[Enter>]");
    expect(state()).toBe("IDLE");
  });

  it("автоповтор зажатого пробела не взводит таймер заново", async () => {
    const user = userEvent.setup();
    render(<SmartTimer />);

    await user.keyboard("[Space>][/Space]");
    now += 5000;
    // Остановили пробелом и держат его; другая клавиша возвращает таймер в покой.
    await user.keyboard("[Space>]");
    await user.keyboard("[KeyA>][/KeyA]");
    expect(state()).toBe("IDLE");

    // Автоповтор всё ещё зажатого пробела — не новое нажатие.
    fireEvent.keyDown(window, { code: "Space", key: " ", repeat: true });
    expect(state()).toBe("IDLE");
  });
});

describe("SmartTimer: касание", () => {
  it("касание — готов, отпускание — старт, касание — стоп, отпускание — покой", () => {
    const onSolve = jest.fn();
    render(<SmartTimer onSolve={onSolve} />);

    fireEvent.pointerDown(timer());
    expect(state()).toBe("READY");
    fireEvent.pointerUp(timer());
    expect(state()).toBe("RUNNING");

    now += 8_000;
    fireEvent.pointerDown(timer());
    expect(state()).toBe("STOPPED");
    expect(onSolve).toHaveBeenCalledWith(8000);

    fireEvent.pointerUp(timer());
    expect(state()).toBe("IDLE");
  });

  it("палец, съехавший с таймера, снимает готовность, а не запускает замер", () => {
    render(<SmartTimer />);

    fireEvent.pointerDown(timer());
    expect(state()).toBe("READY");

    fireEvent.pointerLeave(timer());
    expect(state()).toBe("IDLE");
    expect(saveSolveMock).not.toHaveBeenCalled();
  });
});

/** Полный цикл пробелом: взвести, отпустить, через `ms` остановить. */
async function solveWithSpace(user: ReturnType<typeof userEvent.setup>, ms: number) {
  await user.keyboard("[Space>][/Space]");
  now += ms;
  await user.keyboard("[Space>]");
  await user.keyboard("[/Space]");
}

describe("SmartTimer: сохранение", () => {
  it("сохраняет время со скрамблом и уроком", async () => {
    const user = userEvent.setup();
    render(<SmartTimer scramble="R U R' U'" lessonSlug="pairs" />);

    await solveWithSpace(user, 9_876.4);
    await flush();

    expect(saveSolveMock).toHaveBeenCalledTimes(1);
    expect(saveSolveMock).toHaveBeenCalledWith(9876, "R U R' U'", "pairs");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("у анонима ничего не пишет, но живые средние получают время", async () => {
    const user = userEvent.setup();
    const onSolve = jest.fn();
    render(<SmartTimer canSave={false} onSolve={onSolve} />);

    expect(
      screen.getByText("Результаты сохраняются только для вошедших пользователей.")
    ).toBeTruthy();

    await solveWithSpace(user, 4_000);
    await flush();

    expect(onSolve).toHaveBeenCalledWith(4000);
    expect(saveSolveMock).not.toHaveBeenCalled();
  });

  it("показывает отказ сервера и убирает его при следующем взводе", async () => {
    saveSolveMock.mockResolvedValue({ success: false, error: "Войдите, чтобы сохранять результаты" });
    const user = userEvent.setup();
    render(<SmartTimer />);

    await solveWithSpace(user, 3_000);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Войдите, чтобы сохранять результаты"
    );

    await user.keyboard("[Space>]");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("показывает сбой сети, а не молчит", async () => {
    saveSolveMock.mockRejectedValue(new Error("offline"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<SmartTimer />);

    await solveWithSpace(user, 3_000);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Не удалось сохранить результат"
    );
    expect(consoleError).toHaveBeenCalled();
  });
});
