import Link from "next/link";
import SolveWorkspace from "@/components/solve/SolveWorkspace";

export const metadata = {
  title: "Решить мой кубик | RubikPlatform",
};

/*
  Третий вход в курс: не «посмотрите урок», а «вот мой кубик, что с ним
  делать». Экран целиком клиентский и ни о чём не спрашивает сервер — вход
  здесь не нужен и не будет нужен: раскраску никуда не сохраняют.
*/
export default function SolvePage() {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold">Решить мой кубик</h1>
        <p className="text-lg text-muted">
          Перенесите раскраску своего кубика на развёртку, и платформа проверит,
          бывает ли такой кубик вообще: у собранного наугад набора цветов чаще
          всего нет ни одного решения.
        </p>
        <p className="text-muted">
          Вход не нужен. Если кубик ещё ни разу не собирали, начните с{" "}
          <Link href="/learn" className="text-accent-text">
            курса
          </Link>
          : там всё по шагам.
        </p>
      </div>

      <SolveWorkspace />
    </div>
  );
}
