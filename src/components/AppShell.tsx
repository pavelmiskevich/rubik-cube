import Navbar from "./Navbar";

/*
  Одна ширина контейнера на всю платформу. До этого их было четыре — max-w-7xl,
  max-w-md, max-w-2xl и max-w-4xl, — и страницы выглядели как четыре разных
  сайта. Высоту держит min-h-svh на обёртке, а не min-h-screen на странице
  поверх шапки: именно он давал лишний скролл.
*/
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer data-chrome className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted">
          Тренажёр сборки 3×3: скрамблы по правилам WCA, таймер и статистика.
        </div>
      </footer>
    </div>
  );
}
