"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { Sticker } from "@/lib/cube/facelets";
import { FACE_NAME, STICKER_FILL, STICKER_NAME } from "../palette";
import { CAPTURE_ORDER, HOLD_HINT, PROBLEM_TEXT } from "./capturePlan";
import { FaceSamples, Recognition, isTooDark, recognise, sameCentreAs } from "./recognition";
import { sampleFace, GUIDE_SHARE } from "./sampling";
import { useCameraStream } from "./useCameraStream";

type Taken = Partial<Record<Sticker, FaceSamples>>;

/** Снимок, который не взят сразу: центр как у уже снятой грани. */
interface Pending {
  readonly face: Sticker;
  readonly samples: FaceSamples;
  readonly like: Sticker;
}

const CELLS = Array.from({ length: 9 }, (_, cell) => cell);
const GUIDE_INSET = `${((1 - GUIDE_SHARE) / 2) * 100}%`;

const nextFace = (taken: Taken): Sticker | null =>
  CAPTURE_ORDER.find((face) => !taken[face]) ?? null;

const rgbCss = ([r, g, b]: readonly number[]): string => `rgb(${r}, ${g}, ${b})`;

/** Беды, после которых повторять бессмысленно, пока что-то не поменяется снаружи. */
const FINAL = new Set(["insecure", "unsupported", "missing"]);

