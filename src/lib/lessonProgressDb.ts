import { prisma } from "@/lib/prisma";
import {
  COURSE_SHAPES,
  sanitizeProgressMap,
  type ProgressMap,
} from "@/lib/lessonProgress";

/**
 * Прогресс вошедшего пользователя по всем урокам.
 *
 * Лежит отдельно от серверного действия намеренно: всё, что экспортирует файл
 * с "use server", становится публичной точкой входа, а эта функция принимает
 * идентификатор пользователя аргументом. Звать её можно только с сервера и
 * только с идентификатором из сессии.
 */
export async function getLessonProgressForUser(userId: string): Promise<ProgressMap> {
  try {
    const rows = await prisma.lessonProgress.findMany({
      where: { userId },
      select: { lessonSlug: true, stepIndex: true, completed: true },
    });
    // Через ту же проверку, что и localStorage: строки уроков, убранных из
    // курса, выпадают, шаг за пределами укороченного урока прижимается.
    const raw = Object.fromEntries(
      rows.map((row) => [row.lessonSlug, { stepIndex: row.stepIndex, completed: row.completed }])
    );
    return sanitizeProgressMap(raw, COURSE_SHAPES);
  } catch (error) {
    // Как getSolvesForUser: недоступная база не должна ронять урок. Курс
    // продолжает работать, просто не помнит, где человек остановился.
    console.error("getLessonProgressForUser failed", error);
    return {};
  }
}
