import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Оформление | RubikPlatform",
};

const SWATCHES = [
  { token: "--bg", className: "bg-bg", label: "Фон" },
  { token: "--surface", className: "bg-surface", label: "Поверхность" },
  { token: "--surface-2", className: "bg-surface-2", label: "Поверхность 2" },
  { token: "--border", className: "bg-border", label: "Рамка" },
  { token: "--accent", className: "bg-accent", label: "Акцент" },
  { token: "--success", className: "bg-success", label: "Успех" },
  { token: "--danger", className: "bg-danger", label: "Ошибка" },
];

export default function StyleguidePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Оформление платформы</h1>
        <p className="text-muted">
          Палитра, типографика и элементы интерфейса. Переключите тему в шапке,
          чтобы увидеть обе.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Палитра</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <div key={swatch.token} className="space-y-2">
              <div className={`h-16 rounded-card border ${swatch.className}`} />
              <p className="text-sm font-medium">{swatch.label}</p>
              <p className="font-mono text-xs text-muted">{swatch.token}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Типографика</h2>
        <p className="text-3xl font-bold">Заголовок страницы</p>
        <p className="text-xl font-semibold">Заголовок раздела</p>
        <p>Основной текст: скрамблы по правилам WCA, таймер и 3D-тренажёр.</p>
        <p className="text-muted">Второстепенный текст той же строкой.</p>
        <p className="font-mono text-6xl font-bold tabular-nums">12.34</p>
        <p className="text-sm text-muted">
          Таймер — Geist Mono с табличными цифрами: иначе разряды прыгают по
          горизонтали во время счёта.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Поверхности</h2>
        <div className="rounded-card border bg-surface p-6">
          <h3 className="font-semibold">Карточка</h3>
          <p className="text-muted">Поверхность, рамка и радиус из токенов.</p>
        </div>
      </section>
    </div>
  );
}
