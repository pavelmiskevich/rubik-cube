import { crossLesson } from "@/content/lessons/cross";
import { LESSONS } from "@/content/lessons";
import { moveForSliceTurn, sliceTurnsForMove, type SliceTurn } from "@/lib/cube/bridge";
import { formatMove, parseMove, parseSequence, type Move } from "@/lib/cube/moves";
import { assessTry } from "./tryCheck";
import {
  initialTrySession,
  setupTurnCount,
  trySessionReducer,
  type TrySession,
  type TrySessionEvent,
} from "./trySession";

const run = (state: TrySession, ...events: TrySessionEvent[]): TrySession =>
  events.reduce(trySessionReducer, state);

/** Сессия поколения `generation`, стартовая позиция которой ставится `setupTurns` поворотами. */
const fresh = (generation = 1, setupTurns = 0): TrySession =>
  trySessionReducer(initialTrySession(), { type: "reset", generation, setupTurns });

/**
 * Что куб присылает на один поворот среза, сделанный рукой: конец анимации,
 * затем ход — если у среза есть имя в нотации. Средний срез хода не шлёт.
 */
function gesture(generation: number, turn: SliceTurn): TrySessionEvent[] {
  const move = moveForSliceTurn(turn);
  const events: TrySessionEvent[] = [{ type: "rotation-end", generation }];
  if (move) events.push({ type: "move", generation, move });
  return events;
}

const gesturesFor = (generation: number, notation: string): TrySessionEvent[] =>
  parseSequence(notation)
    .flatMap(sliceTurnsForMove)
    .flatMap((turn) => [...gesture(generation, turn), { type: "check", generation } as const]);

describe("setupTurnCount", () => {
  it("считает повороты среза, а не ходы: пол-оборота — два поворота", () => {
    expect(setupTurnCount(parseSequence(""))).toBe(0);
    expect(setupTurnCount(parseSequence("F2 U"))).toBe(3);
    expect(setupTurnCount(parseSequence("F2 U R2 U'"))).toBe(6);
  });
});

describe("сессия «Попробовать»", () => {
  it("начинается пустой и без расхождения", () => {
    const state = fresh();
    expect(state.history).toEqual([]);
    expect(state.desynced).toBe(false);
  });

  it("не принимает за ходы человека повороты, ставящие стартовую позицию", () => {
    const state = run(
      fresh(1, 3),
      { type: "rotation-end", generation: 1 },
      { type: "rotation-end", generation: 1 },
      { type: "rotation-end", generation: 1 },
      { type: "check", generation: 1 }
    );
    expect(state.history).toEqual([]);
    expect(state.desynced).toBe(false);
  });

  it("записывает ходы жестов по порядку", () => {
    const state = run(fresh(), ...gesturesFor(1, "U' F2"));
    expect(state.history).toEqual([parseMove("U'"), parseMove("F"), parseMove("F")]);
    expect(state.desynced).toBe(false);
  });

  it("серия быстрых поворотов: проверки между ними ничего не ломают", () => {
    // Двадцать поворотов, причём проверка приходит уже после следующего поворота.
    const moves = parseSequence("R U R' U' F2 B L' D2 R U R' U' F2 B L' D2 R U R' U'");
    const events: TrySessionEvent[] = [];
    moves.forEach((move) => {
      const [turn] = sliceTurnsForMove({ face: move.face, turn: move.turn === 3 ? 3 : 1 });
      events.push(...gesture(1, turn));
    });
    events.push(...moves.map(() => ({ type: "check", generation: 1 }) as const));

    const state = run(fresh(), ...events);
    expect(state.history).toHaveLength(moves.length);
    expect(state.desynced).toBe(false);
  });

  it("поворот среднего слоя без хода — расхождение модели и картинки", () => {
    const state = run(
      fresh(),
      ...gesture(1, { axis: "x", index: 0, direction: 1 }),
      { type: "check", generation: 1 }
    );
    expect(state.desynced).toBe(true);
  });

  it("расхождение держится до возврата к началу шага", () => {
    let state = run(
      fresh(),
      ...gesture(1, { axis: "y", index: 0, direction: -1 }),
      { type: "check", generation: 1 },
      ...gesturesFor(1, "R R'")
    );
    expect(state.desynced).toBe(true);

    state = run(state, { type: "reset", generation: 2, setupTurns: 0 });
    expect(state.desynced).toBe(false);
    expect(state.history).toEqual([]);
  });

  it("игнорирует события куба, снятого при возврате к началу", () => {
    // Поворот, начатый на старом кубе, доигрывается уже после пересборки.
    const state = run(
      fresh(1),
      { type: "reset", generation: 2, setupTurns: 0 },
      ...gesturesFor(1, "R"),
      ...gesturesFor(2, "U")
    );
    expect(state.history).toEqual([parseMove("U")]);
    expect(state.desynced).toBe(false);
  });

  it("до первого сброса ничего не принимает", () => {
    const state = run(initialTrySession(), ...gesturesFor(0, "R"));
    expect(state.history).toEqual([]);
  });
});

