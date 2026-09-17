import Link from "next/link";
import CubeHero from "@/components/cube/CubeHero";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const FEATURES = [
  {
    title: "Скрамблы по правилам WCA",
    text: "Двадцать движений, без повторов подряд — как на официальных стартах.",
  },
  {
    title: "Таймер с удержанием пробела",
    text: "Старт по отпусканию, остановка любой клавишей. Во время замера экран пустеет.",
  },
  {
    title: "Ao5 и Ao12",
    text: "Средние считаются по регламенту: лучшая и худшая сборки отбрасываются.",
  },
];

/*
  Страница остаётся статически отрисовываемой: серверный компонент, никаких
  запросов и request-time API. Генератор скрамблов отсюда ушёл — он живёт на
  рабочем экране.
*/
export default function Home() {
  return (
    <div className="space-y-16">
      {/* min-w-0 на колонке: без него содержимое не даёт ей сжиматься. */}
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Научитесь собирать кубик и следите за прогрессом
          </h1>
          <p className="text-lg text-muted">
            Скрамблы по правилам WCA, таймер и 3D-тренажёр на одной странице.
          </p>
          <Link href="/timer" className="inline-block">
            <Button className="px-6 py-3 text-base">Начать тренировку</Button>
          </Link>
        </div>
        <CubeHero />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted">{feature.text}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
