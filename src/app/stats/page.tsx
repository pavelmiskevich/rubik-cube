import Link from "next/link";
import { auth } from "@/auth";
import { selectedStatsLesson, statsLessonOptions } from "@/lib/practiceLesson";
import { getSolveLessonSlugsForUser, getSolvesForUser } from "@/lib/solves";
import LessonFilter from "@/components/dashboard/LessonFilter";
import StatisticsDashboard from "@/components/dashboard/StatisticsDashboard";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = {
  title: "Статистика | RubikPlatform",
};

/*
  Страница персональная, статически отрисовывать её нечего. Отдельный
  force-dynamic не нужен: auth() читает cookies, а это request-time API —
  сегмент и так рендерится на каждый запрос. По той же причине не нужен и
  connection().
*/
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <EmptyState
        title="Статистика появится после входа"
        description="Сборки сохраняются в аккаунт, поэтому средние считаются только для вошедших."
        action={
          <Link href="/login">
            <Button>Войти</Button>
          </Link>
        }
      />
    );
  }

  // Выбор урока: в нём только уроки, по которым есть сборки. Урок в адресе,
  // которого нет среди них, — «все сборки», а не пустая статистика.
  const lessons = statsLessonOptions(await getSolveLessonSlugsForUser(userId));
  const selected = selectedStatsLesson((await searchParams).lesson, lessons);
  // Средние, спарклайн и список считаются тем же дашбордом, только по
  // отфильтрованным сборкам: правила WCA в statistics.ts не знают об уроках.
  const solves = await getSolvesForUser(
    userId,
    selected ? { lessonSlug: selected.slug } : {}
  );

  if (solves.length === 0) {
    return (
      <EmptyState
        title="Пока ни одной сборки"
        description="Засеките первую сборку на рабочем экране — средние начнут считаться сами."
        action={
          <Link href="/timer">
            <Button>Начать тренировку</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Статистика</h1>
      {lessons.length > 0 && <LessonFilter lessons={lessons} selected={selected} />}
      <StatisticsDashboard solves={solves} />
    </div>
  );
}
