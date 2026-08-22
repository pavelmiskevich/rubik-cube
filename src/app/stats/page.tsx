import StatisticsDashboard from "@/components/dashboard/StatisticsDashboard";

export const metadata = {
  title: "Статистика | RubikPlatform",
};

export default function StatsPage() {
  // Dummy data for demonstration since we are not hooked up to a real user session in this PR context
  const mockSolves = [
    { timeMs: 12450 },
    { timeMs: 11200 },
    { timeMs: 13000, isPlusTwo: true }, // 15000
    { timeMs: 9800 },
    { timeMs: 14500 },
    { timeMs: 11000 },
    { timeMs: 10500 },
    { timeMs: 9000, isDNF: true },      // DNF
    { timeMs: 11100 },
    { timeMs: 10200 },
    { timeMs: 12300 },
    { timeMs: 11800 },
  ];

  return (
    <div className="mx-auto max-w-7xl p-4 min-h-[calc(100vh-4rem)]">
      <h1 className="text-3xl font-bold mb-8 text-center">Ваша статистика (Демо)</h1>
      <StatisticsDashboard solves={mockSolves} />
    </div>
  );
}
