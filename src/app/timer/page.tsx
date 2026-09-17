import { auth } from "@/auth";
import TimerWorkspace from "@/components/timer/TimerWorkspace";
import { getSolvesForUser } from "@/lib/solves";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

export default async function TimerPage() {
  const session = await auth();
  const userId = session?.user?.id;
  // Средние на рабочем экране считаются с учётом прошлых тренировок, а не с нуля.
  const initialSolves = userId ? await getSolvesForUser(userId) : [];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Таймер</h1>
      <TimerWorkspace canSave={Boolean(session?.user)} initialSolves={initialSolves} />
    </div>
  );
}
