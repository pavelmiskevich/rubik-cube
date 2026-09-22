"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { FACE_SIZE, Sticker, checkFacelets, faceletIndex } from "@/lib/cube/facelets";
import { moveCount, solutionFor } from "./solution";
import {
  Painting,
  countOf,
  emptyPainting,
  finishedPainting,
  isCentre,
  paintSticker,
  remaining,
  solvedPainting,
} from "./painting";
import {
  BRUSHES,
  BRUSH_KEYS,
  FACE_NAME,
  STICKER_FILL,
  STICKER_NAME,
  stickerCount,
} from "./palette";

/*
  Развёртка: шесть граней крестом, как кубик разложили бы на столе. На узком
  экране крест не помещается — там те же шесть граней идут в два столбца, и
  каждая подписана, поэтому порядок не приходится угадывать.
*/
const NET_ORDER: readonly Sticker[] = ["U", "L", "F", "R", "B", "D"];

const NET_PLACE: Readonly<Record<Sticker, string>> = {
  U: "sm:col-start-2 sm:row-start-1",
  L: "sm:col-start-1 sm:row-start-2",
  F: "sm:col-start-2 sm:row-start-2",
  R: "sm:col-start-3 sm:row-start-2",
  B: "sm:col-start-4 sm:row-start-2",
  D: "sm:col-start-2 sm:row-start-3",
};

const ROWS = Array.from({ length: FACE_SIZE }, (_, row) => row);

/** Ластик — тот же мазок, только пустой. */
type Brush = Sticker | null;

function StickerButton({
  index,
  value,
  label,
  flagged,
  onPaint,
}: {
  index: number;
  value: Sticker | null;
  label: string;
  flagged: boolean;
  /** Без цвета — красит выбранным в палитре. */
  onPaint: (index: number, brush?: Brush) => void;
}) {
  const locked = isCentre(index);

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onPaint(index)}
      onKeyDown={(event) => {
        const brush = BRUSH_KEYS[event.key];
        if (brush) {
          event.preventDefault();
          onPaint(index, brush);
        } else if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          onPaint(index, null);
        }
      }}
      aria-label={`${label}: ${value ? STICKER_NAME[value] : "не заполнено"}`}
      style={value ? { backgroundColor: STICKER_FILL[value] } : undefined}
      className={[
        "h-10 w-10 rounded-[0.4rem] border transition-shadow",
        value ? "" : "border-dashed bg-surface-2",
        locked ? "cursor-default" : "cursor-pointer",
        flagged ? "outline outline-2 outline-offset-2 outline-danger" : "",
      ].join(" ")}
    />
  );
}

