/**
 * Сессия режима «Попробовать»: какие ходы человек сделал на кубе с начала шага.
 *
 * Куб сообщает о себе двумя событиями. `onRotateEnd` — на конец любого
 * поворота среза, своего или программного. `onMove` — только на поворот,
 * сделанный рукой, и только если у среза есть имя в нотации граней. Средний
 * срез хода не присылает: движок не знает `M`, `E` и `S` и знать не будет.
 *
 * Отсюда два правила, ради которых сессия вынесена в чистый редьюсер.
 *
 * **Поворот без хода — это расхождение.** Модель о таком повороте не узнала,
 * а картинка его показала. Продолжать проверку на разошедшейся модели значит
 * объявить верное неверным или наоборот, поэтому сессия помечает себя
 * разошедшейся, и это держится до возврата к началу шага. Первые повороты
 * после пересборки куба не в счёт: это программная расстановка стартовой
 * позиции, их число известно заранее.
 *
 * Как отличить «ход ещё не пришёл» от «хода не будет»: куб зовёт
 * `onRotateEnd`, затем разрешает промис поворота, и ход приходит микрозадачей
 * сразу за ним. Проверка ставится таймером после `onRotateEnd`, то есть
 * заведомо после этой микрозадачи — и до конца следующего поворота, который
 * заканчивается не раньше следующего кадра.
 *
 * **События снятого куба не считаются.** Возврат к началу пересобирает куб,
 * а поворот, начатый на старом, может доиграть уже после этого. Каждое
 * событие несёт поколение куба, и чужие поколения отбрасываются.
 */

import { sliceTurnsForMove } from "@/lib/cube/bridge";
import type { Move } from "@/lib/cube/moves";

export interface TrySession {
  /** Поколение куба, с которым идёт сессия; события других поколений отбрасываются. */
  generation: number;
  /** Сколько поворотов расстановки стартовой позиции ещё не закончилось. */
  setupTurnsLeft: number;
  /** Ходы человека от стартовой позиции шага, четвертями оборота. */
  history: Move[];
  /** Сколько поворотов закончилось, а хода по ним не пришло. */
  unreported: number;
  /** Картинка и модель разошлись; лечится только возвратом к началу шага. */
  desynced: boolean;
}

export type TrySessionEvent =
  | { type: "reset"; generation: number; setupTurns: number }
  | { type: "rotation-end"; generation: number }
  | { type: "move"; generation: number; move: Move }
  | { type: "check"; generation: number };

/** До первого сброса сессия не принадлежит никакому кубу. */
export function initialTrySession(): TrySession {
  return { generation: -1, setupTurnsLeft: 0, history: [], unreported: 0, desynced: false };
}

/** Сколько поворотов среза делает расстановка: пол-оборота — два поворота. */
export function setupTurnCount(setup: readonly Move[]): number {
  return setup.reduce((count, move) => count + sliceTurnsForMove(move).length, 0);
}

export function trySessionReducer(state: TrySession, event: TrySessionEvent): TrySession {
  if (event.type === "reset") {
    return {
      generation: event.generation,
      setupTurnsLeft: event.setupTurns,
      history: [],
      unreported: 0,
      desynced: false,
    };
  }

  if (event.generation !== state.generation) return state;

  switch (event.type) {
    case "rotation-end":
      return state.setupTurnsLeft > 0
        ? { ...state, setupTurnsLeft: state.setupTurnsLeft - 1 }
        : { ...state, unreported: state.unreported + 1 };

    case "move":
      return {
        ...state,
        history: [...state.history, event.move],
        unreported: Math.max(0, state.unreported - 1),
      };

    case "check":
      return state.unreported > 0 && !state.desynced ? { ...state, desynced: true } : state;
  }
}
