import type { CubeState } from "@/lib/cube/state";
import type { Face } from "@/lib/cube/moves";
import {
  areTwoLayersSolved,
  isCrossSolved,
  isFirstLayerSolved,
  isSolved,
} from "@/lib/cube/predicates";

/**
 * Урок — это данные, а не код экрана.
 *
 * Шаг описывает позицию словами и двумя последовательностями: `setup` ставит
 * куб в положение, с которого шаг начинается, `algorithm` — то, чему шаг учит.
 * Экран ничего не знает про конкретные уроки, а урок ничего не знает про экран.
 *
 * Цель шага записана декларативно, а не функцией. Так тест может пройти по
 * всем урокам разом и проверить каждый шаг движком: сломанный урок роняет
 * сборку, а не новичка.
 */
export type LessonGoal =
  | { kind: "solved" }
  | { kind: "cross"; face: Face }
  | { kind: "firstLayer"; face: Face }
  | { kind: "twoLayers"; face: Face };

/** Достигнута ли цель шага в этом состоянии. */
export function isGoalReached(state: CubeState, goal: LessonGoal): boolean {
  switch (goal.kind) {
    case "solved":
      return isSolved(state);
    case "cross":
      return isCrossSolved(state, goal.face);
    case "firstLayer":
      return isFirstLayerSolved(state, goal.face);
    case "twoLayers":
      return areTwoLayersSolved(state, goal.face);
  }
}

/** Человеческое название цели — им подписывается шаг на экране. */
export function goalLabel(goal: LessonGoal): string {
  switch (goal.kind) {
    case "solved":
      return "куб собран";
    case "cross":
      return `крест на грани ${goal.face}`;
    case "firstLayer":
      return `первый слой на грани ${goal.face}`;
    case "twoLayers":
      return `два слоя на грани ${goal.face}`;
  }
}

export interface LessonStep {
  /** Устойчивый идентификатор: на него будет ссылаться прогресс в задаче G. */
  id: string;
  title: string;
  /** Объяснение обычным языком: что перед глазами и что сейчас произойдёт. */
  explanation: string;
  /** Последовательность от собранного куба, ставящая позицию шага. */
  setup: string;
  /** Разучиваемый алгоритм. */
  algorithm: string;
  /** Что обязано стать правдой после алгоритма. */
  goal: LessonGoal;
}

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  steps: LessonStep[];
}
