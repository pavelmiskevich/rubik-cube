import type { SolveResult } from "@/lib/statistics";

export type TimerState = "IDLE" | "READY" | "RUNNING" | "STOPPED";

export interface WorkspaceState {
  /** Хронологический порядок: средние читают окно с конца. */
  solves: SolveResult[];
  /** Меняется — ScrambleDisplay выдаёт новый скрамбл. */
  refreshToken: number;
  /** Во время замера обвязка гаснет. */
  focused: boolean;
}

export type WorkspaceEvent =
  | { type: "timer-state"; state: TimerState }
  | { type: "solve"; timeMs: number };

export function initialWorkspaceState(solves: SolveResult[]): WorkspaceState {
  return { solves, refreshToken: 0, focused: false };
}

/**
 * Переходы состояния рабочего экрана. Вынесено из компонента, чтобы правила —
 * когда гаснет обвязка и когда выдаётся новый скрамбл — проверялись тестом,
 * а не глазами.
 */
export function workspaceReducer(
  state: WorkspaceState,
  event: WorkspaceEvent
): WorkspaceState {
  switch (event.type) {
    case "timer-state":
      return {
        ...state,
        focused: event.state === "RUNNING",
        // Новый скрамбл ровно один раз на остановку: иначе легко собрать один
        // и тот же скрамбл дважды подряд.
        refreshToken:
          event.state === "STOPPED" ? state.refreshToken + 1 : state.refreshToken,
      };
    case "solve":
      return { ...state, solves: [...state.solves, { timeMs: event.timeMs }] };
  }
}