/**
 * Сквозная проверка прохождения шага: от жеста на кубе до вердикта урока.
 *
 * Шаг проходится так, как его проходит человек: стартовая позиция ставится
 * программными поворотами, затем каждый ход алгоритма превращается в повороты
 * среза, повороты — обратно в ходы тем же мостом, что и у настоящего куба, и
 * всё это идёт через модель сессии в проверку шага.
 */
describe("сквозной прогон шага в режиме «Попробовать»", () => {
  const allSteps = LESSONS.flatMap((lesson) =>
    lesson.steps.map((step) => ({ lesson: lesson.slug, step }))
  );

  const setupEvents = (generation: number, setup: string): TrySessionEvent[] =>
    parseSequence(setup)
      .flatMap(sliceTurnsForMove)
      .map(() => ({ type: "rotation-end", generation }) as const);

  const open = (setup: string, generation = 1): TrySession =>
    run(
      trySessionReducer(initialTrySession(), {
        type: "reset",
        generation,
        setupTurns: setupTurnCount(parseSequence(setup)),
      }),
      ...setupEvents(generation, setup)
    );

  it.each(allSteps)("$lesson / $step.id: пройден правильно — отмечен", ({ step }) => {
    const state = run(open(step.setup), ...gesturesFor(1, step.algorithm));
    expect(state.desynced).toBe(false);
    expect(assessTry(step, state.history).status).toBe("done");
  });

  it.each(allSteps)("$lesson / $step.id: пройден неправильно — не успех", ({ step }) => {
    // Лишний поворот задней грани перед алгоритмом: цель шага не достигнута.
    const state = run(open(step.setup), ...gesturesFor(1, `B ${step.algorithm}`));
    const result = assessTry(step, state.history);
    expect(result.status).toBe("off-track");
    expect(result.hint).not.toBeNull();
  });

  it.each(allSteps)(
    "$lesson / $step.id: запутан, возвращён к началу — проходится заново",
    ({ step }) => {
      let state = run(
        open(step.setup),
        ...gesturesFor(1, "R U F' L2 D B' R2 U'"),
        ...gesture(1, { axis: "z", index: 0, direction: 1 }),
        { type: "check", generation: 1 }
      );
      expect(state.desynced).toBe(true);

      // «Вернуть к началу шага»: куб пересобран, стартовая позиция поставлена заново.
      state = run(
        state,
        { type: "reset", generation: 2, setupTurns: setupTurnCount(parseSequence(step.setup)) },
        ...setupEvents(2, step.setup)
      );
      expect(state.desynced).toBe(false);
      expect(assessTry(step, state.history).status).toBe("start");

      state = run(state, ...gesturesFor(2, step.algorithm));
      expect(assessTry(step, state.history).status).toBe("done");
    }
  );

  it("подсказки, выполненные жестами, доводят запутанный шаг до цели", () => {
    const step = crossLesson.steps[crossLesson.steps.length - 1];
    let state = run(open(step.setup), ...gesturesFor(1, "L D' B2"));
    let guard = 0;
    let result = assessTry(step, state.history);
    while (result.status !== "done") {
      state = run(state, ...gesturesFor(1, formatMove(result.hint as Move)));
      result = assessTry(step, state.history);
      expect(++guard).toBeLessThan(20);
    }
    expect(state.desynced).toBe(false);
  });
});
