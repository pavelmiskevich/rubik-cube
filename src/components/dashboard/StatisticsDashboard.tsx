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
    <div className="w-full max-w-4xl mx-auto mt-8 p-4 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Статистика</h2>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <p className="text-sm text-gray-500 uppercase font-semibold">Ao5</p>
          <p className="text-3xl font-mono font-bold text-blue-700" data-testid="ao5">
            {formatSolveTime(ao5)}
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg text-center">
          <p className="text-sm text-gray-500 uppercase font-semibold">Ao12</p>
          <p className="text-3xl font-mono font-bold text-purple-700" data-testid="ao12">
            {formatSolveTime(ao12)}
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Последние сборки</h3>

      {recent.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Нет данных для отображения</p>
      ) : (
        <ul className="divide-y divide-gray-200" data-testid="solve-list">
          {recent.map(({ solve, number }) => (
            <li
              key={solve.id ?? number}
              className="py-2 flex justify-between items-center"
            >
              <span className="text-gray-500 text-sm">Сборка #{number}</span>
              <div className="font-mono text-lg flex items-center">
                <span className={solve.isDNF ? "text-red-700" : undefined}>
                  {formatSolveTime(effectiveTime(solve))}
                </span>
                {!solve.isDNF && solve.isPlusTwo && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                    +2
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
