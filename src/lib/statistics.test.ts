import { calculateAo5, calculateAo12, calculateAverage, DNF } from "./statistics";
import { formatSolveTime } from "./format";

const times = (...values: number[]) => values.map((timeMs) => ({ timeMs }));

describe("calculateAverage", () => {
  it("returns null until there are enough solves", () => {
    expect(calculateAo5(times(1000))).toBeNull();
    expect(calculateAo5(times(1, 2, 3, 4))).toBeNull();
    expect(calculateAo12(new Array(11).fill({ timeMs: 1000 }))).toBeNull();
  });

  it("returns null for a window too small to trim", () => {
    expect(calculateAverage(times(1000, 2000), 2)).toBeNull();
  });

  it("drops one best and one worst", () => {
    // 9k and 13k are trimmed; (10k + 11k + 12k) / 3
    expect(calculateAo5(times(10000, 12000, 11000, 13000, 9000))).toBe(11000);
  });

  it("uses only the last N solves", () => {
    const solves = times(60000, 60000, 10000, 12000, 11000, 13000, 9000);
    expect(calculateAo5(solves)).toBe(11000);
  });

  it("adds the +2 penalty before ranking", () => {
    // 9000 +2 counts as 11000, so it is neither the best nor the worst.
    const solves = [
      { timeMs: 10000 },
      { timeMs: 12000 },
      { timeMs: 9000, isPlusTwo: true },
      { timeMs: 13000 },
      { timeMs: 9000 },
    ];
    expect(calculateAo5(solves)).toBe(11000);
  });

  it("drops a single DNF as the worst result", () => {
    const solves = [
      { timeMs: 10000 },
      { timeMs: 12000 },
      { timeMs: 11000 },
      { timeMs: 9000, isDNF: true },
      { timeMs: 9000 },
    ];
    expect(calculateAo5(solves)).toBe(11000);
  });

  it("is a DNF once a second DNF counts", () => {
    const solves = [
      { timeMs: 10000 },
      { timeMs: 12000 },
      { timeMs: 11000, isDNF: true },
      { timeMs: 9000, isDNF: true },
      { timeMs: 9000 },
    ];
    expect(calculateAo5(solves)).toBe(DNF);
  });

  it("keeps the finite results in order even when several are DNF", () => {
    // Infinity - Infinity is NaN; a comparator returning it must not be able
    // to shuffle the real times out of place.
    const solves = [
      { timeMs: 8000 },
      { timeMs: 30000, isDNF: true },
      { timeMs: 9000 },
      { timeMs: 40000, isDNF: true },
      { timeMs: 10000 },
      { timeMs: 50000, isDNF: true },
      { timeMs: 11000 },
      { timeMs: 12000 },
      { timeMs: 13000 },
      { timeMs: 14000 },
      { timeMs: 15000 },
      { timeMs: 16000 },
    ];
    expect(calculateAo12(solves)).toBe(DNF);
  });

  it("rounds to the nearest centisecond, as WCA 9f2 requires", () => {
    // (10001 + 10002 + 10004) / 3 = 10002.33 -> 10000
    expect(calculateAo5(times(1, 10001, 10002, 10004, 99999))).toBe(10000);
    // (10005 + 10006 + 10007) / 3 = 10006 -> 10010
    expect(calculateAo5(times(1, 10005, 10006, 10007, 99999))).toBe(10010);
  });
});

describe("formatSolveTime", () => {
  it("formats sub-minute times as seconds", () => {
    expect(formatSolveTime(11000)).toBe("11.00");
    expect(formatSolveTime(9870)).toBe("9.87");
  });

  it("formats times over a minute with the minute component", () => {
    expect(formatSolveTime(75340)).toBe("1:15.34");
    expect(formatSolveTime(605000)).toBe("10:05.00");
  });

  it("renders DNF and missing values", () => {
    expect(formatSolveTime(DNF)).toBe("DNF");
    expect(formatSolveTime(null)).toBe("-");
  });
});
