import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import LessonGate from "@/components/learn/LessonGate";
import LessonPlayer from "@/components/learn/LessonPlayer";
import { LESSONS, getLesson, prerequisiteOf } from "@/content/lessons";
import { getLessonProgressForUser } from "@/lib/lessonProgressDb";

/*
  Уроки — это код, а не записи в базе, поэтому список адресов известен на
  сборке и остаётся в generateStaticParams. Но заранее страница больше не
  отрисовывается: вошедшему урок открывается на шаге, где он остановился, а
  для этого нужна сессия — значит, рендер на каждый запрос. Вход по-прежнему
  не нужен: анонимный прогресс лежит в localStorage и читается проигрывателем
  уже в браузере.

  params в этой версии Next приходит промисом, отсюда await.
*/
export function generateStaticParams() {
  return LESSONS.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLesson(slug);

  return {
    title: lesson ? `${lesson.title} | RubikPlatform` : "Урок не найден | RubikPlatform",
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLesson(slug);

  if (!lesson) notFound();

  const session = await auth();
  const userId = session?.user?.id;
  // Недоступная база даёт пустой прогресс: урок открывается с начала, но
  // открывается.
  const progress = userId ? await getLessonProgressForUser(userId) : {};

  const player = (
    <LessonPlayer
      lesson={lesson}
      signedIn={Boolean(userId)}
      initialProgress={progress[lesson.slug] ?? null}
    />
  );

  // Урок закрытого блока открывается, когда пройден урок, который его
  // открывает. Прогресс анонима — в браузере, поэтому решает клиент.
  const prerequisite = prerequisiteOf(lesson.slug);
  if (!prerequisite) return player;

  return (
    <LessonGate
      prerequisite={{ slug: prerequisite.slug, title: prerequisite.title }}
      signedIn={Boolean(userId)}
      initial={progress[prerequisite.slug] ?? null}
    >
      {player}
    </LessonGate>
  );
}
