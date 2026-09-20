"use client";

import Badge from "@/components/ui/Badge";
import type { ProgressEntry } from "@/lib/lessonProgress";
import { useSavedProgress } from "./useLessonProgress";

/**
 * Отметка о прогрессе на карточке урока в списке `/learn`.
 *
 * Список остаётся серверным, а клиентская здесь только отметка: анонимный
 * прогресс лежит в localStorage и читается уже в браузере.
 */
export default function LessonProgressMark({
  slug,
  stepCount,
  signedIn,
  initial,
}: {
  slug: string;
  stepCount: number;
  signedIn: boolean;
  initial: ProgressEntry | null;
}) {
  const saved = useSavedProgress(slug, signedIn, initial);
  if (!saved) return null;

  return (
    <span data-testid={`lesson-progress-${slug}`}>
      {saved.completed ? (
        <Badge tone="warning">Пройден</Badge>
      ) : (
        <Badge>
          Остановились на шаге {saved.stepIndex + 1} из {stepCount}
        </Badge>
      )}
    </span>
  );
}
