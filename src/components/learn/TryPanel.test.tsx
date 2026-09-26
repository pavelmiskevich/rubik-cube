/**
 * @jest-environment jsdom
 */

/*
  Панель «Попробовать» — слова поверх оценки. Оценка берётся настоящая, из
  assessTry по истории ходов: так проверяется, что панель говорит то, что
  значит каждое состояние, а не то, что подложено в пропсы вручную.
*/

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TryPanel from "./TryPanel";
import { assessTry, type TryStep } from "./tryCheck";
import { parseSequence } from "@/lib/cube/moves";

/** Шаг из одного хода, цель — собранный куб. */
const ONE_MOVE: TryStep = { setup: "R'", algorithm: "R", goal: { kind: "solved" } };
/** У креста на D много позиций-целей: до неё можно дойти и не алгоритмом. */
const CROSS: TryStep = { setup: "R'", algorithm: "R", goal: { kind: "cross", face: "D" } };

function panel(
  step: TryStep,
  history: string,
  options: { desynced?: boolean; onReset?: () => void; onNextStep?: () => void } = {}
) {
  const moves = parseSequence(history);
  return (
    <TryPanel
      assessment={assessTry(step, moves)}
      desynced={options.desynced ?? false}
      moveCount={moves.length}
      onReset={options.onReset ?? (() => {})}
      onNextStep={options.onNextStep}
    />
  );
}

const verdict = () => screen.getByRole("status").textContent;
const button = (name: string) => screen.queryByRole("button", { name });

describe("TryPanel: вердикт", () => {
  it("в начале шага предлагает крутить самому", () => {
    render(panel(ONE_MOVE, ""));
    expect(verdict()).toMatch(/^Куб в начале шага/);
  });

  it("на пути алгоритма считает пройденные ходы", () => {
    render(panel({ ...ONE_MOVE, setup: "U' R'", algorithm: "R U" }, "R"));
    expect(verdict()).toBe("Верно, вы на пути алгоритма. Пройдено ходов: 1 из 2.");
  });

  it("сбившемуся советует отменить ход, а далеко ушедшему — начать заново", () => {
    const { rerender } = render(panel(ONE_MOVE, "U"));
    expect(verdict()).toMatch(/^Этот ход уводит от алгоритма/);

    rerender(panel(ONE_MOVE, "L D B F"));
    expect(verdict()).toMatch(/^Куб далеко ушёл от алгоритма/);
  });

  it("засчитанный шаг ведёт к следующему", async () => {
    const user = userEvent.setup();
    const onNextStep = jest.fn();
    render(panel(ONE_MOVE, "R", { onNextStep }));

    expect(verdict()).toBe("Шаг выполнен: цель достигнута, и именно тем алгоритмом.");
    await user.click(button("Следующий шаг")!);
    expect(onNextStep).toHaveBeenCalledTimes(1);
  });

  it("на последнем шаге кнопки «Следующий шаг» нет", () => {
    render(panel(ONE_MOVE, "R"));
    expect(button("Следующий шаг")).toBeNull();
  });

  it("цель другим путём не засчитывается: только пройти шаг заново (#69)", async () => {
    const user = userEvent.setup();
    const onReset = jest.fn();
    // R ставит крест, U его не трогает, но уводит с пути алгоритма.
    render(panel(CROSS, "R U", { onReset, onNextStep: jest.fn() }));

    expect(verdict()).toMatch(/не тем алгоритмом, которому учит шаг/);
    expect(button("Следующий шаг")).toBeNull();
    await user.click(button("Пройти шаг заново")!);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("поворот среднего слоя останавливает проверку, даже если цель на месте", () => {
    render(panel(ONE_MOVE, "R", { desynced: true, onNextStep: jest.fn() }));

    expect(verdict()).toMatch(/^Повёрнут средний слой/);
    expect(button("Следующий шаг")).toBeNull();
    expect((button("Подсказка") as HTMLButtonElement).disabled).toBe(true);
    expect(button("Вернуть к началу шага")).toBeTruthy();
  });
});

describe("TryPanel: подсказка", () => {
  it("по запросу называет следующий ход алгоритма и гаснет после хода", async () => {
    const user = userEvent.setup();
    const step: TryStep = { setup: "U' R'", algorithm: "R U", goal: { kind: "solved" } };
    const { rerender } = render(panel(step, ""));

    expect(screen.queryByText(/Следующий ход:/)).toBeNull();
    await user.click(button("Подсказка")!);

    const hint = screen.getByText(/Следующий ход:/);
    expect(hint.textContent).toBe(
      "Следующий ход: R — правую грань по часовой стрелке. Это следующий ход алгоритма."
    );
    expect((button("Подсказка") as HTMLButtonElement).disabled).toBe(true);

    // Сделан ход — подсказка была про прошлую позицию и уходит.
    rerender(panel(step, "R"));
    expect(screen.queryByText(/Следующий ход:/)).toBeNull();
    expect((button("Подсказка") as HTMLButtonElement).disabled).toBe(false);
  });

  it("сбившемуся подсказывает ход, возвращающий на путь", async () => {
    const user = userEvent.setup();
    render(panel(ONE_MOVE, "U"));

    await user.click(button("Подсказка")!);
    expect(screen.getByText(/Следующий ход:/).textContent).toBe(
      "Следующий ход: U' — верхнюю грань против часовой стрелки. Он возвращает куб на путь алгоритма."
    );
  });

  it("когда цель достигнута, подсказывать нечего", () => {
    render(panel(ONE_MOVE, "R"));
    expect((button("Подсказка") as HTMLButtonElement).disabled).toBe(true);
  });
});
