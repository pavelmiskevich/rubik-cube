"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { mergeLessonProgress } from "@/actions/progress";
import { mergeLocalProgress } from "@/lib/progressMerge";
import { browserStorage } from "./useLessonProgress";

/**
 * Переносит прогресс, накопленный без входа, в аккаунт вошедшего.
 *
 * Ставится на страницы, куда человек попадает только вошедшим: на профиль —
 * туда ведёт любой вход, и по паролю, и через внешний аккаунт, а регистрация
 * ведёт ко входу — и на список курса, где слияние, не удавшееся при входе,
 * повторяется. localStorage есть только в браузере, поэтому перенос живёт
 * здесь, а не в самом входе: вход от него не зависит и упасть из-за него не
 * может.
 *
 * Ничего не рисует. Если слияние изменило базу — обновляет страницу, чтобы
 * отметки на ней показали уже слитый прогресс.
 */
export default function LocalProgressMerge() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    // Один раз за жизнь страницы. Повторный вызов не навредил бы — правило
    // идемпотентно, — но лишний запрос незачем.
    if (started.current) return;
    started.current = true;

    void mergeLocalProgress(browserStorage(), mergeLessonProgress).then((outcome) => {
      if (outcome === "merged") router.refresh();
    });
  }, [router]);

  return null;
}
