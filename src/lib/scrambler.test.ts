import { generateScramble } from "./scrambler";

describe("generateScramble", () => {
  it("should generate a scramble of requested length", () => {
    const scramble = generateScramble(20);
    const moves = scramble.split(" ");
    expect(moves.length).toBe(20);
  });

  it("should not contain moves on the same face consecutively", () => {
    for (let i = 0; i < 100; i++) {
      const scramble = generateScramble(25);
      const moves = scramble.split(" ");
      for (let j = 0; j < moves.length - 1; j++) {
        const face1 = moves[j][0];
        const face2 = moves[j + 1][0];
        expect(face1).not.toBe(face2);
      }
    }
  });

  it("should not contain R L R type patterns", () => {
    // A move should not be on the same axis as both of its two predecessors.
    const axisMap: Record<string, number> = {
      U: 0, D: 0,
      L: 1, R: 1,
      F: 2, B: 2,
    };

    for (let i = 0; i < 100; i++) {
      const scramble = generateScramble(25);
      const moves = scramble.split(" ");
      for (let j = 0; j < moves.length - 2; j++) {
        const axis1 = axisMap[moves[j][0]];
        const axis2 = axisMap[moves[j + 1][0]];
        const axis3 = axisMap[moves[j + 2][0]];
        
        // If they are on the same axis, it's invalid.
        // Actually, if axis1 == axis2, they must be opposite faces (since same face is forbidden).
        // Then axis3 cannot be the same axis.
        if (axis1 === axis2) {
          expect(axis3).not.toBe(axis1);
        }
      }
    }
  });

  it("should only contain valid WCA notation", () => {
    const scramble = generateScramble(20);
    const moves = scramble.split(" ");
    moves.forEach((move) => {
      expect(move).toMatch(/^[UDLRFB]['2]?$/);
    });
  });
});
