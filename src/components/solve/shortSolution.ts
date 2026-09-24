import { CubeState } from "@/lib/cube/state";

/*
  Короткое решение для экрана: что уходит в фоновый поток и что приходит
  обратно.

  Поиск идёт в Web Worker, а не в основном потоке с уступками по таймеру. Две
  причины. Первая — таблицы: первый запуск строит их треть секунды подряд, и
  дробить это построение на куски ради уступок значило бы переписать его хуже.
  Вторая — поиск: он рекурсивный, и уступать посреди рекурсии можно, только
  превратив её в явный стек. В фоновом потоке и то и другое остаётся простым
  кодом, а вкладка не замирает ни на миг — ни на построении, ни на поиске.

  Сам обмен — чистые функции, чтобы его было чем проверить без браузера:
  поток лишь передаёт запрос в `answerShortSolve` и отправляет ответ назад.
  Этот файл решателя не импортирует: его читает страница, а код поиска и
  таблиц нужен только фоновому потоку и в основной бандл попадать не должен.
*/

export interface ShortSolveRequest {
  /** Номер запроса: ответ на устаревший запрос экран отбрасывает. */
  id: number;
  state: CubeState;
}

export type ShortSolveResponse =
  | {
      id: number;
      kind: "moves";
      /** Ходы в нотации курса; пустая строка — кубик уже собран. */
      moves: string;
      count: number;
      /** Сколько занял поиск, вместе с таблицами, если строились они. */
      ms: number;
      /** Строились ли таблицы в этом запросе — первый запуск дольше. */
      builtTables: boolean;
    }
  | { id: number; kind: "failed" };

/** Что показывает экран в режиме «коротко». */
export type ShortSolution =
  | { kind: "working" }
  | { kind: "solved" }
  | { kind: "moves"; moves: string; count: number }
  | { kind: "failed" };

export function toShortSolution(response: ShortSolveResponse): ShortSolution {
  if (response.kind === "failed") return { kind: "failed" };
  if (response.count === 0) return { kind: "solved" };
  return { kind: "moves", moves: response.moves, count: response.count };
}

/**
 * Ключ положения: по нему экран узнаёт, что ответ относится к тому кубику,
 * который сейчас на развёртке, а не к тому, что был до последнего клика.
 */
export function stateKey(state: CubeState): string {
  return [
    state.cornerPermutation,
    state.cornerOrientation,
    state.edgePermutation,
    state.edgeOrientation,
  ]
    .map((part) => part.join(","))
    .join("|");
}
