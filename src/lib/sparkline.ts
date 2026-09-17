export interface SparklinePoint {
  x: number;
  y: number;
}

/**
 * Точки ломаной для спарклайна прогресса. Значения идут слева направо в
 * хронологическом порядке; DNF (Infinity) пропускаются — линия через них не
 * рвётся и не улетает в бесконечность.
 *
 * Библиотека графиков ради одного графика не окупается, а попадание в палитру
 * при своей реализации точное.
 */
export function buildSparklinePoints(
  values: number[],
  width: number,
  height: number,
  padding = 2
): SparklinePoint[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [];

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  // Все сборки одинаковы — деления на ноль быть не должно.
  const span = max - min || 1;

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const step = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  const points: SparklinePoint[] = [];
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    // Быстрее — выше: ось Y в SVG растёт вниз.
    const ratio = (value - min) / span;
    points.push({
      x: padding + step * index,
      y: padding + ratio * usableHeight,
    });
  });
  return points;
}

export function toPolylinePoints(points: SparklinePoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}
