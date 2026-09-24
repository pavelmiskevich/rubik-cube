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

export interface SolveFilter {
  /**
   * Только сборки этого урока. Без него — все сборки, и свободные, и с
   * уроков: старые сборки, записанные до появления поля, остаются здесь.
   */
  lessonSlug?: string;
}

/**
 * Последние сборки пользователя в хронологическом порядке — средние читают
 * окно с конца. Из базы берутся свежие, потому что интересен хвост, а не
 * начало истории; ограничение сверху не даёт вытащить всю таблицу разом.
 */
export async function getSolvesForUser(
  userId: string,
  filter: SolveFilter = {},
  limit = 200
): Promise<SolveResult[]> {
  try {
    const rows = await prisma.solve.findMany({
      where: {
        trainingSession: { userId },
        ...(filter.lessonSlug === undefined ? {} : { lessonSlug: filter.lessonSlug }),
      },
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

/**
 * Уроки, по которым у пользователя есть сборки, — каждый один раз, в любом
 * порядке. Порядок и отсев уроков, которых нет в курсе, — забота
 * statsLessonOptions: здесь только то, что лежит в базе.
 */
export async function getSolveLessonSlugsForUser(userId: string): Promise<string[]> {
  try {
    // groupBy, а не findMany с distinct: distinct Prisma выполняет в памяти,
    // и в базу ушёл бы запрос всех размеченных сборок человека — с годами
    // тренировок это десятки тысяч строк ради пары названий. groupBy
    // превращается в GROUP BY и возвращает по строке на урок.
    const rows = await prisma.solve.groupBy({
      by: ["lessonSlug"],
      where: { trainingSession: { userId }, lessonSlug: { not: null } },
    });
    return rows.flatMap((row) => (row.lessonSlug === null ? [] : [row.lessonSlug]));
  } catch (error) {
    // Как getSolvesForUser: без выбора урока статистика по всем сборкам всё
    // равно нужна.
    console.error("getSolveLessonSlugsForUser failed", error);
    return [];
  }
}
