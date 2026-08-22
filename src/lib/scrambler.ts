const FACES = ["U", "D", "L", "R", "F", "B"];
const MODIFIERS = ["", "'", "2"];

export function generateScramble(length: number = 20): string {
  const scramble: string[] = [];
  let lastFace = -1;
  let secondLastFace = -1;

  for (let i = 0; i < length; i++) {
    let nextFace;
    do {
      nextFace = Math.floor(Math.random() * 6);
    } while (
      nextFace === lastFace ||
      (Math.floor(nextFace / 2) === Math.floor(lastFace / 2) && nextFace === secondLastFace)
    );

    const mod = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
    scramble.push(FACES[nextFace] + mod);
    secondLastFace = lastFace;
    lastFace = nextFace;
  }

  return scramble.join(" ");
}
