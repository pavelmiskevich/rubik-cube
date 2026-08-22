export interface SolveResult {
  timeMs: number;
  isDNF?: boolean;
  isPlusTwo?: boolean;
}

export function calculateAverage(solves: SolveResult[], averageOf: number): number | null {
  if (solves.length < averageOf) {
    return null;
  }

  // Take the last `averageOf` solves
  const recentSolves = solves.slice(-averageOf);

  // Map to actual times (DNF = Infinity)
  const times = recentSolves.map((solve) => {
    if (solve.isDNF) return Infinity;
    return solve.timeMs + (solve.isPlusTwo ? 2000 : 0);
  });

  // Sort ascending
  times.sort((a, b) => a - b);

  // Determine how many to trim (WCA rules: 5% best and worst rounded up. For 5 and 12, it's 1 best and 1 worst).
  // Actually, WCA Regulations 9f2: "for 'Average of 5' rounds, the best and worst results are dropped".
  // "for 'Average of 12' rounds, the best and worst results are dropped".
  // This means exactly 1 best and 1 worst.
  
  const trimmed = times.slice(1, -1);
  
  // If any of the remaining solves is Infinity (DNF), the average is DNF.
  if (trimmed.includes(Infinity)) {
    return Infinity;
  }

  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

export function calculateAo5(solves: SolveResult[]): number | null {
  return calculateAverage(solves, 5);
}

export function calculateAo12(solves: SolveResult[]): number | null {
  return calculateAverage(solves, 12);
}
