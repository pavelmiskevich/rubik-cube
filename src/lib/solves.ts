import { prisma } from "@/lib/prisma";
import type { SolveResult } from "@/lib/statistics";

export interface SolveRow {
  id: string;
  timeMs: number;
  isDNF: boolean;
  isPlusTwo: boolean;
}

export function toSolveResults(rows: SolveRow[]): SolveResult[] {
  return rows.map((row) => ({
    id: row.id,
    timeMs: row.timeMs,
    isDNF: row.isDNF,
    isPlusTwo: row.isPlusTwo,
  }));
}

/**
 * Последние сборки пользователя в хронологическом порядке — средние читают
 * окно с конца. Из базы берутся свежие, потому что интересен хвост, а не
 * начало истории; ограничение сверху не даёт вытащить всю таблицу разом.
 */
export async function getSolvesForUser(
  userId: string,
  limit = 200
): Promise<SolveResult[]> {
  try {
    const rows = await prisma.solve.findMany({
      where: { trainingSession: { userId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, timeMs: true, isDNF: true, isPlusTwo: true },
    });
    return toSolveResults(rows).reverse();
  } catch (error) {
    // База может быть недоступна. До этой задачи рабочий экран не обращался к
    // ней при отрисовке и работал всегда; ронять его пятисоткой из-за
    // недоступной истории — хуже, чем показать пустую историю. Тем же приёмом
    // уже сделан saveSolve: ошибка не проваливается молча, но и не валит экран.
    console.error("getSolvesForUser failed", error);
    return [];
  }
}
