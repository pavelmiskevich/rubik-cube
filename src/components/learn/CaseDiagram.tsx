import { BODY_COLOR, STICKER_COLORS } from "@/components/cube/cubeTheme";
import type { CaseDiagram as DiagramKind } from "@/content/lessons";
import type { Face } from "@/lib/cube/moves";
import type { CubeState } from "@/lib/cube/state";
import { lastLayerView } from "@/lib/cube/lastLayer";

/** Цвет наклейки по грани, чей центр его несёт. Порядок STICKER_COLORS: +X, -X, +Y, -Y, +Z, -Z. */
const FILL: Readonly<Record<Face, string>> = {
  R: STICKER_COLORS[0],
  L: STICKER_COLORS[1],
  U: STICKER_COLORS[2],
  D: STICKER_COLORS[3],
  F: STICKER_COLORS[4],
  B: STICKER_COLORS[5],
};

/** При ориентации важно только белое: остальное гасится в серый, чтобы не отвлекать. */
const NOT_TOP = "#5B6270";

const CELL = 20;
const STRIP = 7;
const GAP = 2;
/** Где начинается верх: слева и сверху от него — полоски боков. */
const OFFSET = STRIP + GAP;
const SIZE = OFFSET * 2 + CELL * 3;

/**
 * Схема последнего слоя: верх сверху и верхний ряд четырёх боков вокруг него.
 *
 * Куб на экране показывает три грани, а случай последнего слоя узнают по всем
 * четырём бокам — поэтому схема рисуется рядом с кубом. Она строится из той
 * же позиции, что куб в начале шага, и разойтись с ним не может.
 *
 * Тыл на схеме сверху, фронт снизу — как если смотреть на кубик сверху,
 * держа его перед собой.
 */
export default function CaseDiagram({
  state,
  kind,
}: {
  state: CubeState;
  kind: DiagramKind;
}) {
  const view = lastLayerView(state);
  const fill = (colour: Face) => (kind === "orientation" && colour !== "U" ? NOT_TOP : FILL[colour]);

  const stickers: { key: string; x: number; y: number; w: number; h: number; colour: Face }[] = [];

  view.top.forEach((row, rowIndex) =>
    row.forEach((colour, column) =>
      stickers.push({
        key: `top-${rowIndex}-${column}`,
        x: OFFSET + column * CELL,
        y: OFFSET + rowIndex * CELL,
        w: CELL,
        h: CELL,
        colour,
      })
    )
  );

  // Ряды боков записаны «лицом к стороне», а схема смотрит сверху: задний и
  // правый ряды при этом читаются в обратную сторону.
  const back = [...view.sides.B].reverse();
  const right = [...view.sides.R].reverse();
  for (let index = 0; index < 3; index++) {
    const along = OFFSET + index * CELL;
    const far = OFFSET + CELL * 3 + GAP;
    stickers.push(
      { key: `B-${index}`, x: along, y: 0, w: CELL, h: STRIP, colour: back[index] },
      { key: `F-${index}`, x: along, y: far, w: CELL, h: STRIP, colour: view.sides.F[index] },
      { key: `L-${index}`, x: 0, y: along, w: STRIP, h: CELL, colour: view.sides.L[index] },
      { key: `R-${index}`, x: far, y: along, w: STRIP, h: CELL, colour: right[index] }
    );
  }

  return (
    <svg
      viewBox={`-1 -1 ${SIZE + 2} ${SIZE + 2}`}
      className="h-32 w-32"
      role="img"
      aria-label={
        kind === "orientation"
          ? "Схема: верх сверху, белые наклейки и белое на боках"
          : "Схема: верх сверху и цвета верхнего ряда боков"
      }
      data-testid="case-diagram"
    >
      <rect x={OFFSET - 1} y={OFFSET - 1} width={CELL * 3 + 2} height={CELL * 3 + 2} rx={3} fill={BODY_COLOR} />
      {stickers.map(({ key, x, y, w, h, colour }) => (
        <rect
          key={key}
          x={x + 1}
          y={y + 1}
          width={w - 2}
          height={h - 2}
          rx={2}
          fill={fill(colour)}
          stroke={BODY_COLOR}
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}
