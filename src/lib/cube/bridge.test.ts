import { resolveDragRotation } from "../../components/cube/dragRotation";
import { MOVES, Move, formatMove, parseMove, parseSequence } from "./moves";
import { SliceTurn, moveForSliceTurn, playSequence, sliceTurnsForMove } from "./bridge";

const turnsOf = (notation: string): SliceTurn[] => sliceTurnsForMove(parseMove(notation));
const onlyTurn = (notation: string): SliceTurn => {
  const turns = turnsOf(notation);
  expect(turns).toHaveLength(1);
  return turns[0];
};

describe("sliceTurnsForMove", () => {
  /**
   * The whole table, written out rather than derived: a test that recomputes
   * the rule it is checking would agree with a wrong rule just as happily.
   *
   * Clockwise is seen from outside the face, so the three faces on the
   * negative end of their axis turn the other way round the positive axis.
   */
  it.each([
    ["U", "y", 1, -1],
    ["D", "y", -1, 1],
    ["L", "x", -1, 1],
    ["R", "x", 1, -1],
    ["F", "z", 1, -1],
    ["B", "z", -1, 1],
  ])("sends %s to the %s slice at %i turning %i", (notation, axis, index, direction) => {
    expect(onlyTurn(notation)).toEqual({ axis, index, direction });
  });

  it("flips only the direction for a prime turn", () => {
    MOVES.filter((move) => move.turn === 1).forEach((move) => {
      const clockwise = onlyTurn(formatMove(move));
      const prime = onlyTurn(`${move.face}'`);

      expect(prime.axis).toBe(clockwise.axis);
      expect(prime.index).toBe(clockwise.index);
      expect(prime.direction).toBe(-clockwise.direction);
    });
  });

  it("plays a half turn as two identical quarter turns", () => {
    MOVES.filter((move) => move.turn === 2).forEach((move) => {
      const turns = sliceTurnsForMove(move);
      const clockwise = onlyTurn(move.face);

      expect(turns).toHaveLength(2);
      expect(turns[0]).toEqual(clockwise);
      expect(turns[1]).toEqual(clockwise);
    });
  });

  it("covers all 18 moves", () => {
    expect(MOVES).toHaveLength(18);
    MOVES.forEach((move) => {
      const turns = sliceTurnsForMove(move);
      expect(turns.length).toBe(move.turn === 2 ? 2 : 1);
      turns.forEach((turn) => {
        expect(["x", "y", "z"]).toContain(turn.axis);
        expect([-1, 1]).toContain(turn.index);
        expect([-1, 1]).toContain(turn.direction);
      });
    });
  });
});

describe("the quarter turns are told apart", () => {
  it("gives the twelve quarter moves twelve different slice turns", () => {
    const quarters = MOVES.filter((move) => move.turn !== 2);
    const keys = quarters.map((move) => {
      const turn = onlyTurn(formatMove(move));
      return `${turn.axis}${turn.index}${turn.direction}`;
    });

    expect(quarters).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
  });

  it("round-trips every quarter move through the bridge and back", () => {
    MOVES.filter((move) => move.turn !== 2).forEach((move) => {
      expect(moveForSliceTurn(onlyTurn(formatMove(move)))).toEqual(move);
    });
  });

  it("reads each half of a half turn as the clockwise move", () => {
    MOVES.filter((move) => move.turn === 2).forEach((move) => {
      sliceTurnsForMove(move).forEach((turn) => {
        expect(moveForSliceTurn(turn)).toEqual({ face: move.face, turn: 1 });
      });
    });
  });
});

describe("moveForSliceTurn", () => {
  it("stays silent about the middle slice, which is no face turn at all", () => {
    expect(moveForSliceTurn({ axis: "y", index: 0, direction: 1 })).toBeNull();
    expect(moveForSliceTurn({ axis: "x", index: 0, direction: -1 })).toBeNull();
    expect(moveForSliceTurn({ axis: "z", index: 0, direction: 1 })).toBeNull();
  });

  it("stays silent about a rotation that is not a quarter turn", () => {
    expect(moveForSliceTurn({ axis: "y", index: 1, direction: 0 })).toBeNull();
    expect(moveForSliceTurn({ axis: "y", index: 1, direction: 2 })).toBeNull();
  });
});

/**
 * The sign convention checked against the code that actually turns gestures
 * into rotations, instead of against the reasoning in the comment above it.
 *
 * `resolveDragRotation` takes the outward normal of the grabbed face, the drag
 * across it and the centre of the grabbed cubie, all in scene coordinates:
 * x right, y up, z towards the viewer.
 */
describe("agrees with the gesture code", () => {
  const drag = (
    normal: [number, number, number],
    vector: [number, number, number],
    center: [number, number, number]
  ): Move | null => {
    const asVec = ([x, y, z]: [number, number, number]) => ({ x, y, z });
    const rotation = resolveDragRotation(asVec(normal), asVec(vector), asVec(center));

    expect(rotation).not.toBeNull();
    return moveForSliceTurn(rotation!);
  };

  it("reads a drag to the right across the front of the top layer as U prime", () => {
    // The top layer swings to the right, which from above is anticlockwise.
    expect(drag([0, 0, 1], [1, 0, 0], [0, 1, 1])).toEqual(parseMove("U'"));
  });

  it("reads the same drag to the left as U", () => {
    expect(drag([0, 0, 1], [-1, 0, 0], [0, 1, 1])).toEqual(parseMove("U"));
  });

  it("reads a drag towards the viewer across the right of the top layer as U", () => {
    // The right face swings to the front: seen from above, clockwise.
    expect(drag([1, 0, 0], [0, 0, 1], [1, 1, 0])).toEqual(parseMove("U"));
  });

  it("reads the mirrored drag across the bottom layer as D, sign and all", () => {
    // Same drag direction as the U prime case, one layer down. D is seen from
    // below, so the direction that read as anticlockwise up there reads as
    // clockwise down here — the case where a hand-written table slips.
    expect(drag([0, 0, 1], [1, 0, 0], [0, -1, 1])).toEqual(parseMove("D"));
  });

  it("says nothing about a drag that turns the middle slice", () => {
    expect(drag([0, 0, 1], [1, 0, 0], [1, 0, 1])).toBeNull();
  });
});

describe("playSequence", () => {
  it("waits for each turn before starting the next", async () => {
    const order: string[] = [];
    let running = 0;

    const rotate = (axis: string, index: number, direction: number) =>
      new Promise<void>((resolve) => {
        running += 1;
        expect(running).toBe(1);
        order.push(`${axis}${index}${direction}`);
        setTimeout(() => {
          running -= 1;
          resolve();
        }, 1);
      });

    await playSequence(rotate, parseSequence("R U2 F'"));

    expect(order).toEqual(["x1-1", "y1-1", "y1-1", "z11"]);
    expect(running).toBe(0);
  });

  it("does nothing at all for an empty sequence", async () => {
    const rotate = jest.fn(() => Promise.resolve());

    await playSequence(rotate, parseSequence(""));

    expect(rotate).not.toHaveBeenCalled();
  });

  it("passes the duration through to every turn", async () => {
    const rotate = jest.fn(() => Promise.resolve());

    await playSequence(rotate, parseSequence("R2"), 40);

    expect(rotate).toHaveBeenCalledTimes(2);
    expect(rotate).toHaveBeenLastCalledWith("x", 1, -1, 40);
  });
});
