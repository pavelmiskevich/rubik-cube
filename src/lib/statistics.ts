export interface SolveResult {
  id?: string;
  timeMs: number;
  isDNF?: boolean;
  isPlusTwo?: boolean;
}

/** A DNF has no time, so it sorts above every real result and never survives the trim twice. */
export const DNF = Number.POSITIVE_INFINITY;

const PLUS_TWO_PENALTY_MS = 2000;

/** WCA 9f2: averages are rounded to the nearest 0.01 s. */
const AVERAGE_PRECISION_MS = 10;

/** Result of a solve in milliseconds, penalties applied, or DNF. */
export function effectiveTime(solve: SolveResult): number {
  if (solve.isDNF) return DNF;
  return solve.timeMs + (solve.isPlusTwo ? PLUS_TWO_PENALTY_MS : 0);
}

/**
 * WCA average of the last `averageOf` solves: drop the single best and the
 * single worst, then take the mean of the rest.
 *
 * `solves` must be in chronological order — the window is taken from the end.
 * Returns null when there are not enough solves yet, and DNF (Infinity) when
 * more than one of the counting solves is a DNF.
 */
export function calculateAverage(solves: SolveResult[], averageOf: number): number | null {
  if (averageOf < 3 || solves.length < averageOf) {
    return null;
  }

  const times = solves.slice(-averageOf).map(effectiveTime);

  // Infinity - Infinity is NaN, so the usual (a - b) comparator is undefined
  // for two DNFs. Compare by ordering instead.
  times.sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));

  const counting = times.slice(1, -1);
  if (counting.includes(DNF)) {
    return DNF;
  }

  const mean = counting.reduce((sum, time) => sum + time, 0) / counting.length;
  return Math.round(mean / AVERAGE_PRECISION_MS) * AVERAGE_PRECISION_MS;
}

export function calculateAo5(solves: SolveResult[]): number | null {
  return calculateAverage(solves, 5);
}

export function calculateAo12(solves: SolveResult[]): number | null {
  return calculateAverage(solves, 12);
}
