import { CubeState } from "@/lib/cube/state";
import { parseSequence } from "@/lib/cube/moves";
import { isSolved } from "@/lib/cube/predicates";
import { solve } from "@/lib/cube/solver";

/*
  Что экран показывает вместо решения.

  Решатель отдаёт шаги курса, а экрану нужно на пару вещей больше: сколько в
  шаге ходов и куда вести человека, который захотел перечитать урок. Всё это
  считается здесь, чтобы разметка осталась разметкой, а проверять было что.
*/

export interface SolutionLine {
  lessonSlug: string;
  title: string;
  moves: string;
  /** Ходов в шаге — их считает движок, а не пробелы в строке. */
  count: number;
  /** Урок, который объясняет шаг. */
  href: string;
}

export type Solution =
  /** Собирать нечего. */
  | { kind: "solved" }
  | { kind: "steps"; steps: readonly SolutionLine[]; total: number }
  /**
   * Положение, которого у настоящего кубика не бывает.
   *
   * Досюда оно дойти не должно: раскраску проверяет `checkFacelets`, и решатель
   * получает только принятое ей положение. Но проверок две, написаны они
   * порознь, и если они когда-нибудь разойдутся, человек увидит фразу, а не
   * пустой экран.
   */
  | { kind: "failed" };

export function solutionFor(state: CubeState): Solution {
  if (isSolved(state)) return { kind: "solved" };

  let steps;
  try {
    steps = solve(state);
  } catch {
    return { kind: "failed" };
  }

  const lines = steps.map((step) => ({
    ...step,
    count: parseSequence(step.moves).length,
    href: `/learn/${step.lessonSlug}`,
  }));

  return {
    kind: "steps",
    steps: lines,
    total: lines.reduce((sum, line) => sum + line.count, 0),
  };
}

export function moveCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} ходов`;
  if (last === 1) return `${count} ход`;
  if (last >= 2 && last <= 4) return `${count} хода`;
  return `${count} ходов`;
}
