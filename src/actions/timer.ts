"use server";

import { prisma } from "@/lib/prisma";

export async function saveSolve(timeMs: number, scramble: string = "") {
  // Mock user for now since auth PR is not merged
  const dummyUserId = "00000000-0000-0000-0000-000000000000";

  let tSession = await prisma.trainingSession.findFirst({
    where: { userId: dummyUserId },
    orderBy: { createdAt: "desc" },
  });

  if (!tSession) {
    // Make sure dummy user exists
    let user = await prisma.user.findUnique({ where: { id: dummyUserId } });
    if (!user) {
      user = await prisma.user.create({
        data: { id: dummyUserId, email: "dummy@example.com", name: "Dummy" }
      });
    }

    tSession = await prisma.trainingSession.create({
      data: {
        userId: dummyUserId,
        name: "Main 3x3",
      },
    });
  }

  await prisma.solve.create({
    data: {
      timeMs,
      scramble,
      trainingSessionId: tSession.id,
    },
  });

  return { success: true };
}
