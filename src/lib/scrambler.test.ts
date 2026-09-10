import { generateScramble } from "./scrambler";

const AXIS_OF: Record<string, number> = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };

describe("generateScramble", () => {
  it("generates the requested number of moves", () => {
    expect(generateScramble(20).split(" ")).toHaveLength(20);
    expect(generateScramble(7).split(" ")).toHaveLength(7);
    expect(generateScramble().split(" ")).toHaveLength(20);
  });

  it("returns an empty string for a non-positive or non-finite length", () => {
    expect(generateScramble(0)).toBe("");
    expect(generateScramble(-5)).toBe("");
    expect(generateScramble(Number.NaN)).toBe("");
  });

  it("only emits valid WCA notation", () => {
    generateScramble(50)
      .split(" ")
      .forEach((move) => expect(move).toMatch(/^[UDLRFB]['2]?$/));
  });

  it("never repeats a face back to back", () => {
    for (let run = 0; run < 100; run++) {
      const moves = generateScramble(25).split(" ");
      for (let i = 0; i < moves.length - 1; i++) {
        expect(moves[i][0]).not.toBe(moves[i + 1][0]);
      }
    }
  });

  it("never puts three consecutive moves on one axis", () => {
    // "R L R" is redundant: L commutes with both, so it is really "R R L".
    for (let run = 0; run < 100; run++) {
      const moves = generateScramble(25).split(" ");
      for (let i = 0; i < moves.length - 2; i++) {
        const axes = moves.slice(i, i + 3).map((move) => AXIS_OF[move[0]]);
        expect(axes[0] === axes[1] && axes[1] === axes[2]).toBe(false);
      }
    }
  });

  it("uses every face and every modifier over enough moves", () => {
    const moves = generateScramble(600).split(" ");
    const faces = new Set(moves.map((move) => move[0]));
    const modifiers = new Set(moves.map((move) => move.slice(1)));

    expect(faces).toEqual(new Set(["U", "D", "L", "R", "F", "B"]));
    expect(modifiers).toEqual(new Set(["", "'", "2"]));
  });
});
