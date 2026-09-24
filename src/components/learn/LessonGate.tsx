"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import type { ProgressEntry } from "@/lib/lessonProgress";
import { useSavedProgress } from "./useLessonProgress";

/** Урок, который открывает блок: только то, что нужно, чтобы на него сослаться. */
export interface Prerequisite {
  slug: string;
  title: string;
}

interface GateProps {
  prerequisite: Prerequisite;
  signedIn: boolean;
  /** Прогресс по этому уроку из базы для вошедшего. */
  initial: ProgressEntry | null;
  children: React.ReactNode;
}

/**
 * Пройден ли урок, открывающий блок. `undefined` — ещё не прочитано: у
 * анонима прогресс лежит в localStorage, и узнать его можно только в
 * браузере после монтирования.
 */
function usePrerequisitePassed({ prerequisite, signedIn, initial }: Omit<GateProps, "children">) {
  const saved = useSavedProgress(prerequisite.slug, signedIn, initial);
  return saved === undefined ? undefined : Boolean(saved?.completed);
}

function LockedNotice({ prerequisite }: { prerequisite: Prerequisite }) {
  return (
    <p className="text-sm text-muted" data-testid="course-locked">
      Откроется, когда вы соберёте кубик целиком — пройдите урок{" "}
      <Link href={`/learn/${prerequisite.slug}`} className="text-accent-text">
        «{prerequisite.title}»
      </Link>
      . Скоростной метод стоит на методе слоёв: без собранного куба ему не на
      что опереться.
    </p>
  );
}

/**
 * Урок закрытого блока: пока блок закрыт, вместо проигрывателя — объяснение и
 * ссылка на урок, который его откроет.
 *
 * Правило — `isLessonOpen` в `@/content/lessons`; здесь только его сторона,
 * зависящая от браузера. Пока прогресс не прочитан, не показывается ничего:
 * мелькнувший на миг урок, который тут же закрылся, выглядел бы поломкой.
 */
export default function LessonGate(props: GateProps) {
  const passed = usePrerequisitePassed(props);
  if (passed === undefined) return null;
  if (passed) return <>{props.children}</>;

  return (
    <Card className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold">Этот урок пока закрыт</h1>
      <LockedNotice prerequisite={props.prerequisite} />
    </Card>
  );
}

/**
 * Список уроков закрытого блока: виден, чтобы было понятно, куда ведёт курс,
 * но не ведёт никуда, пока блок не открыт.
 */
export function BlockGate(props: GateProps) {
  const passed = usePrerequisitePassed(props);
  const open = passed === true;

  return (
    <div className="space-y-4">
      {passed === false && <LockedNotice prerequisite={props.prerequisite} />}
      <div inert={!open} aria-disabled={!open} className={open ? undefined : "opacity-50"}>
        {props.children}
      </div>
    </div>
  );
}
