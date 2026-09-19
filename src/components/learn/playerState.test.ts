import {
  initialPlayerState,
  isFinished,
  playerReducer,
  type PlayerState,
} from "./playerState";

const start = (totalMoves = 4): PlayerState => initialPlayerState(totalMoves);

const run = (state: PlayerState, ...events: Parameters<typeof playerReducer>[1][]): PlayerState =>
  events.reduce(playerReducer, state);

describe("состояние проигрывателя урока", () => {
  it("начинается на первом шаге, на нулевом ходу и на паузе", () => {
    expect(start()).toEqual({
      stepIndex: 0,
      moveIndex: 0,
      totalMoves: 4,
      playing: false,
      speed: 1,
      resetToken: 0,
    });
  });

  it("идёт вперёд по одному ходу", () => {
    const state = run(start(), { type: "forward" }, { type: "forward" });
    expect(state.moveIndex).toBe(2);
  });

  it("останавливается на последнем ходу и дальше не уезжает", () => {
    let state = start(2);
    for (let i = 0; i < 5; i++) state = playerReducer(state, { type: "forward" });

    expect(state.moveIndex).toBe(2);
    expect(isFinished(state)).toBe(true);
  });

  it("само снимает проигрывание, когда ходы кончились", () => {
    const state = run(start(1), { type: "play" }, { type: "forward" }, { type: "forward" });
    expect(state.playing).toBe(false);
  });

  it("возвращает ровно на один ход назад", () => {
    const forward = run(start(), { type: "forward" }, { type: "forward" });
    const back = playerReducer(forward, { type: "back" });

    expect(back.moveIndex).toBe(forward.moveIndex - 1);
  });

  it("не уходит назад за начало алгоритма", () => {
    const state = run(start(), { type: "back" }, { type: "back" });
    expect(state.moveIndex).toBe(0);
  });

  it("снимает проигрывание на шаге назад: это действие руками", () => {
    const state = run(start(), { type: "forward" }, { type: "play" }, { type: "back" });
    expect(state.playing).toBe(false);
  });

  it("шаг вперёд и сразу назад возвращает ровно то же состояние", () => {
    const before = run(start(), { type: "forward" });
    const after = run(before, { type: "forward" }, { type: "back" });

    expect(after).toEqual(before);
  });
});

describe("повтор", () => {
  it("отправляет на начало шага и просит пересобрать куб", () => {
    const played = run(start(), { type: "forward" }, { type: "forward" }, { type: "play" });
    const again = playerReducer(played, { type: "restart" });

    expect(again.moveIndex).toBe(0);
    expect(again.playing).toBe(false);
    expect(again.resetToken).toBe(played.resetToken + 1);
  });

  it("не накапливает рассинхрон: каждый повтор это новая пересборка", () => {
    // Куб всегда строится заново из собранного состояния и стартовой
    // последовательности, поэтому сколько бы раз ни нажали повтор, ход всегда
    // нулевой, а не «почти нулевой».
    let state = start();
    for (let run = 0; run < 10; run++) {
      state = playerReducer(state, { type: "forward" });
      state = playerReducer(state, { type: "restart" });
      expect(state.moveIndex).toBe(0);
    }

    expect(state.resetToken).toBe(10);
  });

  it("нажатие «играть» в конце начинает шаг заново", () => {
    const finished = run(start(1), { type: "forward" });
    const again = playerReducer(finished, { type: "play" });

    expect(isFinished(finished)).toBe(true);
    expect(again.moveIndex).toBe(0);
    expect(again.playing).toBe(true);
    expect(again.resetToken).toBe(finished.resetToken + 1);
  });
});

describe("переключение шагов и скорости", () => {
  it("открывает выбранный шаг с начала и с пересборкой", () => {
    const played = run(start(), { type: "forward" }, { type: "play" });
    const next = playerReducer(played, { type: "select-step", stepIndex: 2, totalMoves: 7 });

    expect(next.stepIndex).toBe(2);
    expect(next.totalMoves).toBe(7);
    expect(next.moveIndex).toBe(0);
    expect(next.playing).toBe(false);
    expect(next.resetToken).toBe(played.resetToken + 1);
  });

  it("меняет скорость, не трогая позицию и проигрывание", () => {
    const playing = run(start(), { type: "forward" }, { type: "play" });
    const faster = playerReducer(playing, { type: "speed", speed: 2 });

    expect(faster.speed).toBe(2);
    expect(faster.moveIndex).toBe(playing.moveIndex);
    expect(faster.playing).toBe(true);
  });

  it("считает шаг законченным только когда в нём есть ходы", () => {
    expect(isFinished(initialPlayerState(0))).toBe(false);
  });
});
