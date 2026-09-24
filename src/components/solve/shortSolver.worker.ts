import { ShortSolveRequest, ShortSolveResponse } from "./shortSolution";
import { answerShortSolve } from "./answerShortSolve";

/*
  Фоновый поток короткого решателя. Живёт, пока открыт экран `/solve`, и
  держит таблицы поиска: их строит первый запрос, остальные берут готовые.
  Вся логика — в `answerShortSolve.ts`, здесь только почтальон.
*/

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ShortSolveRequest>) => void) | null;
  postMessage(message: ShortSolveResponse): void;
};

scope.onmessage = (event) => {
  scope.postMessage(answerShortSolve(event.data));
};
