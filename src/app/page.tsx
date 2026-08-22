import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Rubik&apos;s Cube Learning Platform</h1>
      <p className="mt-4 mb-8">WCA Scrambler, Timer & 3D Trainer</p>
      
      <div className="flex gap-4">
        <Link href="/stats" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          Статистика
        </Link>
      </div>
    </main>
  );
}
