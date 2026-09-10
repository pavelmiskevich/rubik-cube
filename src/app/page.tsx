import Link from "next/link";
import ScrambleDisplay from "@/components/timer/ScrambleDisplay";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Rubik&apos;s Cube Learning Platform</h1>
      <p className="mt-4 mb-8">WCA Scrambler, Timer & 3D Trainer</p>
      
      <ScrambleDisplay />
      
      <div className="flex gap-4 mt-8">
        <Link href="/timer" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Таймер
        </Link>
        <Link href="/trainer" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Открыть 3D-тренажер
        </Link>
        <Link href="/stats" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          Статистика
        </Link>
      </div>
    </main>
  );
}
