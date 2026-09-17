import { DNF } from "./statistics";

/**
 * Speedcubing time formatting: `12.34` under a minute, `1:23.45` above it.
 * Milliseconds are truncated to centiseconds, the resolution the WCA uses.
 */
export function formatSolveTime(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "-";
  if (ms === DNF) return "DNF";

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  const fraction = centiseconds.toString().padStart(2, "0");

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${fraction}`;
  }
  return `${seconds}.${fraction}`;
}

/**
 * Сколько сборок не хватает до среднего. Не прочерк: прочерк ничего не
 * объясняет, а человек должен видеть, сколько осталось.
 */
export function averageHint(count: number, needed: number): string | null {
  if (count >= needed) return null;
  return `ещё ${needed - count} до Ao${needed}`;
}
