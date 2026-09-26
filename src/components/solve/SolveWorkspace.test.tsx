/**
 * @jest-environment jsdom
 */

/*
  Экран ввода раскраски /solve. Правила раскраски и проверки закрыты тестами
  painting, palette и facelets; здесь — что видит и чем управляет человек:
  кисть, клавиатура, счётчики цветов, вердикт по заполненной развёртке.

  Фоновый поток короткого решателя и камера заменены: поток создаётся через
  import.meta, которого нет под Jest, а камере нужен getUserMedia. Подмена
  камеры отдаёт готовое распознавание — так проверяется и её стык с развёрткой.
*/

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SolveWorkspace from "./SolveWorkspace";
import { useShortSolution } from "./useShortSolution";
import { stateToFacelets } from "@/lib/cube/facelets";
import { applyNotation } from "@/lib/cube/moves";
import type { Recognition } from "./camera/recognition";

jest.mock("./useShortSolution", () => ({ useShortSolution: jest.fn() }));

let recognition: Recognition | null = null;

jest.mock("./camera/CameraCapture", () => ({
  __esModule: true,
  default: ({ onRecognised }: { onRecognised: (result: Recognition) => void }) => (
    <button type="button" onClick={() => recognition && onRecognised(recognition)}>
      Снять камерой
    </button>
  ),
}));

const useShortSolutionMock = jest.mocked(useShortSolution);

beforeEach(() => {
  recognition = null;
  useShortSolutionMock.mockReset();
  useShortSolutionMock.mockImplementation((state, active) =>
    active && state ? { kind: "working" } : null
  );
});

/** Кнопка палитры по названию цвета: «белый», «красный»… */
const brush = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
/** Сколько наклеек этого цвета на развёртке, как пишет палитра: «2/9». */
const count = (name: string) => within(brush(name)).getByText(/\/9$/).textContent;
const pressed = (element: HTMLElement) => element.getAttribute("aria-pressed") === "true";

/** Наклейка по месту: «Верх», 3-й ряд, 2-й столбец. */
const sticker = (face: string, row: number, column: number) =>
  screen.getByRole("button", { name: new RegExp(`^${face}, ряд ${row}, столбец ${column}:`) });
const colourOf = (element: HTMLElement) => element.getAttribute("aria-label")!.split(": ")[1];

describe("SolveWorkspace: ввод", () => {
  it("начинает с пустой развёртки: стоят только центры", () => {
    render(<SolveWorkspace />);

    expect(screen.getByRole("heading", { name: "Осталось назвать 48 наклеек" })).toBeTruthy();
    for (const name of ["белый", "жёлтый", "зелёный", "синий", "красный", "оранжевый"]) {
      expect(count(name)).toBe("1/9");
    }
    expect(colourOf(sticker("Верх", 1, 1))).toBe("не заполнено");
  });

  it("центр не красится", () => {
    render(<SolveWorkspace />);

    const centre = sticker("Фронт", 2, 2);
    expect(colourOf(centre)).toBe("зелёный");
    expect((centre as HTMLButtonElement).disabled).toBe(true);
  });

  it("кисть: выбранный цвет ложится на наклейку и меняет счётчики", async () => {
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    expect(pressed(brush("белый"))).toBe(true);
    await user.click(sticker("Верх", 1, 1));
    expect(colourOf(sticker("Верх", 1, 1))).toBe("белый");
    expect(count("белый")).toBe("2/9");
    expect(screen.getByRole("heading", { name: "Осталось назвать 47 наклеек" })).toBeTruthy();

    await user.click(brush("красный"));
    expect(pressed(brush("красный"))).toBe(true);
    expect(pressed(brush("белый"))).toBe(false);

    // Перекраска: белый уходит, красный приходит.
    await user.click(sticker("Верх", 1, 1));
    expect(colourOf(sticker("Верх", 1, 1))).toBe("красный");
    expect(count("белый")).toBe("1/9");
    expect(count("красный")).toBe("2/9");
  });

  it("ластик стирает наклейку", async () => {
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    await user.click(sticker("Низ", 2, 3));
    await user.click(screen.getByRole("button", { name: "Стереть" }));
    await user.click(sticker("Низ", 2, 3));

    expect(colourOf(sticker("Низ", 2, 3))).toBe("не заполнено");
    expect(count("белый")).toBe("1/9");
  });

  it("с клавиатуры: цифра ставит свой цвет и выбирает его в палитре, Backspace стирает", async () => {
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    sticker("Право", 1, 1).focus();
    await user.keyboard("3");
    expect(colourOf(sticker("Право", 1, 1))).toBe("зелёный");
    expect(pressed(brush("зелёный"))).toBe(true);

    // Следующий щелчок красит уже выбранным с клавиатуры цветом.
    await user.click(sticker("Право", 1, 2));
    expect(colourOf(sticker("Право", 1, 2))).toBe("зелёный");

    sticker("Право", 1, 1).focus();
    await user.keyboard("{Backspace}");
    expect(colourOf(sticker("Право", 1, 1))).toBe("не заполнено");

    // Незнакомая клавиша ничего не красит.
    await user.keyboard("9");
    expect(colourOf(sticker("Право", 1, 1))).toBe("не заполнено");
  });

  it("«Очистить» возвращает пустую развёртку", async () => {
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    await user.click(screen.getByRole("button", { name: "Заполнить как собранный" }));
    await user.click(screen.getByRole("button", { name: "Очистить" }));

    expect(screen.getByRole("heading", { name: "Осталось назвать 48 наклеек" })).toBeTruthy();
  });
});

