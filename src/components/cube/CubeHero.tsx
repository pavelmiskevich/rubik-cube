"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/** Запасной статичный вариант: показывается до загрузки и при reduced-motion. */
function CubePoster() {
  return (
    <div
      className="grid h-full w-full place-items-center rounded-card border bg-surface-2"
      aria-hidden
    >
      <div className="grid rotate-12 grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className="h-8 w-8 rounded-[4px] border bg-surface" />
        ))}
      </div>
    </div>
  );
}

/*
  ssr: false в серверном компоненте использовать нельзя — Next это прямо
  запрещает, поэтому обёртка клиентская. Куб грузится отдельным чанком и не
  блокирует отрисовку первого экрана.
*/
const RubiksCube = dynamic(() => import("./RubiksCube"), {
  ssr: false,
  loading: () => <CubePoster />,
});

export default function CubeHero() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Настройка известна только на клиенте, до монтирования её не прочитать.
    // Подавление правила здесь не нужно: вызов спрятан за функцией, и
    // react-hooks/set-state-in-effect на него не срабатывает.
    const apply = () => setAnimated(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    /*
      min-w-0 — иначе холст задаёт колонке минимальную ширину по содержимому, и
      grid отказывается её сжимать: на узком экране за вьюпорт уезжает весь
      первый экран, а не только куб.

      overflow-hidden и min-h-0 у потомка — потому что RubiksCube несёт
      min-h-[400px], которая перебивает высоту слота и наезжает на карточки
      ниже. Правим здесь, а не в RubiksCube: он общий с /trainer, где 400 px
      уместны.
    */
    <div className="h-[320px] w-full min-w-0 overflow-hidden sm:h-[420px] [&>div]:min-h-0">
      {animated ? <RubiksCube /> : <CubePoster />}
    </div>
  );
}
