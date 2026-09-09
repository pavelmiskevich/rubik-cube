"use server";

import { prisma } from "@/lib/prisma";

/**
 * Placeholder identity used until authentication lands (issue #2).
 *
 * Fixed ids let both rows be upserted, so two solves finishing at the same
 * time cannot race each other into a duplicate-key error the way a
 * findFirst-then-create pair did.
 *
 * TODO(#2): resolve the user from the session and drop the demo rows.
 */
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";
const DEMO_SESSION_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = "demo@rubik.local";

/** A solve longer than an hour is a forgotten running timer, not a result. */
const MAX_SOLVE_MS = 60 * 60 * 1000;
const MAX_SCRAMBLE_LENGTH = 256;

export type SaveSolveResult = { success: true } | { success: false; error: string };

export async function saveSolve(timeMs: number, scramble: string = ""): Promise<SaveSolveResult> {
  // A server action is a public endpoint: nothing stops a caller from posting
  // arbitrary values, so the arguments are validated rather than trusted.
  if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > MAX_SOLVE_MS) {
    return { success: false, error: "Некорректное время сборки" };
  }

  const normalisedScramble = scramble.slice(0, MAX_SCRAMBLE_LENGTH);

  try {
    await prisma.user.upsert({
      where: { id: DEMO_USER_ID },
      update: {},
      create: { id: DEMO_USER_ID, email: DEMO_EMAIL, name: "Demo" },
    });

    await prisma.trainingSession.upsert({
      where: { id: DEMO_SESSION_ID },
      update: {},
      create: { id: DEMO_SESSION_ID, userId: DEMO_USER_ID, name: "Main 3x3" },
    });

    await prisma.solve.create({
      data: {
        timeMs: Math.round(timeMs),
        scramble: normalisedScramble,
        trainingSessionId: DEMO_SESSION_ID,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("saveSolve failed", error);
    return { success: false, error: "Не удалось сохранить результат" };
  }
}