export default function SolveWorkspace() {
  const [painting, setPainting] = useState<Painting>(emptyPainting);
  const [brush, setBrush] = useState<Brush>("U");

  const facelets = finishedPainting(painting);
  const check = useMemo(() => (facelets ? checkFacelets(facelets) : null), [facelets]);

  /*
    Обводим только то, на что и правда стоит смотреть. Проблема со счётом цвета
    перечисляет все наклейки этого цвета — их до десяти штук, и обведённые они
    читаются как «здесь всё неверно». Для счёта уже есть честный указатель:
    «10/9» в палитре.
  */
  /*
    Решение считается разом, как только раскраска принята: послойный разбор
    занимает миллисекунды, ждать нечего, и кнопка «решить» была бы лишним
    щелчком между человеком и ответом.
  */
  const solution = useMemo(
    () => (check?.ok === true ? solutionFor(check.state) : null),
    [check]
  );

  const flagged = useMemo(() => {
    if (!check || check.ok) return new Set<number>();
    return new Set(
      check.problems
        .filter((problem) => problem.kind !== "colourCount")
        .flatMap((problem) => problem.facelets)
    );
  }, [check]);

  /* Клик ставит выбранный цвет; цифра на клавиатуре — свой, минуя палитру. */
  const handlePaint = (index: number, chosen?: Brush) => {
    if (chosen !== undefined) setBrush(chosen);
    setPainting((current) => paintSticker(current, index, chosen === undefined ? brush : chosen));
  };

  const left = remaining(painting);

  return (
    <div className="space-y-6">
      <section aria-labelledby="palette-title" className="space-y-3">
        <h2 id="palette-title" className="text-sm font-semibold text-muted">
          Цвет
        </h2>
        <div className="flex flex-wrap gap-2">
          {BRUSHES.map((sticker, position) => {
            const count = countOf(painting, sticker);
            const active = brush === sticker;

            return (
              <button
                key={sticker}
                type="button"
                aria-pressed={active}
                onClick={() => setBrush(sticker)}
                className={`flex items-center gap-2 rounded-control border px-3 py-2 text-sm ${
                  active ? "border-accent-text bg-surface-2 font-semibold" : "bg-surface"
                }`}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-[0.25rem] border"
                  style={{ backgroundColor: STICKER_FILL[sticker] }}
                />
                <span>{STICKER_NAME[sticker]}</span>
                <span className={count === 9 ? "text-muted" : "text-accent-text"}>
                  {count}/9
                </span>
                <span className="text-muted">{position + 1}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={brush === null}
            onClick={() => setBrush(null)}
            className={`rounded-control border px-3 py-2 text-sm ${
              brush === null ? "border-accent-text bg-surface-2 font-semibold" : "bg-surface"
            }`}
          >
            Стереть
          </button>
        </div>
        <p className="text-sm text-muted">
          Выберите цвет и нажимайте на наклейки этого цвета. С клавиатуры: цифры
          1–6 ставят цвет на выбранной наклейке, Backspace стирает.
        </p>
      </section>

      <div className="mx-auto grid w-fit grid-cols-2 gap-4 sm:grid-cols-4">
        {NET_ORDER.map((face) => (
          <section
            key={face}
            aria-label={`Грань «${FACE_NAME[face]}», центр ${STICKER_NAME[face]}`}
            className={NET_PLACE[face]}
          >
            <h3 className="mb-1 text-xs font-semibold text-muted">
              {FACE_NAME[face]}
              <span className="ml-1 font-normal">· {STICKER_NAME[face]} центр</span>
            </h3>
            <div className="grid grid-cols-3 gap-1">
              {ROWS.map((row) =>
                ROWS.map((column) => {
                  const index = faceletIndex(face, row, column);
                  return (
                    <StickerButton
                      key={index}
                      index={index}
                      value={painting[index]}
                      label={`${FACE_NAME[face]}, ряд ${row + 1}, столбец ${column + 1}`}
                      flagged={flagged.has(index)}
                      onPaint={handlePaint}
                    />
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setPainting(solvedPainting())}>
          Заполнить как собранный
        </Button>
        <Button variant="ghost" onClick={() => setPainting(emptyPainting())}>
          Очистить
        </Button>
      </div>

      {/*
        Итог читают и глазами, и с экранного диктора, поэтому он в одной живой
        области: заполнилась последняя наклейка — вердикт сразу здесь, отдельной
        кнопки «проверить» нет.
      */}
      <div aria-live="polite">
        {check === null && (
          <Card>
            <h2 className="font-semibold">Осталось назвать {stickerCount(left)}</h2>
            <p className="mt-2 text-muted">
              Держите кубик белой гранью вверх и зелёной к себе — тогда грани на
              экране совпадут с теми, что у вас в руках. Центры уже стоят: они не
              двигаются и задают цвет грани.
            </p>
          </Card>
        )}

        {check?.ok === false && (
          <Card className="border-danger">
            <h2 className="font-semibold text-danger">Такого кубика быть не может</h2>
            <p className="mt-2 text-muted">
              Раскраска заполнена целиком, но собрать такой кубик нельзя. Вот что
              не сходится:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {check.problems.map((problem) => (
                <li key={problem.message}>{problem.message}</li>
              ))}
            </ul>
            {flagged.size > 0 && (
              <p className="mt-3 text-sm text-muted">
                Наклейки, которые стоит проверить, обведены на развёртке.
              </p>
            )}
          </Card>
        )}

        {check?.ok === true && solution?.kind === "solved" && (
          <Card>
            <h2 className="font-semibold">Этот кубик уже собран</h2>
            <p className="mt-2 text-muted">
              Собирать нечего. Если хотите потренироваться, перемешайте кубик и
              заполните развёртку заново — или пройдите курс с начала.
            </p>
            <div className="mt-4">
              <Link href="/learn">
                <Button>К урокам</Button>
              </Link>
            </div>
          </Card>
        )}

        {solution?.kind === "steps" && (
          <Card>
            <h2 className="font-semibold">Как собрать этот кубик</h2>
            <p className="mt-2 text-muted">
              {moveCount(solution.total)} по шагам курса. Держите кубик так же,
              как заполняли развёртку: белый верх, зелёный к себе. Каждый шаг —
              отдельный урок, и если по буквам непонятно, урок объясняет их
              словами.
            </p>

            <ol className="mt-4 space-y-4">
              {solution.steps.map((step, position) => (
                <li key={step.lessonSlug} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-muted">{position + 1}.</span>
                    <h3 className="font-semibold">{step.title}</h3>
                    <span className="text-sm text-muted">{moveCount(step.count)}</span>
                  </div>
                  {/* Ходы переносятся по словам: шаг углов бывает и в полсотни. */}
                  <p className="mt-2 break-words font-mono text-sm">{step.moves}</p>
                  <Link href={step.href} className="mt-2 inline-block text-sm text-accent-text">
                    Урок: {step.title}
                  </Link>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-sm text-muted">
              Решение длинное намеренно. Короткое — это два десятка ходов,
              которые не объясняют ничего; здесь же вы собираете кубик теми же
              приёмами, что и в курсе, и после нескольких раз соберёте его без
              подсказки.
            </p>
          </Card>
        )}

        {solution?.kind === "failed" && (
          <Card className="border-danger">
            <h2 className="font-semibold text-danger">Не получилось разобрать положение</h2>
            <p className="mt-2 text-muted">
              Раскраска прошла проверку, но собрать по ней решение не вышло —
              это ошибка платформы, а не ваша. Проверьте, что цвета на развёртке
              совпадают с кубиком в руках, и попробуйте ещё раз.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