/** Уводит к развёртке: ручной ввод всегда рядом и работает без камеры. */
function toManual() {
  document.getElementById("palette-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Съёмка шести граней. Результат — не ответ, а заполненная развёртка: её
 * человек проверяет глазами и правит руками, а собираемость проверяет тот же
 * код, что и при ручном вводе.
 */
export default function CameraCapture({
  onRecognised,
}: {
  onRecognised: (result: Recognition) => void;
}) {
  const { videoRef, status, problem, start, stop, grab } = useCameraStream();
  const [taken, setTaken] = useState<Taken>({});
  /** Какую грань снимаем; `null` — следующую по порядку. */
  const [chosen, setChosen] = useState<Sticker | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<Recognition | null>(null);

  const current = chosen ?? nextFace(taken);
  const shooting = status === "starting" || status === "live";
  const takenCount = CAPTURE_ORDER.filter((face) => taken[face]).length;

  const accept = (face: Sticker, samples: FaceSamples) => {
    const next = { ...taken, [face]: samples };
    setTaken(next);
    setChosen(null);
    setPending(null);
    setNotice(null);

    if (nextFace(next) === null) {
      const recognition = recognise(next as Record<Sticker, FaceSamples>);
      stop();
      setResult(recognition);
      onRecognised(recognition);
    }
  };

  const shoot = () => {
    if (!current) return;
    const image = grab();
    if (!image) {
      setNotice("Камера ещё не показала кадр — подождите секунду и снимите снова.");
      return;
    }

    const samples = sampleFace(image);
    if (isTooDark(samples)) {
      setPending(null);
      setNotice(
        "Слишком темно: цвета на снимке не различить. Включите свет или подойдите к окну и снимите грань снова."
      );
      return;
    }

    const like = sameCentreAs(taken, current, samples);
    if (like) {
      setPending({ face: current, samples, like });
      setNotice(null);
      return;
    }

    accept(current, samples);
  };

  /** Включить камеру: доснять недостающие грани или, с `afresh`, всё заново. */
  const begin = (afresh = false) => {
    setResult(null);
    setNotice(null);
    setPending(null);
    if (afresh) {
      setTaken({});
      setChosen(null);
    }
    void start();
  };

  const retake = (face: Sticker) => {
    setChosen(face);
    setPending(null);
    setNotice(null);
    if (!shooting) begin();
  };

  const cancel = () => {
    stop();
    setPending(null);
    setNotice(null);
  };

  const privacy = (
    <p className="text-sm text-muted">
      Снимки не покидают устройство: цвета распознаются прямо в браузере, на
      сервер не отправляется ни один кадр.
    </p>
  );

  return (
    <Card>
      <section aria-labelledby="camera-title" className="space-y-4">
        <h2 id="camera-title" className="font-semibold">
          Снять кубик камерой
        </h2>

        {status === "problem" && problem && (
          <div role="alert" className="space-y-2">
            <p className="font-semibold text-danger">{PROBLEM_TEXT[problem].title}</p>
            <p className="text-muted">{PROBLEM_TEXT[problem].body}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={toManual}>Заполнить вручную</Button>
              {!FINAL.has(problem) && (
                <Button variant="secondary" onClick={() => begin()}>
                  Попробовать снова
                </Button>
              )}
            </div>
          </div>
        )}

        {status === "idle" && !result && (
          <div className="space-y-3">
            <p className="text-muted">
              Шесть снимков, по одному на грань, — и развёртка ниже заполнится
              сама. Потом сверьте её с кубиком и поправьте, если камера ошиблась.
            </p>
            {privacy}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => begin()}>
                {takenCount > 0 ? "Доснять грани" : "Включить камеру"}
              </Button>
              <Button variant="ghost" onClick={toManual}>
                Ввести вручную
              </Button>
            </div>
          </div>
        )}

        {result && status === "idle" && (
          <div className="space-y-3">
            <p>
              Развёртка заполнена по снимкам.{" "}
              {result.doubtful.length > 0
                ? `Сверьте её с кубиком: наклейки, в цвете которых камера не уверена, обведены пунктиром — их ${result.doubtful.length}.`
                : "Сверьте её с кубиком в руках и поправьте, если что-то не совпало."}
            </p>
            <p className="text-sm text-muted">
              Если ниже написано, что такого кубика быть не может, скорее всего
              камера спутала похожие цвета — красный с оранжевым или белый с
              жёлтым. Поправьте эти наклейки руками или переснимите грань.
            </p>
            <Button variant="secondary" onClick={() => begin(true)}>
              Снять заново
            </Button>
          </div>
        )}

        {shooting && current && (
          <div className="space-y-3">
            <div aria-live="polite">
              <p className="font-semibold">
                Грань {CAPTURE_ORDER.indexOf(current) + 1} из 6 · {STICKER_NAME[current]} центр
              </p>
              <p className="text-muted">{HOLD_HINT[current]}</p>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card bg-black">
              {/*
                Кадр не отражается: камера смотрит на грань так же, как смотрел
                бы человек, и лево в кадре — лево на развёртке.
              */}
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                aria-label="Изображение с камеры"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden
                className="absolute grid grid-cols-3 grid-rows-3"
                style={{ inset: GUIDE_INSET }}
              >
                {CELLS.map((cell) => (
                  <div
                    key={cell}
                    className="border border-white/80"
                    style={
                      cell === 4
                        ? { boxShadow: `inset 0 0 0 4px ${STICKER_FILL[current]}` }
                        : undefined
                    }
                  />
                ))}
              </div>
              {status === "starting" && (
                <p className="absolute inset-x-0 bottom-3 text-center text-sm text-white">
                  Ждём разрешения на камеру…
                </p>
              )}
            </div>

            {/* Кнопка сразу под кадром: на телефоне до неё не нужно листать. */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={shoot} disabled={status !== "live"}>
                Снять грань
              </Button>
              <Button variant="ghost" onClick={cancel}>
                Остановить камеру
              </Button>
            </div>

            <div aria-live="polite">
              {notice && <p className="text-danger">{notice}</p>}
              {pending && (
                <div className="space-y-2">
                  <p className="text-danger">
                    Центр на снимке похож на уже снятую грань «{FACE_NAME[pending.like]}».
                    Покажите грань, у которой в середине {STICKER_NAME[pending.face]} цвет,
                    — или оставьте снимок, если уверены, что держите нужную.
                  </p>
                  <Button variant="secondary" onClick={() => accept(pending.face, pending.samples)}>
                    Оставить этот снимок
                  </Button>
                </div>
              )}
            </div>

            <p className="text-sm text-muted">
              Совместите грань с сеткой, чтобы каждая наклейка попала в свою
              клетку. Центр обведён цветом, который должен в нём оказаться.
            </p>
            {privacy}
          </div>
        )}

        {(shooting || takenCount > 0) && (
          <ul aria-label="Снятые грани" className="flex flex-wrap gap-3">
            {CAPTURE_ORDER.map((face) => {
              const samples = taken[face];
              return (
                <li key={face}>
                  <button
                    type="button"
                    disabled={!samples}
                    onClick={() => retake(face)}
                    aria-label={
                      samples
                        ? `Переснять грань «${FACE_NAME[face]}»`
                        : `Грань «${FACE_NAME[face]}» ещё не снята`
                    }
                    className={`flex flex-col items-center gap-1 rounded-control p-1 text-xs ${
                      face === current && shooting ? "ring-2 ring-accent-text" : ""
                    } ${samples ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <span className="grid grid-cols-3 gap-px">
                      {CELLS.map((cell) => (
                        <span
                          key={cell}
                          className={`h-3 w-3 rounded-[2px] ${samples ? "" : "border border-dashed"}`}
                          style={samples ? { backgroundColor: rgbCss(samples[cell]) } : undefined}
                        />
                      ))}
                    </span>
                    <span className="text-muted">{FACE_NAME[face]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {(shooting || takenCount > 0) && (
          <p className="text-xs text-muted">
            Миниатюры — цвета, как их увидела камера. Нажмите на снятую грань, чтобы переснять её.
          </p>
        )}
      </section>
    </Card>
  );
}
