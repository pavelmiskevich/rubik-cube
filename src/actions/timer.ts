"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_SESSION_NAME = "Main 3x3";

/** A solve longer than an hour is a forgotten running timer, not a result. */
const MAX_SOLVE_MS = 60 * 60 * 1000;
const MAX_SCRAMBLE_LENGTH = 256;

export type SaveSolveResult = { success: true } | { success: false; error: string };

export async function saveSolve(timeMs: number, scramble: string = ""): Promise<SaveSolveResult> {
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
      },
    });

    return { success: true };
  } catch (error) {
    console.error("saveSolve failed", error);
    return { success: false, error: "Не удалось сохранить результат" };
  }
}
