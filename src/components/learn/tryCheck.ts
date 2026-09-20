/**
 * Режим «Попробовать»: что урок думает о ходах, которые человек сделал сам.
 *
 * После каждого хода урок отвечает на два вопроса, и отвечает на них порознь.
 *
 * **Выполнен ли шаг** — решает только предикат цели. Буквы, которые человек
 * накрутил, здесь не спрашиваются: цель либо достигнута на кубе, либо нет.
 * Поэтому отклонение, которое не привело к цели, никогда не выдаётся за успех,
 * а верный алгоритм, сделанный не в том порядке, не засчитывается «за старание».
 *
 * **Не сбился ли человек** — сверка с эталонным алгоритмом, и сверяются
 * состояния, а не записи ходов. Жест всегда присылает четверть оборота, так
 * что `F2` приходит как `F F` или `F' F'`, а случайный поворот, тут же
 * отменённый, оставляет в истории пару `R R'`. Сравнивать буквы значило бы
 * объявить сбившимся человека, который всё сделал верно. Сравнение позиций
 * таких ловушек не знает: путь алгоритма — это список позиций, и человек на
 * пути, пока куб стоит в одной из них.
 *
 * Отсюда же подсказка. Пока человек на пути — это следующий ход алгоритма.
 * Сбился — ходы, отменяющие всё, что накручено после последней позиции на
 * пути, и дальше остаток алгоритма. Каждый подсказанный ход сокращает этот
 * план хотя бы на один ход: подсказка всегда приближает к цели, а не просто
 * называет «какой-нибудь» ход.
 *
 * Модуль чистый — ни React, ни куба. Всё, что здесь утверждается, закрыто
 * тестом, в том числе сквозным прогоном по всем шагам курса.
 */

import type { LessonStep } from "@/content/lessons/types";
import { isGoalReached } from "@/content/lessons/types";
import { equals, type CubeState } from "@/lib/cube/state";
import {
  applyMove,
  applyNotation,
  invertSequence,
  parseSequence,
  type Face,
  type Move,
  type Turn,
} from "@/lib/cube/moves";

/**
 * - `start` — куб в стартовой позиции шага: ходов не было или они сократились;
 * - `on-track` — человек на пути алгоритма;
 * - `off-track` — сбился, цель не достигнута;
 * - `done` — цель шага достигнута.
 */
export type TryStatus = "start" | "on-track" | "off-track" | "done";

export interface TryAssessment {
  status: TryStatus;
  /** Сколько ходов алгоритма пройдено целиком. */
  progress: number;
  /** Сколько ходов в алгоритме шага. */
  total: number;
  /** Куб стоит в позиции с пути алгоритма. При `done` — дошёл ли человек именно алгоритмом. */
  onAlgorithm: boolean;
  /** Сколько ходов отделяет куб от пути алгоритма; 0, пока человек на пути. */
  stray: number;
  /** Ходы, доводящие куб от текущей позиции до цели. Пуст, когда цель достигнута. */
  plan: Move[];
  /** Следующий ход плана или null, когда подсказывать нечего. */
  hint: Move | null;
}

export type TryStep = Pick<LessonStep, "setup" | "algorithm" | "goal">;

/**
 * Сокращает соседние повороты одной грани: `R R` → `R2`, `R R'` → ничего.
 *
 * Позиция от этого не меняется, меняется только запись. Жест присылает
 * четверти оборота, и без сокращения подсказка «отмени» предлагала бы
 * отматывать ходы, которые уже взаимно уничтожились.
 */
export function simplify(moves: readonly Move[]): Move[] {
  const stack: Move[] = [];
  for (const move of moves) {
    const top = stack[stack.length - 1];
    if (top && top.face === move.face) {
      const turn = (top.turn + move.turn) % 4;
      stack.pop();
      if (turn !== 0) stack.push({ face: move.face, turn: turn as Turn });
    } else {
      stack.push(move);
    }
  }
  return stack;
}

/** Позиция на пути алгоритма и то, что от неё осталось сделать. */
interface Checkpoint {
  state: CubeState;
  /** Сколько ходов алгоритма пройдено целиком. */
  progress: number;
  remaining: Move[];
}

