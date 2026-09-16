import {
  initialWorkspaceState,
  workspaceReducer,
  type WorkspaceState,
} from "./workspaceState";

const start = (): WorkspaceState => initialWorkspaceState([]);

describe("состояние рабочего экрана", () => {
  it("начинается без сборок, с погашенным фокусом", () => {
    expect(start()).toEqual({ solves: [], refreshToken: 0, focused: false });
  });

  it("сохраняет переданную историю сборок", () => {
    const solves = [{ id: "a", timeMs: 12450 }];
    expect(initialWorkspaceState(solves).solves).toEqual(solves);
  });

  it("включает фокус на старте замера", () => {
    const next = workspaceReducer(start(), { type: "timer-state", state: "RUNNING" });
    expect(next.focused).toBe(true);
  });

  it("гасит фокус на остановке и просит новый скрамбл", () => {
    const next = workspaceReducer(start(), { type: "timer-state", state: "STOPPED" });
    expect(next.focused).toBe(false);
    expect(next.refreshToken).toBe(1);
  });

  it("не просит новый скрамбл, пока сборка не закончилась", () => {
    const ready = workspaceReducer(start(), { type: "timer-state", state: "READY" });
    const running = workspaceReducer(ready, { type: "timer-state", state: "RUNNING" });
    expect(running.refreshToken).toBe(0);
  });

  it("выдаёт ровно один новый скрамбл на каждую остановку", () => {
    let state = start();
    for (let i = 0; i < 3; i++) {
      state = workspaceReducer(state, { type: "timer-state", state: "RUNNING" });
      state = workspaceReducer(state, { type: "timer-state", state: "STOPPED" });
    }
    expect(state.refreshToken).toBe(3);
  });

  it("дописывает сборку в конец — средние читают окно с конца", () => {
    const first = workspaceReducer(start(), { type: "solve", timeMs: 12450 });
    const second = workspaceReducer(first, { type: "solve", timeMs: 9800 });
    expect(second.solves.map((solve) => solve.timeMs)).toEqual([12450, 9800]);
  });

  it("сборка не трогает ни фокус, ни счётчик скрамбла", () => {
    const next = workspaceReducer(start(), { type: "solve", timeMs: 9800 });
    expect(next.refreshToken).toBe(0);
    expect(next.focused).toBe(false);
  });

  it("не меняет переданное состояние на месте", () => {
    const state = Object.freeze(start());
    expect(() => workspaceReducer(state, { type: "solve", timeMs: 9800 })).not.toThrow();
    expect(state.solves).toHaveLength(0);
  });
});
