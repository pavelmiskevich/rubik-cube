import Link from "next/link";
import ScrambleDisplay from "@/components/timer/ScrambleDisplay";
import Button from "@/components/ui/Button";

/* Временная компоновка на токенах: лендинг переделывает #22. */
export default function Home() {
  return (
    <div className="space-y-10 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Платформа для сборки кубика
        </h1>
        <p className="text-muted">
          Скрамблы по правилам WCA, таймер и 3D-тренажёр.
        </p>
      </div>

      <ScrambleDisplay />

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/timer">
          <Button>Таймер</Button>
        </Link>
        <Link href="/trainer">
          <Button variant="secondary">3D-тренажёр</Button>
        </Link>
        <Link href="/stats">
          <Button variant="secondary">Статистика</Button>
        </Link>
      </div>
    </div>
  );
}
