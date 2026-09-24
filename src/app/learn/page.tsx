import Link from "next/link";
import { auth } from "@/auth";
import Card from "@/components/ui/Card";
import LessonProgressMark from "@/components/learn/LessonProgressMark";
import LocalProgressMerge from "@/components/learn/LocalProgressMerge";
import { LESSONS } from "@/content/lessons";
import { getLessonProgressForUser } from "@/lib/lessonProgressDb";

export const metadata = {
  title: "Учиться | RubikPlatform",
};

/*
  Список курса. Уроки — это код, запросов за ними нет; в базу ходим только за
  прогрессом вошедшего. Анонимный прогресс лежит в localStorage, и отметку по
  нему дорисовывает уже браузер. Недоступная база даёт пустой прогресс, а не
  ошибку: список уроков от неё не зависит.
*/
export default async function LearnPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const progress = userId ? await getLessonProgressForUser(userId) : {};
  return (
    <div className="space-y-8">
      {/*
        Слияние анонимного прогресса происходит при входе, на профиле; здесь —
        повторная попытка, если там оно не удалось.
      */}
      {userId && <LocalProgressMerge />}
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
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>Шагов: {lesson.steps.length}</span>
                <LessonProgressMark
                  slug={lesson.slug}
                  stepCount={lesson.steps.length}
                  signedIn={Boolean(userId)}
                  initial={progress[lesson.slug] ?? null}
                />
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {/*
        Вход в решатель — отсюда, а не из шапки: в шапке уже четыре раздела, и
        на телефоне она занимает пятую часть экрана (задача про шапку открыта).
        Человек с разобранным кубиком в руках приходит за курсом и находит
        решатель рядом с ним.
      */}
      <Card>
        <h2 className="font-semibold">
          <Link href="/solve" className="text-accent-text">
            Решить мой кубик
          </Link>
        </h2>
        <p className="mt-2 text-sm text-muted">
          Перенесите раскраску своего кубика на развёртку — платформа проверит,
          бывает ли такой кубик, и поймёт, как он стоит.
        </p>
      </Card>

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
