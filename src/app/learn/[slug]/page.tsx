import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LessonPlayer from "@/components/learn/LessonPlayer";
import { LESSONS, getLesson } from "@/content/lessons";

/*
  Уроки — это код, а не записи в базе, поэтому адреса известны на сборке и
  страницы отрисовываются заранее. Вход не нужен: ничего про пользователя здесь
  не читается.

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

  return <LessonPlayer lesson={lesson} />;
}
