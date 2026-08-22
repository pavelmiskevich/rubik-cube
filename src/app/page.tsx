import ScrambleDisplay from "@/components/timer/ScrambleDisplay";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Rubik&apos;s Cube Learning Platform</h1>
      <p className="mt-4 mb-8">WCA Scrambler, Timer & 3D Trainer</p>
      
      <ScrambleDisplay />
    </main>
  );
}
