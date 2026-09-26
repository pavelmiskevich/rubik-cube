/**
 * @jest-environment jsdom
 */

/*
  Проигрыватель урока со всей связкой «Попробовать»: useTrySession, TryPanel,
  completion и прогресс — всё настоящее. Заменён только 3D-куб: WebGL в jsdom
  нет, а ходы человека в нём приходят от жестов по канвасу.

  Подмена держит контракт настоящего куба (RubiksCube.tsx), тот же, что
  рецепт ручной проверки в HANDOFF.md:
  - rotateSlice на каждый поворот зовёт onRotateEnd и только потом разрешает
    промис; снятый куб поворотов не делает и не сообщает о них;
  - ход рукой — onRotateEnd, затем onMove с ходом микрозадачей следом;
  - поворот среднего слоя — onRotateEnd без onMove.

  Урок — настоящий, «Знакомство с кубиком»: шаги у него короткие, цель везде —
  собранный куб.
*/

import { useEffect, useRef } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LessonPlayer from "./LessonPlayer";
import type { RubiksCubeRef } from "@/components/cube/RubiksCube";
import { getLesson } from "@/content/lessons";
import { LOCAL_PROGRESS_KEY } from "@/lib/lessonProgress";
import { parseSequence, type Move } from "@/lib/cube/moves";

jest.mock("@/actions/progress", () => ({
  saveLessonProgress: jest.fn(() => Promise.resolve({ success: true })),
}));

interface CubeProps {
  onCube: (cube: RubiksCubeRef | null) => void;
  onMove?: (move: Move) => void;
  onRotateEnd?: () => void;
}

/** Свойства куба, который сейчас на экране. */
const mockMounted: { props: CubeProps | null; turns: number } = { props: null, turns: 0 };

jest.mock("./LessonCube", () => ({
  __esModule: true,
  default: function FakeLessonCube(props: CubeProps) {
    const propsRef = useRef(props);
    useEffect(() => {
      propsRef.current = props;
      mockMounted.props = props;
    });

    useEffect(() => {
      let mounted = true;
      const cube: RubiksCubeRef = {
        rotateSlice: async () => {
          // Поворот доигрывает не сразу: отдаём управление, как кадр анимации.
          await Promise.resolve();
          if (!mounted) return;
          mockMounted.turns += 1;
          propsRef.current.onRotateEnd?.();
        },
      };
      propsRef.current.onCube(cube);
      return () => {
        mounted = false;
        propsRef.current.onCube(null);
      };
    }, []);

    return <div data-testid="lesson-cube" />;
  },
}));

const NOTATION = getLesson("notation")!;
const LAST = NOTATION.steps.length;

/** Дать доиграть повороты и проверке после них — она стоит таймером. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

/** Ходы рукой: каждый — четверть оборота, как присылает жест. */
async function turnByHand(notation: string) {
  for (const move of parseSequence(notation)) {
    const quarters = move.turn === 2 ? 2 : 1;
    for (let i = 0; i < quarters; i++) {
      const quarter: Move = move.turn === 2 ? { face: move.face, turn: 1 } : move;
      await act(async () => {
        const props = mockMounted.props!;
        props.onRotateEnd?.();
        await Promise.resolve();
        props.onMove?.(quarter);
      });
      await settle();
    }
  }
}

/** Поворот среднего слоя: конец поворота есть, хода в нотации граней нет. */
async function turnMiddleLayer() {
  await act(async () => {
    mockMounted.props!.onRotateEnd?.();
  });
  await settle();
}

const verdict = () => screen.getByRole("status").textContent;
const currentStep = () =>
  within(screen.getByRole("list", { name: "Шаги урока" }))
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-current") === "step")!.textContent;

const storedProgress = () =>
  JSON.parse(localStorage.getItem(LOCAL_PROGRESS_KEY) ?? "{}")[NOTATION.slug];

beforeAll(() => {
  // Ни того ни другого в jsdom нет.
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
  mockMounted.props = null;
  mockMounted.turns = 0;
});

async function openTry() {
  const user = userEvent.setup();
  render(<LessonPlayer lesson={NOTATION} />);
  await settle();
  await user.click(screen.getByRole("button", { name: "Попробовать" }));
  await settle();
  return user;
}

