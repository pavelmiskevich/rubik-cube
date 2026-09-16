import Badge from "@/components/ui/Badge";
import Stat from "@/components/ui/Stat";
import { formatSolveTime } from "@/lib/format";
import { calculateAo5, calculateAo12, effectiveTime, SolveResult } from "@/lib/statistics";

interface StatisticsDashboardProps {
  /** Chronological order, oldest first — the averages read from the end. */
  solves: SolveResult[];
}

export default function StatisticsDashboard({ solves }: StatisticsDashboardProps) {
  const ao5 = calculateAo5(solves);
  const ao12 = calculateAo12(solves);
  const recent = solves.map((solve, index) => ({ solve, number: index + 1 })).reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Ao5" value={formatSolveTime(ao5)} testId="ao5" />
        <Stat label="Ao12" value={formatSolveTime(ao12)} testId="ao12" />
      </div>

      <div className="rounded-card border bg-surface">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">
          Последние сборки
        </h2>

        {recent.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">
            Нет данных для отображения
          </p>
        ) : (
          <ul data-testid="solve-list">
            {recent.map(({ solve, number }) => (
              <li
                key={solve.id ?? number}
                className="flex items-center justify-between border-b px-4 py-2 last:border-b-0"
              >
                <span className="text-sm text-muted">Сборка №{number}</span>
                <span className="flex items-center gap-2 font-mono tabular-nums">
                  <span className={solve.isDNF ? "text-danger" : undefined}>
                    {formatSolveTime(effectiveTime(solve))}
                  </span>
                  {!solve.isDNF && solve.isPlusTwo && (
                    <Badge tone="warning">+2</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
