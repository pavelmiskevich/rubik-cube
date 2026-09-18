import Link from "next/link";
import Card from "@/components/ui/Card";

export const metadata = {
  title: "Учиться | RubikPlatform",
};

const AVAILABLE = [
  {
    href: "/trainer",
    title: "3D-тренажёр",
    text: "Покрутить куб в браузере и привыкнуть к поворотам слоёв.",
  },
  {
    href: "/timer",
    title: "Таймер",
    text: "Скрамбл по правилам WCA и замер времени, когда сборка уже получается.",
  },
  {
    href: "/stats",
    title: "Статистика",
    text: "Средние Ao5 и Ao12 по сохранённым сборкам.",
  },
];

/*
  Временная страница: уроки появятся в задаче E эпика #38 и заменят её целиком.
  Нужна сейчас, чтобы главная кнопка лендинга и ссылка «Учиться» в шапке не
  вели в 404.
*/
export default function LearnPage() {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold">Научиться собирать</h1>
        <p className="text-lg text-muted">
          Курс от первого поворота до собранного куба ещё готовится: уроков
          здесь пока нет.
        </p>
        <p className="text-muted">А вот что в платформе уже работает.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {AVAILABLE.map((section) => (
          <Card key={section.href}>
            <h2 className="font-semibold">
              <Link href={section.href} className="text-accent-text">
                {section.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm text-muted">{section.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
