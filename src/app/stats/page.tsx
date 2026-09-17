import Link from "next/link";
import { auth } from "@/auth";
import { getSolvesForUser } from "@/lib/solves";
import StatisticsDashboard from "@/components/dashboard/StatisticsDashboard";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = {
  title: "Статистика | RubikPlatform",
};

/*
  Страница персональная, статически отрисовывать её нечего. Отдельный
  force-dynamic не нужен: auth() читает cookies, а это request-time API —
  сегмент и так рендерится на каждый запрос. По той же причине не нужен и
  connection().
*/
export default async function StatsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <EmptyState
        title="Статистика появится после входа"
        description="Сборки сохраняются в аккаунт, поэтому средние считаются только для вошедших."
        action={
          <Link href="/login">
            <Button>Войти</Button>
          </Link>
        }
      />
    );
  }

  const solves = await getSolvesForUser(userId);

  if (solves.length === 0) {
    return (
      <EmptyState
        title="Пока ни одной сборки"
        description="Засеките первую сборку на рабочем экране — средние начнут считаться сами."
        action={
          <Link href="/timer">
            <Button>Начать тренировку</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Статистика</h1>
      <StatisticsDashboard solves={solves} />
    </div>
  );
}
