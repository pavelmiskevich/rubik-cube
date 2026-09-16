import { auth } from "@/auth";
import TimerWorkspace from "@/components/timer/TimerWorkspace";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

export default async function TimerPage() {
  const session = await auth();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Таймер</h1>
      <TimerWorkspace canSave={Boolean(session?.user)} />
    </div>
  );
}
