import { formatSequence } from "@/lib/cube/moves";
import { solveShort } from "@/lib/cube/shortSolver";
import { tablesReady } from "@/lib/cube/shortSolverTables";
import { ShortSolveRequest, ShortSolveResponse } from "./shortSolution";

/*
  Ответ фонового потока на запрос экрана. Отдельно от `shortSolution.ts`, чтобы
  код поиска попадал только в бандл потока, а не в бандл страницы.
*/

export function answerShortSolve(
  request: ShortSolveRequest,
  now: () => number = () => performance.now()
): ShortSolveResponse {
  const builtTables = !tablesReady();
  const start = now();
  try {
    const moves = solveShort(request.state);
    return {
      id: request.id,
      kind: "moves",
      moves: formatSequence(moves),
      count: moves.length,
      ms: now() - start,
      builtTables,
    };
  } catch {
    return { id: request.id, kind: "failed" };
  }
}
