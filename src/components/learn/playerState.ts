/**
 * Состояние проигрывателя урока: какой шаг открыт и сколько ходов его
 * алгоритма уже показано.
 *
 * Вынесено из компонента по образцу `workspaceState.ts`: правила — когда
 * проигрывание само останавливается, что делает «назад» на первом ходу, как
 * ведёт себя повтор — проверяются тестом, а не глазами на экране.
 *
 * Индекс хода здесь единственный источник правды. Куб получает ровно один ход
 * на каждый переход `moveIndex`, поэтому картинка и модель не могут разойтись:
 * разойтись было бы нечему.
 */

export type Speed = 0.5 | 1 | 2;

export interface PlayerState {
  /** Номер открытого шага урока. */
  stepIndex: number;
  /** Сколько ходов алгоритма уже проиграно: от 0 до totalMoves. */
  moveIndex: number;
  /** Сколько ходов в алгоритме открытого шага. */
  totalMoves: number;
  playing: boolean;
  speed: Speed;
  /**
   * Меняется — куб пересобирается из собранного состояния и стартовой
   * последовательности шага.
   *
   * Повтор и смена шага именно пересобирают куб, а не отматывают ходы назад.
   * Отматывание накапливало бы ошибку округления в анимации и расхождение с
   * моделью тем быстрее, чем чаще человек жмёт повтор, — а он будет жать.
   */
  resetToken: number;
}

export type PlayerEvent =
  | { type: "play" }
  | { type: "pause" }
  | { type: "forward" }
  | { type: "back" }
  | { type: "restart" }
  | { type: "speed"; speed: Speed }
  | { type: "select-step"; stepIndex: number; totalMoves: number };

export function initialPlayerState(totalMoves: number): PlayerState {
  return {
    stepIndex: 0,
    moveIndex: 0,
    totalMoves,
    playing: false,
    speed: 1,
    resetToken: 0,
  };
}

/** Открыть шаг с начала: с нулевого хода и с пересборкой куба. */
const openStep = (state: PlayerState, stepIndex: number, totalMoves: number): PlayerState => ({
  ...state,
  stepIndex,
  totalMoves,
  moveIndex: 0,
  playing: false,
  resetToken: state.resetToken + 1,
});

export function playerReducer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case "play":
      // Нажать «играть» в конце — значит посмотреть ещё раз: иначе кнопка
      // просто не отвечала бы, и это выглядело бы поломкой.
      return state.moveIndex >= state.totalMoves
        ? { ...openStep(state, state.stepIndex, state.totalMoves), playing: true }
        : { ...state, playing: true };

    case "pause":
      return { ...state, playing: false };

    case "forward":
      return state.moveIndex >= state.totalMoves
        ? { ...state, playing: false }
        : { ...state, moveIndex: state.moveIndex + 1 };

    case "back":
      // Шаг назад — действие руками, и продолжать проигрывание после него
      // человек не просил.
      return state.moveIndex <= 0
        ? { ...state, playing: false }
        : { ...state, moveIndex: state.moveIndex - 1, playing: false };

    case "restart":
      return openStep(state, state.stepIndex, state.totalMoves);

    case "speed":
      return { ...state, speed: event.speed };

    case "select-step":
      return openStep(state, event.stepIndex, event.totalMoves);
  }
}

/** Все ходы алгоритма показаны. */
export const isFinished = (state: PlayerState): boolean =>
  state.totalMoves > 0 && state.moveIndex >= state.totalMoves;
