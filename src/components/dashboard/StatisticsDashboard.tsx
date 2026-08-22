"use client";

import { calculateAo5, calculateAo12, SolveResult } from "@/lib/statistics";

interface StatisticsDashboardProps {
  solves: SolveResult[];
}

function formatTime(ms: number | null): string {
  if (ms === null) return "-";
  if (ms === Infinity) return "DNF";
  
  const seconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${seconds}.${milliseconds.toString().padStart(2, "0")}`;
}

export default function StatisticsDashboard({ solves }: StatisticsDashboardProps) {
  const ao5 = calculateAo5(solves);
  const ao12 = calculateAo12(solves);

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 p-4 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Статистика</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <p className="text-sm text-gray-500 uppercase font-semibold">Ao5</p>
          <p className="text-3xl font-mono font-bold text-blue-700">{formatTime(ao5)}</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg text-center">
          <p className="text-sm text-gray-500 uppercase font-semibold">Ao12</p>
          <p className="text-3xl font-mono font-bold text-purple-700">{formatTime(ao12)}</p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Последние сборки</h3>
      <ul className="divide-y divide-gray-200">
        {solves.slice().reverse().map((solve, idx) => {
          let badge = null;
          if (solve.isDNF) {
            badge = <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">DNF</span>;
          } else if (solve.isPlusTwo) {
            badge = <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">+2</span>;
          }

          let displayTime = solve.timeMs;
          if (solve.isPlusTwo) displayTime += 2000;

          return (
            <li key={idx} className="py-2 flex justify-between items-center">
              <span className="text-gray-500 text-sm">Сборка #{solves.length - idx}</span>
              <div className="font-mono text-lg flex items-center">
                {solve.isDNF ? "DNF" : formatTime(displayTime)}
                {badge}
              </div>
            </li>
          );
        })}
      </ul>
      {solves.length === 0 && (
        <p className="text-gray-500 text-center py-4">Нет данных для отображения</p>
      )}
    </div>
  );
}
