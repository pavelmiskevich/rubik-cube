/**
 * @jest-environment jsdom
 */

/*
  Пункт 9 TECHDEBT: сборка записывается со скрамблом, который был на экране,
  пока её собирали, а не с тем, что выдан следом.

  Проверяется на рабочем экране целиком, потому что свойство живёт на стыке:
  остановка таймера просит у экрана новый скрамбл, и тот приходит раньше, чем
  кто-нибудь успеет прочитать старый асинхронно. Держится это только на том,
  что stopTimer читает scrambleRef и lessonSlugRef синхронно, — тест ломается,
  если сохранение уедет в эффект, в промис или за перерисовку.
*/

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimerWorkspace from "./TimerWorkspace";
import { saveSolve } from "@/actions/timer";
import { generateScramble } from "@/lib/scrambler";

jest.mock("@/actions/timer", () => ({ saveSolve: jest.fn() }));
jest.mock("@/lib/scrambler", () => ({ generateScramble: jest.fn() }));

const saveSolveMock = jest.mocked(saveSolve);
const generateScrambleMock = jest.mocked(generateScramble);

let now = 0;

beforeEach(() => {
  now = 1000;
  jest.spyOn(performance, "now").mockImplementation(() => now);

  let issued = 0;
  generateScrambleMock.mockReset();
  generateScrambleMock.mockImplementation(() => `скрамбл-${++issued}`);

  saveSolveMock.mockReset();
  saveSolveMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete document.documentElement.dataset.focus;
});

const scramble = () => screen.getByTestId("scramble").textContent;

async function solve(user: ReturnType<typeof userEvent.setup>, ms: number) {
  await user.keyboard("[Space>][/Space]");
  now += ms;
  await user.keyboard("[Space>]");
  await user.keyboard("[/Space]");
  await act(async () => {});
}

describe("TimerWorkspace: скрамбл и урок на момент сохранения", () => {
  it("пишет скрамбл, бывший на экране до смены, и урок", async () => {
    const user = userEvent.setup();
    render(<TimerWorkspace canSave lessonSlug="pairs" />);

    expect(scramble()).toBe("скрамбл-1");

    await solve(user, 10_000);

    // Экран уже показывает следующий скрамбл…
    expect(scramble()).toBe("скрамбл-2");
    // …а сборка ушла с тем, что собирали.
    expect(saveSolveMock).toHaveBeenCalledTimes(1);
    expect(saveSolveMock).toHaveBeenLastCalledWith(10000, "скрамбл-1", "pairs");

    await solve(user, 11_000);

    expect(scramble()).toBe("скрамбл-3");
    expect(saveSolveMock).toHaveBeenCalledTimes(2);
    expect(saveSolveMock).toHaveBeenLastCalledWith(11000, "скрамбл-2", "pairs");
  });

  it("скрамбл, выданный кнопкой до старта, и есть тот, что сохраняется", async () => {
    const user = userEvent.setup();
    render(<TimerWorkspace canSave />);

    await user.click(screen.getByTestId("new-scramble"));
    expect(scramble()).toBe("скрамбл-2");

    await solve(user, 7_000);

    expect(saveSolveMock).toHaveBeenLastCalledWith(7000, "скрамбл-2", undefined);
  });

  it("выдаёт ровно один новый скрамбл на сборку", async () => {
    const user = userEvent.setup();
    render(<TimerWorkspace canSave={false} />);

    await solve(user, 5_000);

    expect(generateScrambleMock).toHaveBeenCalledTimes(2);
    expect(saveSolveMock).not.toHaveBeenCalled();
  });
});

describe("TimerWorkspace: средние и фокус", () => {
  it("считает Ao5 по истории вместе с новой сборкой", async () => {
    const user = userEvent.setup();
    const history = [10_000, 11_000, 12_000, 13_000].map((timeMs, index) => ({
      id: String(index),
      timeMs,
    }));
    render(<TimerWorkspace canSave={false} initialSolves={history} />);

    expect(screen.getByTestId("ao5").textContent).toBe("-");

    await solve(user, 14_000);

    // Отбрасываются 10 и 14, среднее из 11, 12 и 13.
    expect(screen.getByTestId("ao5").textContent).toBe("12.00");
    expect(screen.getByTestId("solve-list").children).toHaveLength(5);
  });

  it("гасит обвязку на время замера", async () => {
    const user = userEvent.setup();
    render(<TimerWorkspace canSave={false} />);

    expect(document.documentElement.dataset.focus).toBe("off");

    await user.keyboard("[Space>][/Space]");
    expect(document.documentElement.dataset.focus).toBe("on");

    now += 1000;
    await user.keyboard("[Space>]");
    expect(document.documentElement.dataset.focus).toBe("off");
  });
});
