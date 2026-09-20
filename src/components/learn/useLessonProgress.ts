"use client";

import { useEffect, useRef, useState } from "react";
import { saveLessonProgress } from "@/actions/progress";
import {
  COURSE_SHAPES,
  nextProgress,
  readLocalProgress,
  writeLocalProgress,
  type ProgressEntry,
  type ProgressStorage,
} from "@/lib/lessonProgress";

/** localStorage, если он есть и к нему пускают. Само обращение может бросить. */
export function browserStorage(): ProgressStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Сохранённый прогресс одного урока: для вошедшего — пришедший с сервера, для
 * анонима — из localStorage после монтирования (на сервере его нет, поэтому
 * первая отрисовка у анонима всегда «без прогресса»).
 *
 * `undefined` — ещё не прочитано, `null` — прочитано, прогресса нет.
 */
export function useSavedProgress(
  slug: string,
  signedIn: boolean,
  initial: ProgressEntry | null
): ProgressEntry | null | undefined {
  const [saved, setSaved] = useState<ProgressEntry | null | undefined>(
    signedIn ? initial : undefined
  );

  useEffect(() => {
    if (signedIn) return;
    const local = readLocalProgress(browserStorage(), COURSE_SHAPES)[slug] ?? null;
    // Чтение внешнего хранилища после монтирования: на сервере его нет, и
    // прочитать его при первой отрисовке значило бы разойтись с разметкой.
    // Лишняя перерисовка тут одна, при открытии урока.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(local);
  }, [slug, signedIn]);

  return saved;
}

interface Options {
  slug: string;
  /** Вошёл — база, не вошёл — localStorage. Слияния при входе нет. */
  signedIn: boolean;
  /** Прогресс из базы, прочитанный страницей. Для анонима не используется. */
  initial: ProgressEntry | null;
  /** Открытый шаг. */
  stepIndex: number;
  /** Урок пройден до конца прямо сейчас. */
  completed: boolean;
  /** Вернуть человека к шагу, на котором он остановился. Зовётся один раз. */
  onResume: (stepIndex: number) => void;
}

/**
 * Прогресс урока: при открытии возвращает к сохранённому шагу, дальше
 * запоминает каждый новый шаг и завершение.
 *
 * Что именно писать, решает `nextProgress` — он закрыт тестами. Здесь только
 * куда писать и когда. Ошибки записи не всплывают: курс работает и без
 * сохранения, просто не помнит.
 */
export function useLessonProgress({
  slug,
  signedIn,
  initial,
  stepIndex,
  completed,
  onResume,
}: Options): { completed: boolean } {
  const saved = useSavedProgress(slug, signedIn, initial);
  /** Последнее записанное — с ним сравнивается каждое новое состояние. */
  const lastRef = useRef<ProgressEntry | null>(null);
  const [resumed, setResumed] = useState(false);
  const [everCompleted, setEverCompleted] = useState(false);
  const onResumeRef = useRef(onResume);

  useEffect(() => {
    onResumeRef.current = onResume;
  });

  // Сохранённое прочитано — один раз возвращаем к нему. До этого ничего не
  // пишем: иначе открытие урока затёрло бы сохранённый шаг нулевым.
  useEffect(() => {
    if (saved === undefined || resumed) return;
    lastRef.current = saved;
    if (saved && saved.stepIndex > 0) onResumeRef.current(saved.stepIndex);
    // Один раз за жизнь урока и в одной пачке с переходом к шагу.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEverCompleted(Boolean(saved?.completed));
    setResumed(true);
  }, [saved, resumed]);

  useEffect(() => {
    if (!resumed) return;
    const next = nextProgress(lastRef.current ?? undefined, stepIndex, completed);
    if (!next) return;

    lastRef.current = next;
    setEverCompleted(next.completed);

    if (!signedIn) {
      writeLocalProgress(browserStorage(), slug, next);
      return;
    }
    saveLessonProgress(slug, next.stepIndex, next.completed)
      .then((result) => {
        if (!result.success) console.warn("saveLessonProgress:", result.error);
      })
      .catch((error: unknown) => console.warn("saveLessonProgress failed", error));
  }, [resumed, stepIndex, completed, signedIn, slug]);

  return { completed: everCompleted };
}
