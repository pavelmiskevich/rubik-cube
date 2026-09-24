"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ShortSolution } from "./shortSolution";
import { moveCount } from "./solution";

/*
  Два ответа на один кубик. «Понятно» — решение курса, по урокам; «коротко» —
  два десятка ходов без объяснений, для того, кто уже умеет собирать. Первым
  всегда стоит «понятно»: платформа учит, и короткий ответ — дополнение к
  курсу, а не замена ему.
*/

export type SolutionMode = "clear" | "short";

const MODE_LABEL: Readonly<Record<SolutionMode, string>> = {
  clear: "Понятно",
  short: "Коротко",
};

export function SolutionModeSwitch({
  mode,
  onChange,
}: {
  mode: SolutionMode;
  onChange: (mode: SolutionMode) => void;
}) {
  return (
    <div className="mb-4 flex gap-2" role="group" aria-label="Вид решения">
      {(["clear", "short"] as const).map((value) => (
        <Button
          key={value}
          variant={mode === value ? "primary" : "secondary"}
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          {MODE_LABEL[value]}
        </Button>
      ))}
    </div>
  );
}

export function ShortSolutionCard({ solution }: { solution: ShortSolution }) {
  if (solution.kind === "failed") {
    return (
      <Card className="border-danger">
        <h2 className="font-semibold text-danger">Короткое решение не нашлось</h2>
        <p className="mt-2 text-muted">
          Это ошибка платформы, а не ваша: раскраска прошла проверку. Решение
          по шагам курса доступно в режиме «понятно».
        </p>
      </Card>
    );
  }

  if (solution.kind === "working") {
    return (
      <Card>
        <h2 className="font-semibold">Ищу короткое решение…</h2>
        <p className="mt-2 text-muted">
          В первый раз это занимает до пары секунд: платформа готовит таблицы
          поиска. Следующие кубики решаются быстрее.
        </p>
      </Card>
    );
  }

  if (solution.kind === "solved") {
    return (
      <Card>
        <h2 className="font-semibold">Этот кубик уже собран</h2>
        <p className="mt-2 text-muted">Короткое решение пустое: делать нечего.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-semibold">Короткое решение</h2>
      <p className="mt-2 text-muted">
        {moveCount(solution.count)}. Держите кубик так же, как заполняли
        развёртку: белый верх, зелёный к себе.
      </p>
      <p className="mt-4 break-words font-mono text-lg">{solution.moves}</p>
      <p className="mt-6 text-sm text-muted">
        Объяснений здесь нет: ходы найдены перебором, а не приёмами курса.
        Поиск останавливается на решении не длиннее двадцати одного хода
        или через секунду — это не обязательно самый короткий путь, но близко к
        нему. Разобрать сборку по шагам поможет режим «понятно».
      </p>
    </Card>
  );
}
