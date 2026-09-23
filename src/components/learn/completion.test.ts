import { isLessonCompleted, isTryStepCounted, type CompletionInput } from "./completion";
import type { TryStatus } from "./tryCheck";

describe("когда шаг в «Попробовать» засчитан", () => {
  it("цель достигнута именно алгоритмом шага", () => {
    expect(isTryStepCounted({ status: "done", onAlgorithm: true }, false)).toBe(true);
  });

  it("цель достигнута другим путём — не засчитан", () => {
    expect(isTryStepCounted({ status: "done", onAlgorithm: false }, false)).toBe(false);
  });

  it("проверка остановлена поворотом среднего слоя — не засчитан", () => {
    expect(isTryStepCounted({ status: "done", onAlgorithm: true }, true)).toBe(false);
  });

  it("цель не достигнута — не засчитан, даже на пути алгоритма", () => {
    for (const status of ["start", "on-track", "off-track"] as TryStatus[]) {
      expect(isTryStepCounted({ status, onAlgorithm: true }, false)).toBe(false);
    }
  });
});

const lastStep = (overrides: Partial<CompletionInput> = {}): CompletionInput => ({
  stepIndex: 2,
  stepCount: 3,
  mode: "watch",
  watchFinished: false,
  tryCounted: false,
  ...overrides,
});

describe("когда урок считается пройденным", () => {
  it("после просмотра алгоритма последнего шага до конца", () => {
    expect(isLessonCompleted(lastStep({ watchFinished: true }))).toBe(true);
  });

  it("после самостоятельного выполнения последнего шага", () => {
    expect(isLessonCompleted(lastStep({ mode: "try", tryCounted: true }))).toBe(true);
  });

  it("не когда последний шаг в «Попробовать» не засчитан", () => {
    expect(isLessonCompleted(lastStep({ mode: "try" }))).toBe(false);
  });

  it("не на последнем шаге — ни в одном режиме", () => {
    expect(isLessonCompleted(lastStep({ stepIndex: 1, watchFinished: true }))).toBe(false);
    expect(isLessonCompleted(lastStep({ stepIndex: 1, mode: "try", tryCounted: true }))).toBe(
      false
    );
  });

  it("не по чужому режиму: оценка «Попробовать» в «Посмотреть» не в счёт, и наоборот", () => {
    // Вне «Попробовать» оценка считается по пустой истории, и шаг, чья стартовая
    // позиция вдруг уже удовлетворяла бы цели, засчитал бы урок без единого хода.
    expect(isLessonCompleted(lastStep({ mode: "watch", tryCounted: true }))).toBe(false);
    expect(isLessonCompleted(lastStep({ mode: "try", watchFinished: true }))).toBe(false);
  });
});
