/**
 * Random-move scramble generator for the 3x3x3.
 *
 * Note this is not a WCA *competition* scrambler: those use random-state
 * scrambles (TNoodle) so every position is equally likely. Random moves are
 * the standard choice for practice, and follow the same notation and the same
 * two redundancy rules below.
 */

/** Opposite faces sit next to each other so `face >> 1` is the axis. */
const FACES = ["U", "D", "L", "R", "F", "B"] as const;
const MODIFIERS = ["", "'", "2"] as const;

const DEFAULT_LENGTH = 20;

const axisOf = (face: number) => face >> 1;

export function generateScramble(length: number = DEFAULT_LENGTH): string {
  if (!Number.isFinite(length) || length <= 0) return "";

  const scramble: string[] = [];
  let lastFace = -1;
  let secondLastFace = -1;

  for (let i = 0; i < Math.floor(length); i++) {
    let nextFace: number;
    do {
      nextFace = Math.floor(Math.random() * FACES.length);
    } while (
      // "R R'" — the same face twice in a row collapses into one move.
      nextFace === lastFace ||
      // "R L R" — the middle move commutes, so this is really "R R L".
      (axisOf(nextFace) === axisOf(lastFace) && nextFace === secondLastFace)
    );

    scramble.push(FACES[nextFace] + MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)]);
    secondLastFace = lastFace;
    lastFace = nextFace;
  }

  return scramble.join(" ");
}
