import type { CubeState } from "@/lib/cube/state";
import type { Face } from "@/lib/cube/moves";
import {
  areLastLayerCornersPlaced,
  areTwoLayersSolved,
  isCrossSolved,
  isFirstLayerSolved,
  isLastLayerCrossFormed,
  isLastLayerOriented,
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
  | { kind: "twoLayers"; face: Face }
  /** Цели последнего слоя: `face` — сам последний слой, в курсе это U. */
  | { kind: "lastLayerCross"; face: Face }
  | { kind: "lastLayerOriented"; face: Face }
  | { kind: "lastLayerCorners"; face: Face };

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
    case "lastLayerCross":
      return isLastLayerCrossFormed(state, goal.face);
    case "lastLayerOriented":
      return isLastLayerOriented(state, goal.face);
    case "lastLayerCorners":
      return areLastLayerCornersPlaced(state, goal.face);
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
    case "lastLayerCross":
      return `крест на последнем слое, грань ${goal.face}`;
    case "lastLayerOriented":
      return `грань ${goal.face} целиком одного цвета`;
    case "lastLayerCorners":
      return `углы последнего слоя на местах, грань ${goal.face}`;
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

/**
 * Схема последнего слоя рядом с кубом: вид сверху и верхний ряд боков.
 *
 * Куб на экране показывает три грани из шести, а случай последнего слоя
 * узнают по всем четырём бокам. `orientation` рисует только белое и серое —
 * при ориентации остальные цвета не важны; `permutation` — все цвета.
 */
export type CaseDiagram = "orientation" | "permutation";

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  steps: LessonStep[];
  /** Урок учит узнавать случаи последнего слоя — у шага есть схема. */
  diagram?: CaseDiagram;
  /**
   * Что замерять на таймере после урока. Есть у уроков, которые учат
   * собирать быстрее: у них с урока ведёт ссылка на таймер, и таймер
   * показывает, что именно сейчас тренируется.
   */
  practice?: string;
}