/**
 * Все позиции пути алгоритма.
 *
 * Кроме позиций после каждого хода, сюда входят середины пол-оборотов: `F2`
 * человек делает двумя жестами, и между ними он не сбился. Середин две —
 * крутить можно в любую сторону, и дальше подсказывается та же четверть.
 */
function checkpoints(start: CubeState, algorithm: readonly Move[]): Checkpoint[] {
  const result: Checkpoint[] = [];
  let state = start;

  algorithm.forEach((move, index) => {
    result.push({ state, progress: index, remaining: algorithm.slice(index) });
    if (move.turn === 2) {
      for (const turn of [1, 3] as const) {
        const quarter: Move = { face: move.face, turn };
        result.push({
          state: applyMove(state, quarter),
          progress: index,
          remaining: [quarter, ...algorithm.slice(index + 1)],
        });
      }
    }
    state = applyMove(state, move);
  });
  result.push({ state, progress: algorithm.length, remaining: [] });

  return result;
}

/** Ближайшая к цели позиция пути, совпадающая с этой, или null. */
function locate(path: readonly Checkpoint[], state: CubeState): Checkpoint | null {
  let best: Checkpoint | null = null;
  for (const checkpoint of path) {
    if (!equals(checkpoint.state, state)) continue;
    if (!best || checkpoint.remaining.length < best.remaining.length) best = checkpoint;
  }
  return best;
}

/** Оценка хода шага по истории ходов, сделанных человеком от его стартовой позиции. */
export function assessTry(step: TryStep, history: readonly Move[]): TryAssessment {
  const start = applyNotation(step.setup);
  const algorithm = parseSequence(step.algorithm);
  const path = checkpoints(start, algorithm);
  const total = algorithm.length;

  // Позиции после каждого хода истории: нужны, чтобы найти последнюю на пути.
  const states: CubeState[] = [start];
  for (const move of history) states.push(applyMove(states[states.length - 1], move));
  const current = states[states.length - 1];

  const here = locate(path, current);

  if (isGoalReached(current, step.goal)) {
    return {
      status: "done",
      progress: total,
      total,
      onAlgorithm: here !== null,
      stray: 0,
      plan: [],
      hint: null,
    };
  }

  if (here) {
    // План сокращается и здесь, а не только в ветке возврата. Алгоритм урока
    // может повторять последовательность дважды, и на стыке повторов стоит
    // пара вроде `F' F`: крутить её незачем, позиция от неё не меняется. Пока
    // остаток брался сырым, план на пути оказывался длиннее плана возврата — и
    // подсказка, вернувшая человека на путь, «удлиняла» путь до цели.
    const plan = simplify(here.remaining);
    return {
      status: here === path[0] ? "start" : "on-track",
      progress: here.progress,
      total,
      onAlgorithm: true,
      stray: 0,
      plan,
      hint: plan[0] ?? null,
    };
  }

  // Сбился: ищем последнюю позицию истории, которая была на пути. Стартовая
  // позиция на пути всегда, так что поиск не бывает пустым.
  let anchorIndex = 0;
  let anchor = path[0];
  for (let index = states.length - 2; index >= 0; index--) {
    const found = locate(path, states[index]);
    if (found) {
      anchorIndex = index;
      anchor = found;
      break;
    }
  }

  const recovery = invertSequence(simplify(history.slice(anchorIndex)));
  const plan = simplify([...recovery, ...anchor.remaining]);

  return {
    status: "off-track",
    progress: anchor.progress,
    total,
    onAlgorithm: false,
    stray: recovery.length,
    plan,
    hint: plan[0] ?? null,
  };
}

const FACE_NAME: Readonly<Record<Face, string>> = {
  U: "верхнюю",
  D: "нижнюю",
  L: "левую",
  R: "правую",
  F: "переднюю",
  B: "заднюю",
};

const TURN_NAME: Readonly<Record<Turn, string>> = {
  1: "по часовой стрелке",
  2: "на пол-оборота",
  3: "против часовой стрелки",
};

/**
 * Ход словами: «правую грань по часовой стрелке». Подсказка адресована
 * новичку, которому буква `R` ещё ничего не говорит.
 */
export function describeMove(move: Move): string {
  return `${FACE_NAME[move.face]} грань ${TURN_NAME[move.turn]}`;
}
