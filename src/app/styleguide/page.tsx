import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Stat from "@/components/ui/Stat";

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
    <div className="space-y-12">
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
        <h2 className="text-xl font-semibold">Кнопки</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Основная</Button>
          <Button variant="secondary">Второстепенная</Button>
          <Button variant="ghost">Призрачная</Button>
          <Button variant="danger">Опасная</Button>
          <Button disabled>Недоступна</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Поля формы</h2>
        <div className="max-w-md space-y-4">
          <Field label="Электронная почта" name="demo-email" type="email" />
          <Field
            label="Пароль"
            name="demo-password"
            type="password"
            placeholder="Не менее 6 символов"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Метки</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Обычная</Badge>
          <Badge tone="warning">+2</Badge>
          <Badge tone="danger">DNF</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Показатели</h2>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <Stat label="Ao5" value="11.24" />
          <Stat label="Ao12" value="-" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Поверхности</h2>
        <Card>
          <h3 className="font-semibold">Карточка</h3>
          <p className="text-muted">Поверхность, рамка и радиус из токенов.</p>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Пустое состояние</h2>
        <EmptyState
          title="Пока ни одной сборки"
          description="Засеките первую сборку на рабочем экране — средние начнут считаться сами."
          action={<Button>Начать тренировку</Button>}
        />
      </section>
    </div>
  );
}
