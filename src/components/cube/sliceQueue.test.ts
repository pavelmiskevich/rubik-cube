import { SliceQueue } from "./sliceQueue";

/** Поворот, который доигрывает, когда тест скажет. */
function heldTurn(log: string[], name: string) {
  let finish: (() => void) | null = null;
  return {
    start: (done: () => void) => {
      log.push(`start ${name}`);
      finish = done;
    },
    finish: () => finish!(),
  };
}

/** Состояние обещания после того, как отработали все микрозадачи. */
async function stateOf(promise: Promise<void>): Promise<"settled" | "pending"> {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return settled ? "settled" : "pending";
}

describe("SliceQueue", () => {
  it("повороты идут по одному: следующий начинается, когда доигран предыдущий", async () => {
    const queue = new SliceQueue();
    const log: string[] = [];
    const a = heldTurn(log, "a");
    const b = heldTurn(log, "b");

    const first = queue.run(a.start);
    const second = queue.run(b.start);
    expect(log).toEqual(["start a"]);
    expect(queue.busy).toBe(true);

    a.finish();
    expect(await stateOf(first)).toBe("settled");
    expect(log).toEqual(["start a", "start b"]);

    b.finish();
    expect(await stateOf(second)).toBe("settled");
    expect(queue.busy).toBe(false);
  });

  it("закрытие разрешает текущий поворот, а не только ждущие (#139)", async () => {
    const queue = new SliceQueue();
    const log: string[] = [];
    const active = heldTurn(log, "active");

    const inFlight = queue.run(active.start);
    const queued = queue.run(heldTurn(log, "queued").start);
    expect(await stateOf(inFlight)).toBe("pending");

    queue.close();

    expect(await stateOf(inFlight)).toBe("settled");
    expect(await stateOf(queued)).toBe("settled");
    // Ждущий после закрытия не начинается: куба уже нет.
    expect(log).toEqual(["start active"]);
    expect(queue.busy).toBe(false);
  });

  it("доигравшая после закрытия анимация ничего не запускает", async () => {
    const queue = new SliceQueue();
    const log: string[] = [];
    const active = heldTurn(log, "active");

    void queue.run(active.start);
    void queue.run(heldTurn(log, "queued").start);
    queue.close();
    active.finish();

    expect(log).toEqual(["start active"]);
  });

  it("в закрытой очереди поворот разрешается сразу и не начинается", async () => {
    const queue = new SliceQueue();
    const log: string[] = [];
    queue.close();

    const late = queue.run(heldTurn(log, "late").start);

    expect(await stateOf(late)).toBe("settled");
    expect(log).toEqual([]);
  });

  it("после повторного открытия очередь снова работает", async () => {
    const queue = new SliceQueue();
    const log: string[] = [];
    queue.close();
    queue.open();

    const turn = heldTurn(log, "again");
    const promise = queue.run(turn.start);
    expect(log).toEqual(["start again"]);
    turn.finish();
    expect(await stateOf(promise)).toBe("settled");
  });

  it("поворот, которому нечего крутить, разрешается сразу и пускает следующий", async () => {
    const queue = new SliceQueue();
    const log: string[] = [];
    const held = heldTurn(log, "a");

    void queue.run(held.start);
    const empty = queue.run((done) => {
      log.push("start empty");
      done();
    });
    const after = heldTurn(log, "after");
    void queue.run(after.start);

    held.finish();
    expect(await stateOf(empty)).toBe("settled");
    expect(log).toEqual(["start a", "start empty", "start after"]);
  });

  it("повторный вызов finish безвреден", async () => {
    const queue = new SliceQueue();
    const log: string[] = [];
    let finish: () => void = () => {};
    void queue.run((done) => {
      finish = done;
    });
    void queue.run(heldTurn(log, "b").start);
    void queue.run(heldTurn(log, "c").start);

    finish();
    finish();

    expect(log).toEqual(["start b"]);
  });
});
