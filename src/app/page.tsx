import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Rubik&apos;s Cube Learning Platform</h1>
      <p className="mt-4">WCA Scrambler, Timer & 3D Trainer</p>
      <div className="flex gap-4 mt-8">
        <Link href="/timer" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Таймер
        </Link>
      </div>
    </main>
  );
}
