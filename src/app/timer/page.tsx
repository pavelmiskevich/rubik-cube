import { auth } from "@/auth";
import TimerWorkspace from "@/components/timer/TimerWorkspace";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

export default async function TimerPage() {
  const session = await auth();
  return <TimerWorkspace canSave={Boolean(session?.user)} />;
}
