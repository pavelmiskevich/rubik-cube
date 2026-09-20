"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LessonCube from "./LessonCube";
import { useLessonProgress } from "./useLessonProgress";
import {
  initialPlayerState,
  isFinished,
  playerReducer,
  type Speed,
} from "./playerState";
import type { RubiksCubeRef } from "@/components/cube/RubiksCube";
import type { Lesson } from "@/content/lessons";
import type { ProgressEntry } from "@/lib/lessonProgress";
import { goalLabel } from "@/content/lessons";
import { formatMove, invertMove, parseSequence } from "@/lib/cube/moves";
import { playSequence, sliceTurnsForMove } from "@/lib/cube/bridge";

/** Длительность одного хода на обычной скорости. */
const BASE_DURATION = 320;
/** Почти мгновенно: расстановка стартовой позиции и режим reduced-motion. */
const INSTANT = 1;

const SPEEDS: readonly { value: Speed; label: string }[] = [
  { value: 0.5, label: "0,5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return reduced;
}

/**
 * Урок в режиме «Посмотреть»: куб проигрывает алгоритм шага, человек повторяет
 * на своём.
 *
 * Состояние живёт в playerState.ts и закрыто тестами. Здесь остаётся
 * единственная нетривиальная вещь — синхронизация картинки с этим состоянием.
 *
 * Правило простое: `appliedRef` помнит, сколько ходов уже показано кубом, и
 * эффект доводит картинку до `moveIndex` ровно по одному ходу, вперёд или
 * назад. Шаг назад проигрывает обратный ход, а не перематывает с начала.
 * Пересборка (повтор, смена шага) идёт через `key` на кубе: он размонтируется
 * и собирается заново, поэтому никакого накопления расхождений не существует
 * в принципе.
 */
export default function LessonPlayer({
  lesson,
  signedIn = false,
  initialProgress = null,
}: {
  lesson: Lesson;
  /** Вошёл — прогресс в базе, не вошёл — в localStorage. */
  signedIn?: boolean;
  /** Прогресс из базы для вошедшего. */
  initialProgress?: ProgressEntry | null;
}) {
  /*
    Куб живёт в состоянии, а не в ref, и это не стилистика.

    Он приезжает отдельным чанком уже после первой отрисовки. Пока он лежал в
    ref, эффект со стартовой позицией успевал отработать по пустому месту и
    молча ничего не делал: урок открывался на собранном кубе вместо позиции
    шага. В состоянии такого не бывает — пока ноды нет, эффекту нечего делать,
    а её появление само его будит.
  */
  const [cube, setCube] = useState<RubiksCubeRef | null>(null);
  /** Сколько ходов алгоритма уже показано кубом. */
  const appliedRef = useRef(0);
  /** Пока идёт анимация, второй ход не начинаем. */
  const busyRef = useRef(false);
  /** Меняется после каждой доигранной анимации и будит эффект синхронизации. */
  const [syncTick, setSyncTick] = useState(0);

  const firstStep = lesson.steps[0];
  const [state, dispatch] = useReducer(
    playerReducer,
    parseSequence(firstStep.algorithm).length,
    initialPlayerState
  );

  const step = lesson.steps[state.stepIndex] ?? firstStep;
  const moves = useMemo(() => parseSequence(step.algorithm), [step.algorithm]);
  const setupMoves = useMemo(() => parseSequence(step.setup), [step.setup]);

  const reducedMotion = usePrefersReducedMotion();
  const duration = reducedMotion ? INSTANT : BASE_DURATION / state.speed;

  // Куб пересобран: ставим стартовую позицию шага мгновенно, чтобы урок
  // начинался с позиции, а не с её проигрывания.
  useEffect(() => {
    appliedRef.current = 0;
    busyRef.current = false;
    if (!cube) return;

    let cancelled = false;
    busyRef.current = true;
    void playSequence(
      (axis, index, direction) => cube.rotateSlice(axis, index, direction, INSTANT),
      setupMoves
    ).then(() => {
      if (cancelled) return;
      busyRef.current = false;
      setSyncTick((tick) => tick + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [cube, state.resetToken, setupMoves]);

  // Доводим картинку до moveIndex ровно по одному ходу.
  useEffect(() => {
    if (!cube || busyRef.current) return;

    if (state.moveIndex === appliedRef.current) {
      if (state.playing && state.moveIndex < state.totalMoves) {
        dispatch({ type: "forward" });
      }
      return;
    }

    const forward = state.moveIndex > appliedRef.current;
    const move = forward
      ? moves[appliedRef.current]
      : invertMove(moves[appliedRef.current - 1]);
    if (!move) return;

    busyRef.current = true;
    let cancelled = false;

    void (async () => {
      for (const turn of sliceTurnsForMove(move)) {
        await cube.rotateSlice(turn.axis, turn.index, turn.direction, duration);
        if (cancelled) return;
      }
      appliedRef.current += forward ? 1 : -1;
      busyRef.current = false;
      setSyncTick((tick) => tick + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [cube, state.moveIndex, state.playing, state.totalMoves, moves, duration, syncTick]);

  const finished = isFinished(state);

  const selectStep = (index: number) => {
    dispatch({
      type: "select-step",
      stepIndex: index,
      totalMoves: parseSequence(lesson.steps[index].algorithm).length,
    });
  };

  // Прогресс: возвращает к шагу, где человек остановился, и запоминает новые.
  // Урок пройден, когда до конца показан алгоритм последнего шага.
  const progress = useLessonProgress({
    slug: lesson.slug,
    signedIn,
    initial: initialProgress,
    stepIndex: state.stepIndex,
    completed: finished && state.stepIndex === lesson.steps.length - 1,
    onResume: selectStep,
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {progress.completed && (
          <p data-testid="lesson-completed">
            <Badge tone="warning">Урок пройден</Badge>
          </p>
        )}
        <p className="max-w-2xl text-muted">{lesson.summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* key — пересборка куба: размонтировали, собрали заново, расхождению неоткуда взяться. */}
          <LessonCube key={state.resetToken} onCube={setCube} />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => dispatch({ type: state.playing ? "pause" : "play" })}
            >
              {state.playing ? "Пауза" : finished ? "Ещё раз" : "Играть"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: "back" })}
              disabled={state.moveIndex === 0}
            >
              Шаг назад
            </Button>
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: "forward" })}
              disabled={finished}
            >
              Шаг вперёд
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: "restart" })}>
              Сначала
            </Button>

            <span className="ml-auto flex items-center gap-1">
              <span className="text-sm text-muted">Скорость</span>
              {SPEEDS.map((speed) => (
                <Button
                  key={speed.value}
                  variant={state.speed === speed.value ? "primary" : "ghost"}
                  onClick={() => dispatch({ type: "speed", speed: speed.value })}
                  aria-pressed={state.speed === speed.value}
                >
                  {speed.label}
                </Button>
              ))}
            </span>
          </div>

          <p className="text-sm text-muted">
            Ход {state.moveIndex} из {state.totalMoves}
            {reducedMotion && " · анимация выключена в настройках системы"}
          </p>
        </div>

        <div className="space-y-4">
          <div
            className="flex gap-2"
            role="group"
            aria-label="Режим урока"
          >
            <Button aria-pressed>Посмотреть</Button>
            {/* Второй режим включает задача F: здесь он виден, но не работает. */}
            <Button variant="secondary" disabled title="Появится в следующей задаче">
              Попробовать
            </Button>
          </div>

          <Card>
            <h2 className="font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm text-muted">{step.explanation}</p>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Алгоритм</dt>
                <dd className="font-mono">
                  {moves.map((move, index) => (
                    <span
                      key={`${index}-${formatMove(move)}`}
                      className={
                        index < state.moveIndex ? "text-muted" : "font-semibold text-text"
                      }
                    >
                      {formatMove(move)}
                      {index < moves.length - 1 ? " " : ""}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Цель шага</dt>
                <dd>
                  <Badge>{goalLabel(step.goal)}</Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <ol className="space-y-1">
            {lesson.steps.map((lessonStep, index) => (
              <li key={lessonStep.id}>
                <button
                  onClick={() => selectStep(index)}
                  aria-current={index === state.stepIndex ? "step" : undefined}
                  className={`w-full rounded-control px-3 py-2 text-left text-sm ${
                    index === state.stepIndex
                      ? "border bg-surface-2 font-semibold"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {index + 1}. {lessonStep.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
