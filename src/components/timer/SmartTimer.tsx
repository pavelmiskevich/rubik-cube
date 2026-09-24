"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveSolve } from "@/actions/timer";
import { formatSolveTime } from "@/lib/format";
import type { TimerState } from "./workspaceState";

/*
  Тип живёт в чистом модуле, чтобы тест редьюсера не тянул за собой клиентский
  компонент с JSX. Реэкспорт — чтобы существующие импорты не ломались.
*/
export type { TimerState } from "./workspaceState";

const INITIAL_DISPLAY = formatSolveTime(0);

interface SmartTimerProps {
  /** Scramble recorded alongside the solve; empty when the timer runs standalone. */
  scramble?: string;
  /**
   * Урок, который тренируется, — уходит в saveSolve рядом со скрамблом.
   * Сервер проверяет его сам: неизвестный урок сохранится свободной сборкой.
   */
  lessonSlug?: string;
  /** Solves are only persisted for a signed-in user; used to explain that up front. */
  canSave?: boolean;
  /** Состояние машины таймера — по нему включается режим фокуса. */
  onStateChange?: (state: TimerState) => void;
  /** Завершённая сборка в миллисекундах, до применения штрафов. */
  onSolve?: (timeMs: number) => void;
}

export default function SmartTimer({
  scramble = "",
  lessonSlug,
  canSave = true,
  onStateChange,
  onSolve,
}: SmartTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>("IDLE");
  const [saveError, setSaveError] = useState<string | null>(null);
  const timeDisplayRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef<TimerState>("IDLE");
  // Read at stop time so a scramble regenerated mid-solve does not rebind the
  // whole stop callback.
  const scrambleRef = useRef(scramble);
  // Урок — так же, через ref: машина состояний и её обработчики не меняются,
  // а сохранение читает урок в тот же момент, что и скрамбл.
  const lessonSlugRef = useRef(lessonSlug);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Колбэки держим в ref — так же, как scramble. Сознательно: положи их в
  // зависимости setState и stopTimer, и при каждом рендере родителя
  // пересобрались бы все обработчики, поведение которых закреплено 29 тестами.
  const onStateChangeRef = useRef(onStateChange);
  const onSolveRef = useRef(onSolve);

  useEffect(() => {
    scrambleRef.current = scramble;
  }, [scramble]);

  useEffect(() => {
    lessonSlugRef.current = lessonSlug;
  }, [lessonSlug]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
    onSolveRef.current = onSolve;
  }, [onStateChange, onSolve]);

  // The running time is written straight to the DOM: re-rendering React 60
  // times a second to move two digits is wasted work.
  const updateDisplay = useCallback((ms: number) => {
    if (timeDisplayRef.current) {
      timeDisplayRef.current.innerText = formatSolveTime(ms);
    }
  }, []);

  const setState = useCallback((next: TimerState) => {
    stateRef.current = next;
    setTimerState(next);
    onStateChangeRef.current?.(next);
  }, []);

  const arm = useCallback(() => {
    setState("READY");
    setSaveError(null);
    updateDisplay(0);
  }, [setState, updateDisplay]);

  const startTimer = useCallback(() => {
    setState("RUNNING");
    startTimeRef.current = performance.now();

    const loop = () => {
      if (stateRef.current !== "RUNNING") return;
      updateDisplay(performance.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [setState, updateDisplay]);

  const stopTimer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const elapsed = performance.now() - startTimeRef.current;
    setState("STOPPED");
    updateDisplay(elapsed);

    // До проверки canSave: живые средние нужны и тому, кто не вошёл.
    onSolveRef.current?.(Math.round(elapsed));

    if (!canSave) return;

    // A failed write used to disappear into console.error, leaving the solve
    // silently unrecorded while the UI showed a finished time.
    saveSolve(Math.round(elapsed), scrambleRef.current, lessonSlugRef.current).then(
      (result) => {
        if (!result.success) setSaveError(result.error);
      },
      (error) => {
        console.error("saveSolve failed", error);
        setSaveError("Не удалось сохранить результат");
      }
    );
  }, [canSave, setState, updateDisplay]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") event.preventDefault();
      if (event.repeat) return;

      if (stateRef.current === "IDLE" && event.code === "Space") {
        arm();
      } else if (stateRef.current === "RUNNING") {
        stopTimer();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (stateRef.current === "READY" && event.code === "Space") {
        startTimer();
      } else if (stateRef.current === "STOPPED") {
        setState("IDLE");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [arm, setState, startTimer, stopTimer]);

  const handlePointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    if (stateRef.current === "IDLE") {
      arm();
    } else if (stateRef.current === "RUNNING") {
      stopTimer();
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    event.preventDefault();
    if (stateRef.current === "READY") {
      startTimer();
    } else if (stateRef.current === "STOPPED") {
      setState("IDLE");
    }
  };

  // Sliding off the timer is not a release: starting a solve the user never
  // committed to would cost them the attempt, so an armed timer just disarms.
  const handlePointerLeave = () => {
    if (stateRef.current === "READY") {
      setState("IDLE");
      updateDisplay(0);
    }
  };

  let colorClass = "text-text";
  if (timerState === "READY") colorClass = "text-success";
  else if (timerState === "STOPPED") colorClass = "text-muted";

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[40vh] w-full select-none touch-none"
      data-testid="timer"
      data-state={timerState}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={timeDisplayRef}
        data-testid="timer-display"
        className={`font-mono text-8xl font-bold tabular-nums tracking-tighter md:text-9xl ${colorClass}`}
      >
        {INITIAL_DISPLAY}
      </div>
      <p data-chrome className="mt-8 text-sm text-muted">
        Удерживайте пробел или экран для старта. Любая кнопка/тап для остановки.
      </p>
      {!canSave && (
        <p data-chrome className="mt-2 text-sm text-muted">
          Результаты сохраняются только для вошедших пользователей.
        </p>
      )}
      {saveError && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
}
