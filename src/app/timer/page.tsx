import Link from "next/link";
import { auth } from "@/auth";
import TimerWorkspace from "@/components/timer/TimerWorkspace";
import Card from "@/components/ui/Card";
import { getLesson } from "@/content/lessons";
import { getSolvesForUser } from "@/lib/solves";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

/**
 * Урок, который человек сейчас тренирует, если он пришёл на таймер с урока.
 * Адрес пишется руками кем угодно, поэтому незнакомый или повторённый
 * параметр — просто «ничего не тренирует», а не ошибка.
 */
function practisedLesson(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  const lesson = getLesson(value);
  return lesson?.practice ? lesson : undefined;
}

export default async function TimerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  // Средние на рабочем экране считаются с учётом прошлых тренировок, а не с нуля.
  const initialSolves = userId ? await getSolvesForUser(userId) : [];
  const lesson = practisedLesson((await searchParams).lesson);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Таймер</h1>
      {lesson && (
        // data-chrome: во время замера на экране остаются только цифры.
        <div data-chrome>
          <Card className="space-y-2">
            <p className="text-sm text-muted">Сейчас тренируете</p>
            <h2 className="font-semibold" data-testid="practice-lesson">
              {lesson.title}
            </h2>
            <p className="text-sm text-muted">{lesson.practice}</p>
            <p className="text-sm">
              <Link href={`/learn/${lesson.slug}`} className="font-semibold text-accent-text">
                ← Вернуться к уроку
              </Link>
            </p>
          </Card>
        </div>
      )}
      <TimerWorkspace canSave={Boolean(session?.user)} initialSolves={initialSolves} />
    </div>
  );
}
