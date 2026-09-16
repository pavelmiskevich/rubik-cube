import StatisticsDashboard from "@/components/dashboard/StatisticsDashboard";

export const metadata = {
  title: "Статистика | RubikPlatform",
};

export default function StatsPage() {
  // Демо-данные: на реальные сборки пользователя страницу переводит #21.
  const mockSolves = [
    { timeMs: 12450 },
    { timeMs: 11200 },
    { timeMs: 13000, isPlusTwo: true },
    { timeMs: 9800 },
    { timeMs: 14500 },
    { timeMs: 11000 },
    { timeMs: 10500 },
    { timeMs: 9000, isDNF: true },
    { timeMs: 11100 },
    { timeMs: 10200 },
    { timeMs: 12300 },
    { timeMs: 11800 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Статистика (демо)</h1>
      <StatisticsDashboard solves={mockSolves} />
    </div>
  );
}
