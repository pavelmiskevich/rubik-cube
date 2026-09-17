import { buildSparklinePoints, toPolylinePoints } from "@/lib/sparkline";

const WIDTH = 600;
const HEIGHT = 80;

/** График прогресса: рукописный SVG по токенам оформления. */
export default function Sparkline({ values }: { values: number[] }) {
  const points = buildSparklinePoints(values, WIDTH, HEIGHT);
  if (points.length < 2) return null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-20 w-full"
      role="img"
      aria-label="График времени последних сборок"
      preserveAspectRatio="none"
    >
      <polyline
        points={toPolylinePoints(points)}
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
