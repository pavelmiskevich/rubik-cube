/**
 * @jest-environment jsdom
 */

/*
  Управление проигрывателем посреди анимации хода (#136).

  Подмена куба в LessonPlayer.test.tsx доигрывает поворот микрозадачей, и
  нажать что-нибудь «посреди хода» там нельзя. Здесь поворот держится, пока
  тест сам его не отпустит, — как настоящая анимация в 320 мс, во время которой
  человек жмёт «Пауза». Почти всегда жмёт именно тогда: при проигрывании ходы
  идут вплотную.

  Расстановка стартовой позиции идёт мгновенно (длительность 1) и не держится.

  Главная проверка во всех сценариях одна: сколько ходов показал куб и сколько
  насчитал проигрыватель, совпадает, и проигрыватель после этого слушается.
*/

import { useEffect, useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LessonPlayer from "./LessonPlayer";
import type { RubiksCubeRef } from "@/components/cube/RubiksCube";
import { getLesson, type Lesson } from "@/content/lessons";

jest.mock("@/actions/progress", () => ({
  saveLessonProgress: jest.fn(() => Promise.resolve({ success: true })),
}));

interface Turn {
  axis: string;
  index: number;
  direction: number;
  /** Номер куба: пересборка через key даёт новый. */
  cube: number;
}

/** Поворот, начатый и ещё не доигранный, и всё, что доиграно. */
const mockCube: {
  held: (Turn & { finish: () => void })[];
  done: Turn[];
  mounts: number;
} = { held: [], done: [], mounts: 0 };

jest.mock("./LessonCube", () => ({
  __esModule: true,
  default: function HeldLessonCube(props: { onCube: (cube: RubiksCubeRef | null) => void }) {
    const propsRef = useRef(props);
    useEffect(() => {
      const cubeNo = ++mockCube.mounts;
      const cube: RubiksCubeRef = {
        rotateSlice: (axis, index, direction, duration = 320) =>
          new Promise<void>((resolve) => {
            const turn = { axis, index, direction, cube: cubeNo };
            if (duration <= 1) {
              mockCube.done.push(turn);
              resolve();
              return;
            }
            mockCube.held.push({
              ...turn,
              finish: () => {
                mockCube.done.push(turn);
                resolve();
              },
            });
          }),
      };
      const { onCube } = propsRef.current;
      onCube(cube);
      return () => onCube(null);
    }, []);
    return <div data-testid="lesson-cube" />;
  },
}));

/** Урок с одним шагом из собранного куба: проверяем проигрыватель, а не контент. */
function lessonWith(algorithm: string): Lesson {
  const base = getLesson("notation")!;
  return { ...base, steps: [{ ...base.steps[0], setup: "", algorithm }] };
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

/** Отпустить самый ранний начатый поворот — анимация доиграла. */
async function finishTurn() {
  const turn = mockCube.held.shift();
  if (!turn) throw new Error("поворота в полёте нет");
  await act(async () => {
    turn.finish();
  });
  await flush();
}

const counter = () => screen.getByText(/^Ход \d+ из \d+/).textContent;
/** Доигранные кубом повороты среза текущего куба. */
const shown = () => mockCube.done.filter((turn) => turn.cube === mockCube.mounts);

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  localStorage.clear();
  mockCube.held = [];
  mockCube.done = [];
  mockCube.mounts = 0;
});

async function open(algorithm: string) {
  const user = userEvent.setup();
  render(<LessonPlayer lesson={lessonWith(algorithm)} />);
  await flush();
  return user;
}

describe("LessonPlayer: нажатия посреди анимации хода (#136)", () => {
  it("«Пауза» посреди хода: ход доигрывается, «Играть» продолжает со следующего", async () => {
    const user = await open("R U F");

    await user.click(screen.getByRole("button", { name: "Играть" }));
    expect(mockCube.held).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Пауза" }));
    await finishTurn();

    expect(counter()).toBe("Ход 1 из 3");
    expect(shown()).toHaveLength(1);
    expect(mockCube.held).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Играть" }));
    expect(mockCube.held).toHaveLength(1);
    await finishTurn();
    await finishTurn();

    expect(counter()).toBe("Ход 3 из 3");
    expect(shown()).toHaveLength(3);
  });

  it("«Шаг назад» посреди хода: ход доигрывается и тут же отыгрывается обратно", async () => {
    const user = await open("R U F");

    await user.click(screen.getByRole("button", { name: "Играть" }));
    await user.click(screen.getByRole("button", { name: "Шаг назад" }));
    await finishTurn();

    expect(mockCube.held).toHaveLength(1);
    await finishTurn();

    const [forward, back] = shown();
    expect(back.direction).toBe(-forward.direction);
    expect(counter()).toBe("Ход 0 из 3");
    expect(mockCube.held).toHaveLength(0);
  });

  it("смена скорости посреди хода не останавливает проигрывание", async () => {
    const user = await open("R U F");

    await user.click(screen.getByRole("button", { name: "Играть" }));
    await user.click(screen.getByRole("button", { name: "2×" }));
    await finishTurn();

    expect(mockCube.held).toHaveLength(1);
    await finishTurn();
    await finishTurn();
    expect(counter()).toBe("Ход 3 из 3");
    expect(shown()).toHaveLength(3);
  });

  it("двойной ход не обрывается между четвертями", async () => {
    const user = await open("R2 U");

    await user.click(screen.getByRole("button", { name: "Играть" }));
    await user.click(screen.getByRole("button", { name: "Пауза" }));
    await finishTurn();

    // Вторая четверть R2 — тот же ход, он доигрывается и на паузе.
    expect(mockCube.held).toHaveLength(1);
    await finishTurn();

    expect(shown()).toHaveLength(2);
    expect(counter()).toBe("Ход 1 из 2");
    expect(mockCube.held).toHaveLength(0);
  });

  it("«Шаг вперёд» после паузы посреди хода двигает и счётчик, и куб", async () => {
    const user = await open("R U F");

    await user.click(screen.getByRole("button", { name: "Играть" }));
    await user.click(screen.getByRole("button", { name: "Пауза" }));
    await finishTurn();

    await user.click(screen.getByRole("button", { name: "Шаг вперёд" }));
    await finishTurn();

    expect(counter()).toBe("Ход 2 из 3");
    expect(shown()).toHaveLength(2);
  });

  it("«Сначала» посреди хода: прежний ход не засчитывается новому кубу", async () => {
    const user = await open("R U F");

    await user.click(screen.getByRole("button", { name: "Играть" }));
    await user.click(screen.getByRole("button", { name: "Сначала" }));
    await flush();

    // Старый куб снят, его поворот доигрывает в пустоту — новому он не ход.
    await finishTurn();
    expect(counter()).toBe("Ход 0 из 3");
    expect(shown()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Играть" }));
    expect(mockCube.held).toHaveLength(1);
    await finishTurn();
    // Первый ход нового куба доигран и засчитан, проигрывание идёт дальше:
    // второй ход уже в полёте, поэтому счётчик на нём, а не на первом.
    expect(shown()).toHaveLength(1);
    expect(mockCube.held).toHaveLength(1);
    expect(counter()).toBe("Ход 2 из 3");
  });
});
