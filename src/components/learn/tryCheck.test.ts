import { LESSONS } from "@/content/lessons";
import { isGoalReached, type LessonStep } from "@/content/lessons/types";
import { crossLesson } from "@/content/lessons/cross";
import {
  MOVES,
  applyNotation,
  applySequence,
  formatSequence,
  parseMove,
  parseSequence,
  type Move,
} from "@/lib/cube/moves";
import { assessTry, describeMove, simplify, type TryStep } from "./tryCheck";

const seq = parseSequence;
const stepById = (id: string): LessonStep => {
  const step = crossLesson.steps.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`нет шага ${id}`);
  return step;
};

/** Ход в четвертях оборота — так их присылает жест: F2 приходит как F F. */
const asQuarters = (moves: readonly Move[]): Move[] =>
  moves.flatMap((move) =>
    move.turn === 2 ? [{ face: move.face, turn: 1 as const }, { face: move.face, turn: 1 as const }] : [move]
  );

const allSteps = LESSONS.flatMap((lesson) =>
  lesson.steps.map((step) => ({ lesson: lesson.slug, step }))
);

/** Детерминированный генератор: случайные блуждания воспроизводятся от прогона к прогону. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

describe("simplify", () => {
  it.each([
    ["R R", "R2"],
    ["R R R", "R'"],
    ["R R'", ""],
    ["R2 R", "R'"],
    ["U R R' U'", ""],
    ["F U U U U F", "F2"],
    ["R U R'", "R U R'"],
  ])("%s → «%s»", (input, expected) => {
    expect(formatSequence(simplify(seq(input)))).toBe(expected);
  });

  it("не меняет итоговое состояние", () => {
    const moves = seq("R R U U' F2 F2 B L L L D");
    expect(applySequence(applyNotation(""), simplify(moves))).toEqual(
      applySequence(applyNotation(""), moves)
    );
  });
});

describe("assessTry: шаг, который человек крутит сам", () => {
  it("до первого хода — начало, подсказка — первый ход алгоритма", () => {
    const step = stepById("edge-aside");
    const result = assessTry(step, []);

    expect(result.status).toBe("start");
    expect(result.progress).toBe(0);
    expect(result.total).toBe(2);
    expect(result.hint).toEqual(parseMove("U'"));
  });

  it("правильно выполненный шаг распознаётся и отмечается", () => {
    const step = stepById("edge-aside");
    const result = assessTry(step, seq("U' F2"));

    expect(result.status).toBe("done");
    expect(result.onAlgorithm).toBe(true);
    expect(result.progress).toBe(2);
    expect(result.hint).toBeNull();
  });

  it("половина оборота из двух четвертей — всё ещё путь алгоритма", () => {
    const step = stepById("edge-up");

    const halfway = assessTry(step, seq("F"));
    expect(halfway.status).toBe("on-track");
    expect(halfway.progress).toBe(0);
    expect(halfway.hint).toEqual(parseMove("F"));

    // В другую сторону — тоже путь: F' F' и есть F2.
    const otherWay = assessTry(step, seq("F'"));
    expect(otherWay.status).toBe("on-track");
    expect(otherWay.hint).toEqual(parseMove("F'"));

    expect(assessTry(step, seq("F F")).status).toBe("done");
    expect(assessTry(step, seq("F' F'")).status).toBe("done");
  });

  it("считает пройденные ходы алгоритма", () => {
    const step = stepById("cross-whole");
    const result = assessTry(step, seq("U R2"));

    expect(result.status).toBe("on-track");
    expect(result.progress).toBe(2);
    expect(result.total).toBe(4);
    expect(result.hint).toEqual(parseMove("U'"));
  });

  it("отклонение распознаётся и не выдаётся за успех", () => {
    const step = stepById("edge-aside");
    const result = assessTry(step, seq("R"));

    expect(result.status).toBe("off-track");
    expect(result.onAlgorithm).toBe(false);
    // Подсказка — отменить лишний ход.
    expect(result.hint).toEqual(parseMove("R'"));
  });

  it("отмена и следующий ход той же грани подсказываются одним ходом", () => {
    const step = stepById("edge-aside");
    // Нужно было U', сделано U: вернуться и продолжить — это U2.
    const result = assessTry(step, seq("U"));

    expect(result.status).toBe("off-track");
    expect(result.hint).toEqual(parseMove("U2"));
    expect(assessTry(step, seq("U U2")).status).toBe("on-track");
  });

  it("правильный алгоритм, сделанный не с того хода, — не успех", () => {
    const step = stepById("cross-whole");
    // Первые два хода переставлены: буквы те же, результат нет.
    const result = assessTry(step, seq("R2 U U' F2"));

    expect(result.status).not.toBe("done");
    expect(isGoalReached(applySequence(applyNotation(step.setup), seq("R2 U U' F2")), step.goal)).toBe(
      false
    );
  });

  it("отменённое отклонение возвращает на путь", () => {
    const step = stepById("cross-whole");
    const result = assessTry(step, seq("U R R' R2"));

    expect(result.status).toBe("on-track");
    expect(result.progress).toBe(2);
  });

  it("уход далеко от алгоритма сообщает, сколько ходов отматывать", () => {
    const step = stepById("edge-up");
    const result = assessTry(step, seq("R U L"));

    expect(result.status).toBe("off-track");
    expect(result.stray).toBe(3);
    expect(result.hint).toEqual(parseMove("L'"));
  });

  it("цель, достигнутая другим путём, — успех, но не по алгоритму", () => {
    const step = stepById("edge-up");
    // После F2 цель достигнута; лишний U не трогает нижний крест.
    const result = assessTry(step, seq("F2 U"));

    expect(result.status).toBe("done");
    expect(result.onAlgorithm).toBe(false);
  });

  it.each(allSteps)(
    "$lesson / $step.id: алгоритм четвертями оборота выполняет шаг",
    ({ step }) => {
      const quarters = asQuarters(seq(step.algorithm));
      const result = assessTry(step, quarters);
      expect(result.status).toBe("done");
      expect(result.onAlgorithm).toBe(true);

      // По дороге человек ни разу не сбился.
      for (let count = 0; count < quarters.length; count++) {
        const midway = assessTry(step, quarters.slice(0, count)).status;
        expect(["start", "on-track", "done"]).toContain(midway);
      }
    }
  );

  it.each(allSteps)(
    "$lesson / $step.id: успех — только когда цель шага правда достигнута",
    ({ step }) => {
      const random = seeded(step.id.length * 7919 + 17);
      const start = applyNotation(step.setup);

      for (let walk = 0; walk < 40; walk++) {
        const history: Move[] = [];
        const length = 1 + Math.floor(random() * 6);
        for (let index = 0; index < length; index++) {
          history.push(MOVES[Math.floor(random() * MOVES.length)]);
        }

        const reached = isGoalReached(applySequence(start, history), step.goal);
        expect(assessTry(step, history).status === "done").toBe(reached);
      }
    }
  );

  it.each(allSteps)(
    "$lesson / $step.id: подсказка из любого состояния доводит до цели",
    ({ step }) => {
      const random = seeded(step.id.length * 104729 + 3);
      const algorithmLength = seq(step.algorithm).length;

      for (let walk = 0; walk < 40; walk++) {
        const history: Move[] = [];
        const length = Math.floor(random() * 12);
        for (let index = 0; index < length; index++) {
          history.push(MOVES[Math.floor(random() * MOVES.length)]);
        }

        // Верхняя граница честная: отмотать всё, что накручено, и пройти алгоритм.
        const budget = length + algorithmLength;
        let hints = 0;
        let result = assessTry(step, history);
        while (result.status !== "done") {
          expect(result.hint).not.toBeNull();
          // Каждая подсказка сокращает оставшийся путь к цели.
          const before = result.plan.length;
          history.push(result.hint as Move);
          result = assessTry(step, history);
          if (result.status !== "done") expect(result.plan.length).toBeLessThan(before);
          hints++;
          expect(hints).toBeLessThanOrEqual(budget);
        }
      }
    }
  );

  it.each(allSteps)(
    "$lesson / $step.id: подсказка, выполненная четвертями, тоже доводит до цели",
    ({ step }) => {
      const history = seq("R U' L2");
      let guard = 0;
      let result = assessTry(step, history);
      while (result.status !== "done") {
        history.push(...asQuarters([result.hint as Move]));
        result = assessTry(step, history);
        expect(++guard).toBeLessThan(40);
      }
    }
  );
});

describe("assessTry: план на пути алгоритма", () => {
  /**
   * Шаг с алгоритмом, повторённым дважды: на стыке повторов стоит пара `F' F`,
   * а крутить её человеку незачем — позиция от неё не меняется. Такие алгоритмы
   * появляются в уроках последнего слоя, где последовательность применяют
   * дважды или трижды.
   */
  const repeated: TryStep = {
    setup: "F R U R' U' F' F R U R' U' F'",
    algorithm: "F R U R' U' F' F R U R' U' F'",
    goal: { kind: "solved" },
  };

  it("не оставляет в плане пару ходов, которая сама себя отменяет", () => {
    // Сделан первый ход алгоритма. В остатке записи стык повторов — `… F' F …`,
    // и крутить эту пару незачем: позиция от неё не меняется.
    const result = assessTry(repeated, seq("F"));

    expect(result.status).toBe("on-track");
    expect(formatSequence(result.plan)).toBe("R U R' U' R U R' U' F'");
  });

  it("возврат на путь алгоритма сокращает план, а не удлиняет его", () => {
    // Лишний ход в сторону, затем подсказка обратно. Пока план на пути брался
    // сырым остатком, он здесь становился длиннее: десять ходов против одиннадцати.
    const history = seq("F U");
    const strayed = assessTry(repeated, history);
    expect(strayed.status).toBe("off-track");

    const back = assessTry(repeated, [...history, strayed.hint as Move]);
    expect(back.status).toBe("on-track");
    expect(back.plan.length).toBeLessThan(strayed.plan.length);
  });
});

describe("describeMove", () => {
  it.each([
    ["F2", "переднюю грань на пол-оборота"],
    ["U'", "верхнюю грань против часовой стрелки"],
    ["R", "правую грань по часовой стрелке"],
    ["D", "нижнюю грань по часовой стрелке"],
    ["L'", "левую грань против часовой стрелки"],
    ["B2", "заднюю грань на пол-оборота"],
  ])("%s — «%s»", (notation, text) => {
    expect(describeMove(parseMove(notation))).toBe(text);
  });
});
