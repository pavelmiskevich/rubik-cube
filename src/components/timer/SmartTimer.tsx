"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { saveSolve } from "@/actions/timer";

type TimerState = "IDLE" | "READY" | "RUNNING" | "STOPPED";

function formatTime(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10); // 2 digits

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(2, "0")}`;
}

export default function SmartTimer() {
  const [timerState, setTimerState] = useState<TimerState>("IDLE");
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  
  const stateRef = useRef<TimerState>("IDLE");
  const startTimeRef = useRef<number>(0);
  const finalTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Sync state to ref for event handlers
  useEffect(() => {
    stateRef.current = timerState;
  }, [timerState]);

  const updateDisplay = useCallback((ms: number) => {
    if (timeDisplayRef.current) {
      timeDisplayRef.current.innerText = formatTime(ms);
    }
  }, []);

  const startTimer = useCallback(() => {
    setTimerState("RUNNING");
    startTimeRef.current = performance.now();
    
    const loop = () => {
      if (stateRef.current === "RUNNING") {
        updateDisplay(performance.now() - startTimeRef.current);
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [updateDisplay]);

  const stopTimer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const elapsed = performance.now() - startTimeRef.current;
    finalTimeRef.current = elapsed;
    setTimerState("STOPPED");
    updateDisplay(elapsed);

    // Save to DB via Server Action
    saveSolve(Math.floor(elapsed)).catch(console.error);
  }, [updateDisplay]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for space
      if (e.code === "Space") e.preventDefault();

      if (e.repeat) return; // Ignore hold repeats

      const current = stateRef.current;
      if (current === "IDLE" && e.code === "Space") {
        setTimerState("READY");
        updateDisplay(0);
      } else if (current === "RUNNING") {
        stopTimer();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const current = stateRef.current;
      if (current === "READY" && e.code === "Space") {
        startTimer();
      } else if (current === "STOPPED") {
        setTimerState("IDLE");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [startTimer, stopTimer, updateDisplay]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const current = stateRef.current;
    if (current === "IDLE") {
      setTimerState("READY");
      updateDisplay(0);
    } else if (current === "RUNNING") {
      stopTimer();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    const current = stateRef.current;
    if (current === "READY") {
      startTimer();
    } else if (current === "STOPPED") {
      setTimerState("IDLE");
    }
  };

  let colorClass = "text-gray-800";
  if (timerState === "READY") colorClass = "text-green-500";
  else if (timerState === "STOPPED") colorClass = "text-gray-600";

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-[40vh] w-full select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div 
        ref={timeDisplayRef}
        className={`text-8xl md:text-9xl font-mono font-bold tracking-tighter ${colorClass}`}
      >
        0.00
      </div>
      <p className="mt-8 text-gray-500 text-sm">
        Удерживайте пробел или экран для старта. Любая кнопка/тап для остановки.
      </p>
    </div>
  );
}
