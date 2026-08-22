import SmartTimer from "@/components/timer/SmartTimer";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

export default function TimerPage() {
  return (
    <div className="mx-auto max-w-7xl p-4 min-h-[calc(100vh-4rem)] flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8 w-full">Таймер</h1>
      <SmartTimer />
    </div>
  );
}
