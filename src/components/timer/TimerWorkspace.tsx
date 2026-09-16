"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import ScrambleDisplay from "./ScrambleDisplay";
import SmartTimer from "./SmartTimer";
import {
  initialWorkspaceState,
  workspaceReducer,
  type TimerState,
} from "./workspaceState";
import Badge from "@/components/ui/Badge";
import Stat from "@/components/ui/Stat";
import { formatSolveTime } from "@/lib/format";
import { calculateAo5, calculateAo12, effectiveTime } from "@/lib/statistics";

interface TimerWorkspaceProps {
  canSave: boolean;
}

/**
 * Весь цикл тренировки на одной странице: скрамбл сверху, таймер в центре,
 * живые средние и последние сборки под ним. Правила переходов живут в
 * workspaceState.ts и покрыты тестами; здесь остаётся только отрисовка.
 */
export default function TimerWorkspace({ canSave }: TimerWorkspaceProps) {
  const [scramble, setScramble] = useState("");
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState([]));

  const handleStateChange = useCallback((timerState: TimerState) => {
    // saveSolve читает свой scrambleRef синхронно, ещё до того как это
    // обновление доедет до перерисовки, поэтому сборка записывается со своим
    // скрамблом, а не со следующим.
    dispatch({ type: "timer-state", state: timerState });
  }, []);

  const handleSolve = useCallback((timeMs: number) => {
    dispatch({ type: "solve", timeMs });
  }, []);

  // Во время замера на экране не остаётся ничего, кроме цифр.
  useEffect(() => {
    document.documentElement.dataset.focus = state.focused ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.focus;
    };
  }, [state.focused]);

  const solves = state.solves;
  const recent = solves.map((solve, index) => ({ solve, number: index + 1 })).reverse();

  return (
    <div className="space-y-8">
      <ScrambleDisplay onChange={setScramble} refreshToken={state.refreshToken} />

      <SmartTimer
        scramble={scramble}
        canSave={canSave}
        onStateChange={handleStateChange}
        onSolve={handleSolve}
      />

      <div data-chrome className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Ao5" value={formatSolveTime(calculateAo5(solves))} testId="ao5" />
          <Stat label="Ao12" value={formatSolveTime(calculateAo12(solves))} testId="ao12" />
        </div>

        {recent.length > 0 && (
          <div className="rounded-card border bg-surface">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">
              Последние сборки
            </h2>
            <ul data-testid="solve-list">
              {recent.map(({ solve, number }) => (
                <li
                  key={solve.id ?? number}
                  className="flex items-center justify-between border-b px-4 py-2 last:border-b-0"
                >
                  <span className="text-sm text-muted">Сборка №{number}</span>
                  <span className="flex items-center gap-2 font-mono tabular-nums">
                    <span className={solve.isDNF ? "text-danger" : undefined}>
                      {formatSolveTime(effectiveTime(solve))}
                    </span>
                    {!solve.isDNF && solve.isPlusTwo && <Badge tone="warning">+2</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
