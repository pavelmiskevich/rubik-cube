"use client";

import { useEffect, useRef, useState } from "react";
import { CubeState } from "@/lib/cube/state";
import {
  ShortSolution,
  ShortSolveRequest,
  ShortSolveResponse,
  stateKey,
  toShortSolution,
} from "./shortSolution";

interface Channel {
  worker: Worker;
  /** Какое положение спрашивал каждый запрос — по номеру запроса. */
  asked: Map<number, string>;
  /** Положения, на которые ответ уже пришёл. */
  answered: Set<string>;
  nextId: number;
}

/**
 * Короткое решение положения `state`, посчитанное в фоновом потоке.
 *
 * Поток заводится при первом включении режима «коротко», а не при открытии
 * экрана: тому, кто остался на «понятно», незачем платить за таблицы. Дальше
 * он живёт до ухода со страницы, и повторные решения таблиц уже не ждут.
 *
 * Возвращает `null`, пока режим выключен или решать нечего.
 */
export function useShortSolution(state: CubeState | null, active: boolean): ShortSolution | null {
  const key = state === null ? null : stateKey(state);
  const [answers, setAnswers] = useState<Readonly<Record<string, ShortSolution>>>({});
  const channel = useRef<Channel | null>(null);

  useEffect(() => {
    if (!active || state === null || key === null) return;

    let current = channel.current;
    if (current === null) {
      const worker = new Worker(new URL("./shortSolver.worker.ts", import.meta.url));
      const opened: Channel = { worker, asked: new Map(), answered: new Set(), nextId: 1 };

      worker.onmessage = (event: MessageEvent<ShortSolveResponse>) => {
        const askedKey = opened.asked.get(event.data.id);
        if (askedKey === undefined) return;
        opened.asked.delete(event.data.id);
        opened.answered.add(askedKey);
        setAnswers((known) => ({ ...known, [askedKey]: toShortSolution(event.data) }));
      };
      // Поток не загрузился или упал: всё, чего ждали, — отказ, а не вечное «ищу».
      worker.onerror = () => {
        const waiting = [...opened.asked.values()];
        opened.asked.clear();
        setAnswers((known) => ({
          ...known,
          ...Object.fromEntries(waiting.map((waited) => [waited, { kind: "failed" } as const])),
        }));
      };

      channel.current = opened;
      current = opened;
    }

    // Об этом положении уже спросили — ответ либо есть, либо в пути.
    if (current.answered.has(key) || [...current.asked.values()].includes(key)) return;
    const id = current.nextId++;
    current.asked.set(id, key);
    const request: ShortSolveRequest = { id, state };
    current.worker.postMessage(request);
  }, [active, key, state]);

  // Уходя со страницы, поток гасим: таблицы в нём — несколько мегабайт памяти.
  useEffect(
    () => () => {
      channel.current?.worker.terminate();
      channel.current = null;
    },
    []
  );

  if (!active || key === null) return null;
  return answers[key] ?? { kind: "working" };
}