describe("LessonPlayer: «Попробовать»", () => {
  it("подсказывает ход, засчитывает шаг и ведёт к следующему", async () => {
    const user = await openTry();

    expect(verdict()).toMatch(/^Куб в начале шага/);
    await user.click(screen.getByRole("button", { name: "Подсказка" }));
    expect(screen.getByText(/Следующий ход:/).textContent).toMatch(/^Следующий ход: R — правую грань/);

    await turnByHand("R");
    expect(verdict()).toBe("Шаг выполнен: цель достигнута, и именно тем алгоритмом.");
    expect(screen.queryByText(/Следующий ход:/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Следующий шаг" }));
    await settle();

    expect(currentStep()).toMatch(/^2\./);
    expect(verdict()).toMatch(/^Куб в начале шага/);
    // Прогресс анонима пишется в браузер: открыт второй шаг.
    expect(storedProgress()).toEqual({ stepIndex: 1, completed: false });
  });

  it("стартовая позиция шага ставится на куб и в проверку не идёт", async () => {
    await openTry();

    // Шаг 1 начинается с R' — один поворот расстановки, и он не расхождение.
    expect(mockMounted.turns).toBeGreaterThanOrEqual(1);
    expect(verdict()).toMatch(/^Куб в начале шага/);
  });

  it("сбившегося возвращает к началу шага", async () => {
    const user = await openTry();

    await turnByHand("U");
    expect(verdict()).toMatch(/^Этот ход уводит от алгоритма/);

    await user.click(screen.getByRole("button", { name: "Вернуть к началу шага" }));
    await settle();

    expect(verdict()).toMatch(/^Куб в начале шага/);
    await turnByHand("R");
    expect(verdict()).toMatch(/^Шаг выполнен/);
  });

  it("поворот среднего слоя останавливает проверку до возврата к началу", async () => {
    const user = await openTry();

    await turnMiddleLayer();
    expect(verdict()).toMatch(/^Повёрнут средний слой/);

    // Даже верный ход после этого шаг не засчитывает.
    await turnByHand("R");
    expect(verdict()).toMatch(/^Повёрнут средний слой/);
    expect(screen.queryByRole("button", { name: "Следующий шаг" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Вернуть к началу шага" }));
    await settle();
    await turnByHand("R");
    expect(verdict()).toMatch(/^Шаг выполнен/);
  });

  it("последний шаг, собранный своими руками, — урок пройден (#69)", async () => {
    const user = userEvent.setup();
    render(<LessonPlayer lesson={NOTATION} />);
    await settle();

    const last = NOTATION.steps[LAST - 1];
    await user.click(
      screen.getByRole("button", { name: `Попробовать шаг ${LAST}: ${last.title}` })
    );
    await settle();

    expect(currentStep()).toMatch(new RegExp(`^${LAST}\\.`));
    expect(screen.queryByTestId("lesson-completed")).toBeNull();

    await turnByHand(last.algorithm);

    expect(verdict()).toMatch(/^Шаг выполнен/);
    expect(screen.getByTestId("lesson-completed").textContent).toBe("Урок пройден");
    expect(screen.queryByRole("button", { name: "Следующий шаг" })).toBeNull();
    expect(storedProgress()).toEqual({ stepIndex: LAST - 1, completed: true });
  });
});

describe("LessonPlayer: «Посмотреть» и прогресс", () => {
  it("проигранный до конца последний шаг тоже проходит урок", async () => {
    const user = userEvent.setup();
    render(<LessonPlayer lesson={NOTATION} />);
    await settle();

    await user.click(screen.getByRole("button", { name: new RegExp(`^${LAST}\\. `) }));
    await settle();
    await user.click(screen.getByRole("button", { name: "Играть" }));

    const total = parseSequence(NOTATION.steps[LAST - 1].algorithm).length;
    for (let i = 0; i < total + 2; i++) await settle();

    expect(screen.getByText(`Ход ${total} из ${total}`)).toBeTruthy();
    expect(screen.getByTestId("lesson-completed")).toBeTruthy();
  });

  it("возвращает к шагу, на котором остановились", async () => {
    localStorage.setItem(
      LOCAL_PROGRESS_KEY,
      JSON.stringify({ [NOTATION.slug]: { stepIndex: 2, completed: false } })
    );

    render(<LessonPlayer lesson={NOTATION} />);
    await settle();

    expect(currentStep()).toMatch(/^3\./);
    expect(screen.queryByTestId("lesson-completed")).toBeNull();
  });

  it("однажды пройденный урок остаётся пройденным и с первого шага", async () => {
    localStorage.setItem(
      LOCAL_PROGRESS_KEY,
      JSON.stringify({ [NOTATION.slug]: { stepIndex: 0, completed: true } })
    );

    render(<LessonPlayer lesson={NOTATION} />);
    await settle();

    expect(currentStep()).toMatch(/^1\./);
    expect(screen.getByTestId("lesson-completed")).toBeTruthy();
  });
});
