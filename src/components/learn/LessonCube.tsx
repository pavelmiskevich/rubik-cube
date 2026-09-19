"use client";

import dynamic from "next/dynamic";
import type { RubiksCubeRef } from "@/components/cube/RubiksCube";

/** Запасной статичный вариант: показывается, пока грузится чанк с кубом. */
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
  Те же приёмы, что на лендинге в CubeHero: ssr: false нельзя объявить в
  серверном компоненте, поэтому обёртка клиентская, а куб уезжает в отдельный
  чанк и не блокирует первый экран урока — текст шага читается сразу.
*/
const RubiksCube = dynamic(() => import("@/components/cube/RubiksCube"), {
  ssr: false,
  loading: () => <CubePoster />,
});

/**
 * Куб урока.
 *
 * Наружу отдаётся не ref, а callback: `onCube` вызывается ровно тогда, когда
 * куб смонтировался, и с null, когда он ушёл. Это важно именно здесь — куб
 * приезжает отдельным чанком уже после первой отрисовки, и владелец обязан
 * узнать о его появлении, а не проверять ref наугад.
 *
 * В отличие от лендинга, при prefers-reduced-motion куб не подменяется
 * картинкой: на уроке он и есть содержание, и убрать его значит убрать урок.
 * Уважение к настройке выражено иначе — проигрыватель отдаёт повороты почти
 * нулевой длительности, и ходы происходят рывком, без плавной анимации.
 */
export default function LessonCube({
  onCube,
}: {
  onCube: (cube: RubiksCubeRef | null) => void;
}) {
  return (
    <div className="h-[340px] w-full min-w-0 overflow-hidden sm:h-[440px] [&>div]:min-h-0">
      <RubiksCube ref={onCube} />
    </div>
  );
}
