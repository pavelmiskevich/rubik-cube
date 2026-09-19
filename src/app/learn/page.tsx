import Link from "next/link";
import Card from "@/components/ui/Card";
import { LESSONS } from "@/content/lessons";

export const metadata = {
  title: "Учиться | RubikPlatform",
};

/*
  Список курса. Страница остаётся серверной и статической: уроки — это код,
  никаких запросов на них не нужно. Отметки о пройденном появятся в задаче G,
  вместе с прогрессом.
*/
export default function LearnPage() {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold">Научиться собирать</h1>
        <p className="text-lg text-muted">
          Курс от первого поворота до собранного куба. Каждый урок показывает
          алгоритм на кубе — можно листать по ходам и повторять на своём.
        </p>
        <p className="text-muted">
          Вход не нужен: уроки открыты всем.
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2">
        {LESSONS.map((lesson, index) => (
          <li key={lesson.slug}>
            <Card className="h-full">
              <p className="text-sm text-muted">Урок {index + 1}</p>
              <h2 className="mt-1 font-semibold">
                <Link href={`/learn/${lesson.slug}`} className="text-accent-text">
                  {lesson.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm text-muted">{lesson.summary}</p>
              <p className="mt-3 text-sm text-muted">
                Шагов: {lesson.steps.length}
              </p>
            </Card>
          </li>
        ))}
      </ol>

      <p className="text-sm text-muted">
        Уже умеете собирать? Тогда вам в{" "}
        <Link href="/timer" className="text-accent-text">
          таймер
        </Link>{" "}
        или на{" "}
        <Link href="/trainer" className="text-accent-text">
          тренажёр
        </Link>
        .
      </p>
    </div>
  );
}
