"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { solveLessonSlug } from "@/lib/practiceLesson";
import { rateLimit } from "@/lib/rate-limit";
import { SOLVE_BURST, SOLVE_HOURLY, maxSolvesPerUser, tooFrequent } from "@/lib/saveLimits";

const DEFAULT_SESSION_NAME = "Main 3x3";

/** A solve longer than an hour is a forgotten running timer, not a result. */
const MAX_SOLVE_MS = 60 * 60 * 1000;
const MAX_SCRAMBLE_LENGTH = 256;

export type SaveSolveResult = { success: true } | { success: false; error: string };

/**
 * Сохраняет сборку вошедшего человека.
 *
 * `lessonSlug` — урок, с которого открыт таймер (`/timer?lesson=`). Адрес
 * пишет кто угодно, поэтому урок проверяется тем же правилом, по которому
 * таймер показывает «Сейчас тренируете»: незнакомый или нетренируемый урок —
 * свободная сборка, а не отказ. Потерять замер из-за подложенного адреса хуже,
 * чем записать его без отметки.
 */
export async function saveSolve(
  timeMs: number,
  scramble: string = "",
  lessonSlug?: string
): Promise<SaveSolveResult> {
  // A server action is a public endpoint. Without this check anyone could POST
  // solves, and the previous placeholder went further and created a user row
  // to hang them off.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "Войдите, чтобы сохранять результаты" };
  }

  if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > MAX_SOLVE_MS) {
    return { success: false, error: "Некорректное время сборки" };
  }

  // Лимиты частоты — по пользователю (#126): без них вошедший человек
  // циклом записал бы миллионы строк в базу на общем сервере.
  for (const [name, window] of [["burst", SOLVE_BURST], ["hour", SOLVE_HOURLY]] as const) {
    const verdict = rateLimit(`solve:${name}:${userId}`, window);
    if (!verdict.allowed) return { success: false, error: tooFrequent(verdict.retryAfterMs) };
  }

  try {
    // The default session is keyed by the user id so it can be upserted.
    // Looking it up and creating it when missing would let two solves that
    // finish together open two sessions and split the user's history.
    // Additional named sessions get their own generated ids.
    await prisma.trainingSession.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, userId, name: DEFAULT_SESSION_NAME },
    });

    await prisma.solve.create({
      data: {
        timeMs: Math.round(timeMs),
        scramble: scramble.slice(0, MAX_SCRAMBLE_LENGTH),
        trainingSessionId: userId,
        lessonSlug: solveLessonSlug(lessonSlug),
      },
    });
  } catch (error) {
    console.error("saveSolve failed", error);
    return { success: false, error: "Не удалось сохранить результат" };
  }

  await trimOldSolves(userId);
  return { success: true };
}

/**
 * Потолок сборок одного человека (#126) — предохранитель общего диска:
 * счётчики лимитов частоты сбрасываются при перезапуске, потолок — нет.
 * Сверх него вытесняются самые старые сборки (решение владельца); значение —
 * `MAX_SOLVES_PER_USER`, по умолчанию 1000. Сбой здесь записанную сборку не
 * отменяет: лишние строки уйдут при следующем сохранении.
 */
async function trimOldSolves(userId: string): Promise<void> {
  try {
    const stale = await prisma.solve.findMany({
      where: { trainingSession: { userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: maxSolvesPerUser(),
      select: { id: true },
    });
    if (stale.length === 0) return;
    await prisma.solve.deleteMany({ where: { id: { in: stale.map((solve) => solve.id) } } });
  } catch (error) {
    console.error("trimOldSolves failed", error);
  }
}
