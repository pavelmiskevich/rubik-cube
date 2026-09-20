"use client";

import { useEffect, useMemo, useReducer } from "react";
import { parseSequence, type Move } from "@/lib/cube/moves";
import { assessTry, type TryAssessment, type TryStep } from "./tryCheck";
import { initialTrySession, setupTurnCount, trySessionReducer } from "./trySession";

export interface TryCubeHandlers {
  onMove: (move: Move) => void;
  onRotateEnd: () => void;
}

export interface TrySessionView {
  /** Обработчики для куба; undefined вне режима «Попробовать». */
  handlers: TryCubeHandlers | undefined;
  assessment: TryAssessment;
  /** Картинка и модель разошлись: проверка остановлена до возврата к началу. */
  desynced: boolean;
  /** Сколько поворотов человек сделал с начала шага. */
  moveCount: number;
}

/**
 * Связка сессии «Попробовать» с кубом урока.
 *
 * `generation` — номер пересборки куба (`resetToken` проигрывателя): куб с
 * новым номером — новая сессия с пустой историей.
 *
 * Обработчики стабильны в пределах одного куба, и это требование, а не
 * оптимизация. `onRotateEnd` входит в зависимости `rotateSlice`: новый
 * обработчик — новый `rotateSlice`, новый ref куба, и проигрыватель поставил
 * бы стартовую позицию второй раз поверх первой.
 */
export function useTrySession(step: TryStep, generation: number, active: boolean): TrySessionView {
  const [session, dispatch] = useReducer(trySessionReducer, undefined, initialTrySession);
  const setupTurns = useMemo(() => setupTurnCount(parseSequence(step.setup)), [step.setup]);

  useEffect(() => {
    if (active) dispatch({ type: "reset", generation, setupTurns });
  }, [active, generation, setupTurns]);

  const handlers = useMemo<TryCubeHandlers | undefined>(
    () =>
      active
        ? {
            onMove: (move) => dispatch({ type: "move", generation, move }),
            onRotateEnd: () => {
              dispatch({ type: "rotation-end", generation });
              // Ход по этому повороту придёт микрозадачей; таймер — заведомо после неё.
              setTimeout(() => dispatch({ type: "check", generation }), 0);
            },
          }
        : undefined,
    [active, generation]
  );

  const current = active && session.generation === generation ? session : null;
  const history = current?.history;
  const assessment = useMemo(() => assessTry(step, history ?? []), [step, history]);

  return {
    handlers,
    assessment,
    desynced: current?.desynced ?? false,
    moveCount: history?.length ?? 0,
  };
}
