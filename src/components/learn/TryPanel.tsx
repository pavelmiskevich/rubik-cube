"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { formatMove } from "@/lib/cube/moves";
import { isTryStepCounted } from "./completion";
import { describeMove, type TryAssessment } from "./tryCheck";

/** Дальше этого отматывать ход за ходом утомительнее, чем начать шаг заново. */
const STRAY_LIMIT = 3;

function statusText(assessment: TryAssessment): { text: string; tone: string } {
  const { status, progress, total, onAlgorithm, stray } = assessment;
  switch (status) {
    case "start":
      return {
        text: "Куб в начале шага. Крутите сами: потяните за наклейку в сторону поворота.",
        tone: "text-muted",
      };
    case "on-track":
      return {
        text: `Верно, вы на пути алгоритма. Пройдено ходов: ${progress} из ${total}.`,
        tone: "text-text",
      };
    case "off-track":
      return {
        text:
          stray > STRAY_LIMIT
            ? "Куб далеко ушёл от алгоритма — проще вернуться к началу шага, чем отматывать."
            : "Этот ход уводит от алгоритма — шаг так не получится. Отмените его или попросите подсказку.",
        tone: "text-danger",
      };
    case "done":
      // Цель другим путём — шаг не засчитан: урок учит алгоритму, а не цели (#69).
      return onAlgorithm
        ? { text: "Шаг выполнен: цель достигнута, и именно тем алгоритмом.", tone: "text-success" }
        : {
            text: "Цель на кубе достигнута, но не тем алгоритмом, которому учит шаг, — поэтому шаг не засчитан. Пройдите его заново по алгоритму.",
            tone: "text-text",
          };
  }
}

/**
 * Панель режима «Попробовать»: вердикт после каждого хода, подсказка по
 * запросу и возврат к началу шага.
 *
 * Вся логика — в `tryCheck.ts` и `trySession.ts`, здесь только слова.
 * Подсказка показывается до следующего хода: после него она уже про другую
 * позицию, и оставить её на экране значило бы подсказать неверно.
 */
export default function TryPanel({
  assessment,
  desynced,
  moveCount,
  onReset,
  onNextStep,
}: {
  assessment: TryAssessment;
  desynced: boolean;
  moveCount: number;
  onReset: () => void;
  /** Нет — значит, шаг последний. */
  onNextStep?: () => void;
}) {
  /** Номер хода, на котором попросили подсказку. */
  const [hintAt, setHintAt] = useState<number | null>(null);

  const { hint, status } = assessment;
  const showHint = hint !== null && !desynced && hintAt === moveCount;
  const counted = isTryStepCounted(assessment, desynced);
  /** Цель достигнута другим путём: выход один — пройти шаг заново. */
  const redo = status === "done" && !desynced && !counted;
  const verdict = desynced
    ? {
        text: "Повёрнут средний слой — урок его не отслеживает, и проверка остановлена. Верните куб к началу шага.",
        tone: "text-danger",
      }
    : statusText(assessment);

  return (
    <div className="space-y-3">
      <p className={`text-sm font-semibold ${verdict.tone}`} role="status" aria-live="polite">
        {verdict.text}
      </p>

      {showHint && hint && (
        <p className="text-sm">
          Следующий ход: <span className="font-mono font-semibold">{formatMove(hint)}</span> —{" "}
          {describeMove(hint)}.{" "}
          <span className="text-muted">
            {status === "off-track"
              ? "Он возвращает куб на путь алгоритма."
              : "Это следующий ход алгоритма."}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setHintAt(moveCount)}
          disabled={hint === null || desynced || showHint}
        >
          Подсказка
        </Button>
        <Button
          variant={desynced || redo || status === "off-track" ? "primary" : "ghost"}
          onClick={onReset}
        >
          {redo ? "Пройти шаг заново" : "Вернуть к началу шага"}
        </Button>
        {counted && onNextStep && (
          <Button onClick={onNextStep}>Следующий шаг</Button>
        )}
      </div>
    </div>
  );
}