describe("SolveWorkspace: вердикт", () => {
  it("«Заполнить как собранный» — все цвета по девять, кубик уже собран", async () => {
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    await user.click(screen.getByRole("button", { name: "Заполнить как собранный" }));

    for (const name of ["белый", "жёлтый", "зелёный", "синий", "красный", "оранжевый"]) {
      expect(count(name)).toBe("9/9");
    }
    expect(screen.getByRole("heading", { name: "Этот кубик уже собран" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "К урокам" }).getAttribute("href")).toBe("/learn");
  });

  it("перевёрнутое ребро: такого кубика быть не может, наклейки обведены", async () => {
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    await user.click(screen.getByRole("button", { name: "Заполнить как собранный" }));
    // Ребро верх-фронт: две его наклейки меняются местами.
    sticker("Верх", 3, 2).focus();
    await user.keyboard("3");
    sticker("Фронт", 1, 2).focus();
    await user.keyboard("1");

    expect(screen.getByRole("heading", { name: "Такого кубика быть не может" })).toBeTruthy();
    expect(screen.getByText(/Одно из рёбер перевёрнуто/)).toBeTruthy();
    expect(screen.getByText("Наклейки, которые стоит проверить, обведены на развёртке.")).toBeTruthy();
    expect(sticker("Верх", 3, 2).className).toMatch(/outline-danger/);
    // Счёт цветов при этом верный: обводить весь цвет незачем.
    expect(count("белый")).toBe("9/9");
    expect(count("зелёный")).toBe("9/9");
  });

  it("лишний цвет: сообщение о счёте без обводки наклеек", async () => {
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    await user.click(screen.getByRole("button", { name: "Заполнить как собранный" }));
    sticker("Низ", 1, 1).focus();
    await user.keyboard("1");

    expect(screen.getByRole("heading", { name: "Такого кубика быть не может" })).toBeTruthy();
    expect(count("белый")).toBe("10/9");
    expect(count("жёлтый")).toBe("8/9");
  });

  it("разобранный кубик — решение по шагам курса, «коротко» спрашивает фоновый поток", async () => {
    recognition = {
      painting: stateToFacelets(applyNotation("R U")),
      doubtful: [],
    };
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    await user.click(screen.getByRole("button", { name: "Снять камерой" }));

    expect(screen.getByRole("heading", { name: "Как собрать этот кубик" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /^Урок: / }).length).toBeGreaterThan(0);
    // Пока открыт режим «понятно», фоновый поток не нужен.
    expect(useShortSolutionMock).toHaveBeenLastCalledWith(expect.anything(), false);

    await user.click(screen.getByRole("button", { name: "Коротко" }));

    expect(useShortSolutionMock).toHaveBeenLastCalledWith(expect.anything(), true);
    expect(screen.getByRole("heading", { name: "Ищу короткое решение…" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Как собрать этот кубик" })).toBeNull();
  });

  it("распознанные с сомнением наклейки помечены, пока их не перекрасили", async () => {
    recognition = { painting: stateToFacelets(applyNotation("")), doubtful: [0] };
    const user = userEvent.setup();
    render(<SolveWorkspace />);

    await user.click(screen.getByRole("button", { name: "Снять камерой" }));

    const doubtful = screen.getByRole("button", { name: /, проверьте$/ });
    await user.click(brush("жёлтый"));
    await user.click(doubtful);

    expect(screen.queryByRole("button", { name: /, проверьте$/ })).toBeNull();
  });
});
