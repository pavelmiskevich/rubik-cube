"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveSolve } from "@/actions/timer";

type TimerState = "IDLE" | "READY" | "RUNNING" | "STOPPED";

const INITIAL_DISPLAY = "0.00";

function formatTime(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, "0")}`;
}

export default function SmartTimer() {
  const [timerState, setTimerState] = useState<TimerState>("IDLE");
  const [saveError, setSaveError] = useState<string | null>(null);
  const timeDisplayRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef<TimerState>("IDLE");
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // The running time is written straight to the DOM: re-rendering React 60
  // times a second to move two digits is wasted work.
  const updateDisplay = useCallback((ms: number) => {
    if (timeDisplayRef.current) {
      timeDisplayRef.current.innerText = formatTime(ms);
    }
  }, []);

  const setState = useCallback((next: TimerState) => {
    stateRef.current = next;
    setTimerState(next);
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

    // A failed write used to disappear into console.error, leaving the solve
    // silently unrecorded while the UI showed a finished time.
    saveSolve(Math.round(elapsed)).then(
      (result) => {
        if (!result.success) setSaveError(result.error);
      },
      (error) => {
        console.error("saveSolve failed", error);
        setSaveError("Не удалось сохранить результат");
      }
    );
  }, [setState, updateDisplay]);

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

  let colorClass = "text-gray-800";
  if (timerState === "READY") colorClass = "text-green-500";
  else if (timerState === "STOPPED") colorClass = "text-gray-600";

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
        className={`text-8xl md:text-9xl font-mono font-bold tracking-tighter ${colorClass}`}
      >
        {INITIAL_DISPLAY}
      </div>
      <p className="mt-8 text-gray-500 text-sm">
        Удерживайте пробел или экран для старта. Любая кнопка/тап для остановки.
      </p>
      {saveError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
}
