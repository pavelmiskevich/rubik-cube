import { auth } from "@/auth";
import TimerWorkspace from "@/components/timer/TimerWorkspace";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

export default async function TimerPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-7xl p-4 min-h-[calc(100vh-4rem)] flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8 w-full">Таймер</h1>
      <TimerWorkspace canSave={Boolean(session?.user)} />
    </div>
  );
}
