import { calculateAo5, calculateAo12 } from "./statistics";

describe("Statistics Calculator", () => {
  it("should return null if not enough solves", () => {
    expect(calculateAo5([{ timeMs: 1000 }])).toBeNull();
    expect(calculateAo12(new Array(11).fill({ timeMs: 1000 }))).toBeNull();
  });

  it("should calculate correct Ao5", () => {
    const solves = [
      { timeMs: 10000 },
      { timeMs: 12000 },
      { timeMs: 11000 },
      { timeMs: 13000 },
      { timeMs: 9000 },
    ];
    // Sorted: 9k, 10k, 11k, 12k, 13k
    // Trimmed: 10k, 11k, 12k
    // Avg: 11000
    expect(calculateAo5(solves)).toBe(11000);
  });

  it("should handle +2 properly", () => {
    const solves = [
      { timeMs: 10000 },
      { timeMs: 12000 },
      { timeMs: 9000, isPlusTwo: true }, // acts as 11000
      { timeMs: 13000 },
      { timeMs: 9000 }, // best, dropped
    ];
    // Actuals: 10k, 12k, 11k, 13k (dropped), 9k (dropped)
    // Trimmed: 10k, 11k, 12k -> avg 11000
    expect(calculateAo5(solves)).toBe(11000);
  });

  it("should drop one DNF and calculate average", () => {
    const solves = [
      { timeMs: 10000 },
      { timeMs: 12000 },
      { timeMs: 11000 },
      { timeMs: 9000, isDNF: true }, // worst, dropped
      { timeMs: 9000 }, // best, dropped
    ];
    // Trimmed: 10k, 11k, 12k -> avg 11000
    expect(calculateAo5(solves)).toBe(11000);
  });

  it("should return Infinity if there are two DNFs", () => {
    const solves = [
      { timeMs: 10000 },
      { timeMs: 12000 },
      { timeMs: 11000, isDNF: true }, // included -> Infinity
      { timeMs: 9000, isDNF: true },  // worst, dropped
      { timeMs: 9000 }, // best, dropped
    ];
    expect(calculateAo5(solves)).toBe(Infinity);
  });
});
