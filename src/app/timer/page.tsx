import Link from "next/link";
import { auth } from "@/auth";
import TimerWorkspace from "@/components/timer/TimerWorkspace";
import Card from "@/components/ui/Card";
import { practisedLesson } from "@/lib/practiceLesson";
import { getSolvesForUser } from "@/lib/solves";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

export default async function TimerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  // Средние на рабочем экране считаются с учётом прошлых тренировок, а не с нуля.
  const initialSolves = userId ? await getSolvesForUser(userId) : [];
  // Урок, который человек тренирует, если пришёл на таймер с урока. Правило
  // общее с saveSolve: что показано здесь, то и запишется в сборку.
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
      <TimerWorkspace
        canSave={Boolean(session?.user)}
        initialSolves={initialSolves}
        lessonSlug={lesson?.slug}
      />
    </div>
  );
}
