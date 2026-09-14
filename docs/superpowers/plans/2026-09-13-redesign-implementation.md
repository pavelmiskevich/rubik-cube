# План реализации: единое оформление платформы (эпик #17)

> **Для агентов-исполнителей:** REQUIRED SUB-SKILL — вести реализацию через
> `superpowers:subagent-driven-development` (рекомендуется) или
> `superpowers:executing-plans`, задача за задачей. Шаги размечены
> чекбоксами (`- [ ]`) для отслеживания.

**Цель:** привести платформу к единому оформлению — токены и две темы, общий
каркас и примитивы, рабочий экран вместо трёх страниц, статистика на реальных
данных, лендинг и аккуратный 3D-куб.

**Архитектура:** единственный источник правды по цвету, типографике и радиусам —
CSS-переменные в `globals.css`, проброшенные в `tailwind.config.ts`. Тёмная тема
объявлена на `:root` и работает без JavaScript; светлая переопределяет тот же
набор токенов по атрибуту `data-theme="light"`. Компоненты пишутся по именам
токенов и не знают, какая тема активна. Поверх этого — один `AppShell` и набор
примитивов, которые появляются только при наличии второго потребителя.

**Стек:** Next.js 16.3.4 (App Router), React 19.2.8, Tailwind CSS 3.4.19,
TypeScript 5, Jest 30 + ts-jest, Cypress 15, Prisma 7, `@react-three/fiber` 9 +
`@react-three/drei` 10.7.8, `next-themes` 0.4.6 (единственная новая зависимость).

**Спека:** [`docs/superpowers/specs/2026-09-10-redesign-design.md`](../specs/2026-09-10-redesign-design.md)

## Общие ограничения

Действуют во всех задачах без исключения.

- **Версии.** Tailwind остаётся на 3.x. Документация Next 16 описывает установку
  Tailwind v4 (`@tailwindcss/postcss`, `@import 'tailwindcss'`) — это **не наш
  случай**. Наш путь описан в `node_modules/next/dist/docs/01-app/02-guides/tailwind-v3-css.md`:
  директивы `@tailwind base/components/utilities` и плагин `tailwindcss` в
  `postcss.config.mjs`. Не мигрировать на v4 в рамках редизайна.
- **Новые зависимости.** Разрешена ровно одна: `next-themes@^0.4.6` (владелец
  подтвердил 2026-09-13). Больше ничего не добавлять — ни библиотек графиков, ни
  UI-китов, ни `@testing-library/react`. `three-stdlib` в дереве есть, но только
  как транзитивная зависимость `drei`; импортировать её напрямую нельзя.
- **Скрытые внешние зависимости.** `<Environment preset="...">` из `drei`
  скачивает HDRI с `https://raw.githack.com/pmndrs/drei-assets/...` в рантайме
  (см. `node_modules/@react-three/drei/core/useEnvironment.js`). Пресеты и
  `files` не использовать: окружение собирается из `<Lightformer>`-детей, тогда
  загрузчик не вызывается вовсе.
- **Не переписывать.** `src/components/cube/dragRotation.ts`, логика указателя в
  `RubiksCube.tsx`, `src/lib/statistics.ts`, машина состояний
  `SmartTimer.tsx`. Разрешены только аддитивные изменения, описанные в задачах.
- **Язык.** Ишью, PR, документация, комментарии в коде — русский. Сторонние
  продукты-конкуренты по имени не называть.
- **Процесс.** Ветка `feature/issue-N-кратко` → PR в `main` → вливать
  merge-коммитом (`gh pr merge N --merge`), не squash. Статус `BEHIND` лечится
  `gh pr update-branch N`, флаг `--admin` не использовать.
- **Палитра.** Значения токенов взяты из спеки дословно и не меняются по ходу
  реализации. Изменение любого — пересчёт контраста (это делает тест из задачи 1).
- **Обязательные проверки перед каждым PR:** `npm run lint`, `npx tsc --noEmit`,
  `npm test`, `npm run build`. Все 47 существующих юнит-тестов остаются зелёными.

## Как проверяется оформление

Спека прямо говорит: «Оформление юнит-тестами не проверяется». Это осознанное
решение, а не пропуск, и оно определяет форму шагов ниже.

- **Там, где есть чистая логика** (контраст палитры, геометрия спарклайна,
  отображение строк базы в доменную модель) — обычный цикл TDD: красный тест,
  запуск, реализация, зелёный тест, коммит.
- **Там, где есть только вёрстка** — «красный шаг» это записанная браузерная
  проверка: страница открывается в обеих темах и на ширине телефона, снимки
  прикладываются к PR. Не изобретать для этого юнит-тесты и **не добавлять
  `@testing-library/react`** — это новая зависимость, запрещённая ограничениями.
- **Сквозной сценарий** Cypress остаётся единственной автоматической проверкой
  связности экранов и обновляется в задаче 3.

Ширина телефона для проверок — 390 px. Обе темы — значит переключателем, а не
настройкой системы.

## Файловая структура

Создаётся:

| Файл | Ответственность |
|---|---|
| `src/lib/contrast.ts` | Относительная яркость и коэффициент контраста по WCAG. Чистые функции. |
| `src/lib/contrast.test.ts` | Проверка формулы на известных значениях. |
| `src/lib/palette.test.ts` | Читает `globals.css` и стережёт контраст обеих тем. |
| `src/components/ThemeToggle.tsx` | Переключатель темы, клиентский. |
| `src/app/styleguide/page.tsx` | Style tile: палитра, типографика, примитивы в текущей теме. |
| `src/components/AppShell.tsx` | Каркас: шапка, одна ширина контейнера, подвал. |
| `src/components/ui/Button.tsx` | Кнопка, варианты `primary`/`secondary`/`ghost`/`danger`. |
| `src/components/ui/Card.tsx` | Поверхность с рамкой и радиусом. |
| `src/components/ui/Field.tsx` | Подпись + инпут + ошибка. |
| `src/components/ui/Badge.tsx` | Метка (`+2`, `DNF`). |
| `src/components/ui/Stat.tsx` | Крупное число с подписью (Ao5, Ao12). |
| `src/components/ui/EmptyState.tsx` | Пустое состояние с заголовком, текстом и действием. |
| `src/lib/solves.ts` | Чтение сборок пользователя и отображение в `SolveResult`. |
| `src/lib/solves.test.ts` | Тест чистого отображения строк. |
| `src/lib/sparkline.ts` | Геометрия спарклайна. Чистые функции. |
| `src/lib/sparkline.test.ts` | Тест геометрии. |
| `src/components/dashboard/Sparkline.tsx` | SVG-график по токенам. |
| `src/components/cube/CubeHero.tsx` | Ленивая загрузка куба для лендинга + запасной вариант. |
| `src/components/cube/cubeTheme.ts` | Палитра стикеров и корпуса, сведённая с токенами. |

Изменяется: `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`,
`src/components/Providers.tsx`, `src/components/Navbar.tsx`, все страницы в
`src/app/`, `src/components/timer/*`, `src/components/dashboard/StatisticsDashboard.tsx`,
`src/components/cube/RubiksCube.tsx`, `cypress/e2e/timer.cy.ts`, `package.json`.

---
## Задача 1 — Токены оформления и переключатель темы (ишью #18)

Ветка `feature/issue-18-design-tokens`. Фундамент: всё остальное опирается на
этот слой. Первый видимый артефакт для владельца — style tile в конце задачи.

**Файлы:**
- Создать: `src/lib/contrast.ts`, `src/lib/contrast.test.ts`, `src/lib/palette.test.ts`,
  `src/components/ThemeToggle.tsx`, `src/app/styleguide/page.tsx`
- Изменить: `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`,
  `src/components/Providers.tsx`, `package.json`

**Интерфейсы:**
- Потребляет: ничего (первая задача).
- Отдаёт: CSS-переменные `--bg`, `--surface`, `--surface-2`, `--border`,
  `--text`, `--muted`, `--accent`, `--accent-text`, `--success`, `--danger`,
  `--radius-card`, `--radius-control`; классы Tailwind `bg-bg`, `bg-surface`,
  `bg-surface-2`, `text-text`, `text-muted`, `text-accent-text`, `border-border`,
  `bg-accent`, `text-success`, `text-danger`, `rounded-card`, `rounded-control`;
  компонент `ThemeToggle` (default export);
  `contrastRatio(a: string, b: string): number` из `src/lib/contrast.ts`.

- [ ] **Шаг 1: Написать падающий тест формулы контраста**

Создать `src/lib/contrast.test.ts`:

```ts
import { contrastRatio, relativeLuminance } from "./contrast";

describe("контраст по WCAG", () => {
  it("чёрный на белом даёт предельные 21:1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
  });

  it("одинаковые цвета дают 1:1", () => {
    expect(contrastRatio("#6B4AF0", "#6B4AF0")).toBeCloseTo(1, 5);
  });

  it("порядок аргументов не влияет на результат", () => {
    expect(contrastRatio("#E8EAED", "#0B0D10")).toBeCloseTo(
      contrastRatio("#0B0D10", "#E8EAED"),
      10
    );
  });

  it("совпадает с числами, посчитанными для спеки", () => {
    // Значения из docs/superpowers/specs/2026-09-10-redesign-design.md
    expect(contrastRatio("#E8EAED", "#0B0D10")).toBeCloseTo(16.14, 1);
    expect(contrastRatio("#FFFFFF", "#6B4AF0")).toBeCloseTo(5.44, 1);
    expect(contrastRatio("#FFFFFF", "#5B34D9")).toBeCloseTo(7.15, 1);
  });

  it("яркость белого равна единице, чёрного — нулю", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
  });

  it("отвергает то, что не является цветом", () => {
    expect(() => contrastRatio("голубой", "#000000")).toThrow();
  });
});
```

- [ ] **Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `npx jest src/lib/contrast.test.ts`
Ожидаемо: FAIL — модуль `./contrast` не найден.

- [ ] **Шаг 3: Реализовать формулу**

Создать `src/lib/contrast.ts`:

```ts
/**
 * Коэффициент контраста по WCAG 2.x. Нужен, чтобы правило спеки «при изменении
 * палитры пересчитать контраст» стерёг тест, а не память.
 */

/** Гамма-коррекция канала sRGB. */
function linearize(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    throw new Error("Ожидался цвет вида #RRGGBB, получено: " + hex);
  }
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Шаг 4: Запустить тест и убедиться, что он проходит**

Запуск: `npx jest src/lib/contrast.test.ts`
Ожидаемо: PASS, 6 тестов.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/contrast.ts src/lib/contrast.test.ts
git commit -m "feat(#18): расчёт контраста по WCAG"
```

- [ ] **Шаг 6: Написать падающий тест палитры**

Тест читает `globals.css` и потому стережёт настоящий источник правды, а не
копию значений. Создать `src/lib/palette.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { contrastRatio } from "./contrast";

const css = readFileSync(
  path.join(__dirname, "..", "app", "globals.css"),
  "utf8"
);

/** Токены одного блока globals.css, вида `--имя: значение;`. */
function tokensOf(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(escaped + "\\s*\\{([^}]*)\\}").exec(css);
  if (!block) {
    throw new Error("Блок " + selector + " не найден в globals.css");
  }
  const tokens: Record<string, string> = {};
  for (const match of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const COLOR_TOKENS = [
  "bg",
  "surface",
  "surface-2",
  "border",
  "text",
  "muted",
  "accent",
  "accent-text",
  "success",
  "danger",
];

const dark = tokensOf(":root");
const light = tokensOf('[data-theme="light"]');

/** Порог WCAG AA для основного текста. */
const AA = 4.5;

describe("палитра оформления", () => {
  it.each([
    ["тёмная", dark],
    ["светлая", light],
  ])("%s тема объявляет полный набор токенов", (_name, tokens) => {
    const declared = COLOR_TOKENS.filter((token) => token in tokens);
    expect(declared).toEqual(COLOR_TOKENS);
  });

  it.each([
    ["тёмная", dark],
    ["светлая", light],
  ])("%s тема проходит WCAG AA", (_name, t) => {
    expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.text, t.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.muted, t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.muted, t.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t["accent-text"], t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.success, t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.danger, t.bg)).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["тёмная", dark],
    ["светлая", light],
  ])("%s тема: белый текст читается на заливке акцента", (_name, t) => {
    expect(contrastRatio("#FFFFFF", t.accent)).toBeGreaterThanOrEqual(AA);
  });
});
```

- [ ] **Шаг 7: Запустить тест и убедиться, что он падает**

Запуск: `npx jest src/lib/palette.test.ts`
Ожидаемо: FAIL — в текущем `globals.css` объявлены только `--background` и
`--foreground`, блока `[data-theme="light"]` нет вовсе.

- [ ] **Шаг 8: Переписать globals.css на токены**

Полностью заменить `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
  Тёмная тема — базовая: её значения объявлены прямо на :root, поэтому она
  работает и без JavaScript, и до гидратации. Светлая переопределяет тот же
  набор токенов. Компонент, написанный по именам, не знает, какая активна.
  Числа контраста — в спеке редизайна; стережёт их src/lib/palette.test.ts.
*/
:root {
  --bg: #0B0D10;
  --surface: #14171C;
  --surface-2: #1B1F26;
  --border: #262B33;
  --text: #E8EAED;
  --muted: #9AA3AF;
  --accent: #6B4AF0;
  --accent-text: #A78BFA;
  --success: #3DD68C;
  --danger: #FF6369;

  /* Радиусы от темы не зависят и объявляются один раз. */
  --radius-card: 0.875rem;
  --radius-control: 0.625rem;
}

[data-theme="light"] {
  --bg: #FFFFFF;
  --surface: #F7F8FA;
  --surface-2: #EEF0F4;
  --border: #E1E4EA;
  --text: #14171C;
  --muted: #5A6472;
  --accent: #5B34D9;
  --accent-text: #5B34D9;
  --success: #12794A;
  --danger: #C4282D;
}

body {
  background: var(--bg);
  color: var(--text);
  /*
    Здесь раньше стоял `font-family: Arial`, который перебивал аккуратно
    подключённый в layout Geist. Возвращать нельзя.
  */
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

/*
  Таймером управляют с клавиатуры, и человек, который до него дошёл, должен
  видеть, где находится.
*/
:focus-visible {
  outline: 2px solid var(--accent-text);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Шаг 9: Запустить тест и убедиться, что он проходит**

Запуск: `npx jest src/lib/palette.test.ts`
Ожидаемо: PASS, 6 тестов (три `it.each` по двум темам).

- [ ] **Шаг 10: Коммит**

```bash
git add src/app/globals.css src/lib/palette.test.ts
git commit -m "feat(#18): семантические токены и две темы в globals.css"
```

- [ ] **Шаг 11: Пробросить токены в Tailwind**

Полностью заменить `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  /*
    Тёмная тема лежит на :root, поэтому вариант dark: нужен редко. Когда всё же
    нужен — он привязан к тому же атрибуту, который ставит переключатель темы.
    Стратегия selector поддерживается Tailwind начиная с 3.4.
  */
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-text": "var(--accent-text)",
        success: "var(--success)",
        danger: "var(--danger)",
      },
      /* Чтобы голое `border` брало токен, а не серый цвет Tailwind по умолчанию. */
      borderColor: {
        DEFAULT: "var(--border)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
```

Табличные цифры для таймера отдельного класса не требуют: у Tailwind есть
готовая утилита `tabular-nums`, её и применять вместе с `font-mono`.

- [ ] **Шаг 12: Установить next-themes**

```bash
npm install next-themes@^0.4.6
```

Проверить, что зависимость попала в `dependencies`, а `package-lock.json`
обновился целиком. Напоминание: `npm ci` падает, пока запущен `npm run dev` —
dev-сервер держит файлы в `node_modules`.

- [ ] **Шаг 13: Подключить провайдер темы**

Заменить `src/components/Providers.tsx`:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/*
        defaultTheme="dark" — тёмная базовая, как требует спека: при первом
        заходе без сохранённого выбора применяется она, а не системная.
        enableSystem оставляет пользователю третий вариант — «системная».
        disableTransitionOnChange гасит переходы в момент смены темы, иначе
        разные длительности анимаций дают рассинхрон.
      */}
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
```

- [ ] **Шаг 14: Поправить корневой layout**

В `src/app/layout.tsx` заменить элементы `<html>` и `<body>`:

```tsx
    <html lang="ru" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
```

Три изменения, каждое обязательно:
- `lang="ru"` — интерфейс русский, скринридер должен читать его по-русски;
- `suppressHydrationWarning` — `next-themes` меняет атрибут на `<html>` до
  гидратации, без этого React ругается. Свойство действует на один уровень и
  ничего не скрывает на вложенных узлах;
- `bg-gray-50` убран — фон задаётся токеном в `body` из `globals.css`.

- [ ] **Шаг 15: Написать переключатель темы**

Создать `src/components/ThemeToggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const OPTIONS = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Тема известна только на клиенте: на сервере её нет, и попытка отрисовать
    // выбранное состояние до монтирования даёт рассинхрон гидратации.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    // Заглушка держит место, чтобы шапка не прыгала после гидратации.
    return <div className="h-8 w-[168px]" aria-hidden />;
  }

  return (
    <fieldset className="flex items-center gap-0.5 rounded-control border p-0.5">
      <legend className="sr-only">Тема оформления</legend>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          aria-pressed={theme === option.value}
          className={
            theme === option.value
              ? "rounded-control bg-accent px-2 py-1 text-xs font-medium text-white"
              : "rounded-control px-2 py-1 text-xs font-medium text-muted hover:text-text"
          }
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
```

Временно повесить `ThemeToggle` в правый край `src/components/Navbar.tsx`, чтобы
темы можно было переключать уже сейчас. Полноценно шапка переедет в `AppShell`
в задаче 2.

- [ ] **Шаг 16: Собрать style tile**

Создать `src/app/styleguide/page.tsx` — страницу-витрину. Это первый артефакт,
который увидит владелец, и постоянная справка по токенам после.

```tsx
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
```

Кнопки, поля и остальные примитивы добавляются на эту страницу в задаче 2 —
сейчас их ещё не существует, и выдумывать разметку впрок не нужно.

- [ ] **Шаг 17: Прогнать все проверки**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Ожидаемо: всё зелёное, юнит-тестов стало 47 + 12 новых. Если `tsc` жалуется на
отсутствующий модуль `page.js` — это протухший `.next/` от другой ветки,
лечится `rm -rf .next`.

- [ ] **Шаг 18: Проверить в браузере**

```bash
npm run dev
```

Открыть `http://localhost:3000/styleguide` и проверить:
- тёмная тема применяется сразу, вспышки светлого фона при загрузке нет —
  проверять обязательно на жёсткой перезагрузке, а не на переходе по ссылке;
- переключатель меняет тему, выбор переживает перезагрузку;
- вариант «Системная» следует за настройкой ОС;
- на ширине 390 px ничего не разъезжается.

Снять по снимку экрана в каждой теме — они пойдут в PR.

- [ ] **Шаг 19: Проверить, что тест палитры «зубастый»**

Временно испортить `--muted` в тёмной теме на `#3A3F47`, запустить
`npx jest src/lib/palette.test.ts` — тест **обязан** упасть. Вернуть значение —
обязан пройти. Без этой проверки тест может оказаться пустым.

- [ ] **Шаг 20: Коммит и PR**

```bash
git add tailwind.config.ts src/app/layout.tsx src/components/Providers.tsx src/components/ThemeToggle.tsx src/components/Navbar.tsx src/app/styleguide/page.tsx package.json package-lock.json
git commit -m "feat(#18): переключатель темы, токены в Tailwind и style tile"
git push -u origin feature/issue-18-design-tokens
gh pr create --base main --title "Токены оформления и переключатель темы"
```

Коммитить явными путями: `git add -A` однажды утащил в коммит рабочий мусор.
В описание PR приложить снимки обеих тем.

**Критерии готовности:**
- `npx jest src/lib/palette.test.ts` зелёный и проверен обратным ходом (шаг 19).
- При жёсткой перезагрузке в тёмной теме нет вспышки светлого фона.
- `font-family: Arial` в `globals.css` отсутствует.
- Обе темы сняты на скриншотах и приложены к PR.

---
## Задача 2 — Каркас страницы и набор UI-примитивов (ишью #19)

Ветка `feature/issue-19-shell-and-primitives`. Зависит от задачи 1.

Проверяется браузером и снимками, а не юнит-тестами — см. раздел «Как
проверяется оформление». `@testing-library/react` не добавлять.

**Файлы:**
- Создать: `src/components/AppShell.tsx`, `src/components/ui/Button.tsx`,
  `src/components/ui/Card.tsx`, `src/components/ui/Field.tsx`,
  `src/components/ui/Badge.tsx`, `src/components/ui/Stat.tsx`,
  `src/components/ui/EmptyState.tsx`
- Изменить: `src/app/layout.tsx`, `src/components/Navbar.tsx`,
  `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`,
  `src/app/profile/page.tsx`, `src/app/stats/page.tsx`, `src/app/timer/page.tsx`,
  `src/app/trainer/page.tsx`, `src/app/styleguide/page.tsx`

**Интерфейсы:**
- Потребляет: токены и классы из задачи 1.
- Отдаёт:
  - `Button({ variant?: "primary" | "secondary" | "ghost" | "danger", ...ButtonHTMLAttributes })`
  - `Card({ children, className? })`
  - `Field({ label: string, name: string, ...InputHTMLAttributes })`
  - `Badge({ children, tone?: "neutral" | "warning" | "danger" })`
  - `Stat({ label: string, value: string, testId?: string })`
  - `EmptyState({ title: string, description: string, action?: ReactNode })`
  - `AppShell({ children })`
  - атрибут `data-chrome` на шапке и подвале — по нему задача 3 гасит обвязку.

- [ ] **Шаг 1: Написать примитивы**

`src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/* Один акцент на весь интерфейс: состояния кодирует только success/danger. */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border bg-surface-2 text-text hover:bg-surface",
  ghost: "text-muted hover:text-text",
  danger: "bg-danger text-white hover:opacity-90",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-control px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
```

`src/components/ui/Card.tsx`:

```tsx
export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card border bg-surface p-6 ${className}`}>
      {children}
    </div>
  );
}
```

`src/components/ui/Field.tsx`:

```tsx
import type { InputHTMLAttributes } from "react";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

/*
  Подпись видимая, а не sr-only: у форм входа и регистрации разметка инпутов
  была скопирована один в один, и подпись в них подменял placeholder, который
  исчезает при вводе.
*/
export default function Field({
  label,
  name,
  className = "",
  ...rest
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`block w-full rounded-control border bg-surface-2 px-3 py-2 text-text placeholder:text-muted ${className}`}
        {...rest}
      />
    </div>
  );
}
```

`src/components/ui/Badge.tsx`:

```tsx
type Tone = "neutral" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border text-muted",
  warning: "border text-accent-text",
  danger: "border text-danger",
};

export default function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-control px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
```

`src/components/ui/Stat.tsx`:

```tsx
export default function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-card border bg-surface p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      {/* Табличные цифры: иначе среднее дёргается при каждой новой сборке. */}
      <p
        className="mt-1 font-mono text-3xl font-bold tabular-nums"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}
```

`src/components/ui/EmptyState.tsx`:

```tsx
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border bg-surface p-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
```

- [ ] **Шаг 2: Собрать каркас**

Создать `src/components/AppShell.tsx`:

```tsx
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
```

В `src/app/layout.tsx` заменить `<Navbar />` и `<main>` одним `<AppShell>`:

```tsx
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
```

- [ ] **Шаг 3: Перевести шапку на токены**

В `src/components/Navbar.tsx`: заменить `border-b bg-white` на
`sticky top-0 z-10 border-b bg-bg`, добавить атрибут `data-chrome` на `<nav>`,
все `text-gray-*` / `text-indigo-*` / `text-red-*` заменить на `text-muted`,
`text-accent-text` и `text-danger`, кнопку регистрации — на `Button`,
`ThemeToggle` оставить в правом краю.

- [ ] **Шаг 4: Перевести страницы на каркас и примитивы**

По каждой странице: убрать `min-h-screen`, `p-24`, собственные `max-w-*`,
`bg-white`, `text-gray-*` и все пять акцентов; вместо них — примитивы и токены.

- `src/app/login/page.tsx` и `src/app/register/page.tsx` — формы на `Field` и
  `Button`, обёртка `Card`, ошибки `text-danger`. Логику `handleSubmit`,
  `useSearchParams` и `Suspense` не трогать.
- `src/app/profile/page.tsx` — `Card`, кнопка выхода `variant="danger"`.
- `src/app/trainer/page.tsx` — рамку холста на `rounded-card border bg-surface`.
- `src/app/timer/page.tsx`, `src/app/stats/page.tsx` — только снять свои
  контейнеры и цвета; содержимое переделывают задачи 3 и 4.
- `src/app/page.tsx` — временно на токены; лендинг переделывает задача 5.
- `src/app/styleguide/page.tsx` — добавить разделы с `Button` всех вариантов,
  `Field`, `Badge`, `Stat` и `EmptyState`, убрать собственный `max-w-6xl px-4`
  (его теперь даёт `AppShell`).

- [ ] **Шаг 5: Прогнать проверки**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Ожидаемо: зелено, число тестов не изменилось относительно задачи 1.

- [ ] **Шаг 6: Проверить в браузере**

Пройти все страницы — `/`, `/login`, `/register`, `/profile`, `/timer`,
`/trainer`, `/stats`, `/styleguide` — в обеих темах и на ширине 390 px:

- ни на одной нет лишнего скролла под шапкой;
- ширина контейнера везде одна;
- обход по Tab даёт видимый фокус на каждом интерактивном элементе;
- ни одного белого прямоугольника в тёмной теме.

- [ ] **Шаг 7: Убедиться, что хардкодных цветов не осталось**

```bash
grep -rE "(bg|text|border|ring)-(white|black|gray|slate|zinc|neutral|stone|indigo|violet|purple|blue|green|emerald|red|rose|amber|yellow)-?[0-9]{0,3}" src --include=*.tsx
```

Ожидаемо: пусто. Исключение — `text-white` на заливке акцента и опасного
действия: белый там выбран осознанно и проверен тестом палитры.

- [ ] **Шаг 8: Коммит и PR**

```bash
git add src/components/AppShell.tsx src/components/ui src/app src/components/Navbar.tsx
git commit -m "feat(#19): каркас страницы и набор UI-примитивов"
git push -u origin feature/issue-19-shell-and-primitives
gh pr create --base main --title "Каркас страницы и набор UI-примитивов"
```

**Критерии готовности:** все пункты шага 6 выполнены, шаг 7 пуст, снимки всех
страниц в обеих темах приложены к PR.

---

## Задача 3 — Рабочий экран (ишью #20)

Ветка `feature/issue-20-workspace`. Зависит от задачи 2.

Скрамбл, таймер и статистика собираются на одной странице `/timer`. Логика
таймера **не трогается**: машина состояний, удержание пробела, старт по
отпусканию и сохранение сборки закреплены тестами. Все изменения в
`SmartTimer.tsx` — строго аддитивные и сделаны через ref, чтобы не менять граф
зависимостей существующих `useCallback`.

**Файлы:**
- Изменить: `src/components/timer/SmartTimer.tsx`,
  `src/components/timer/ScrambleDisplay.tsx`,
  `src/components/timer/TimerWorkspace.tsx`, `src/app/timer/page.tsx`,
  `src/app/globals.css`, `cypress/e2e/timer.cy.ts`

**Интерфейсы:**
- Потребляет: `Stat`, `Badge`, `Card`, `Button` из задачи 2;
  `calculateAo5`, `calculateAo12`, `effectiveTime`, тип `SolveResult` из
  `src/lib/statistics.ts`; `formatSolveTime` из `src/lib/format.ts`.
- Отдаёт:
  - `export type TimerState = "IDLE" | "READY" | "RUNNING" | "STOPPED"` из `SmartTimer.tsx`;
  - `SmartTimer` получает два новых необязательных пропа:
    `onStateChange?: (state: TimerState) => void` и `onSolve?: (timeMs: number) => void`;
  - `ScrambleDisplay` получает `refreshToken?: number`;
  - `TimerWorkspace({ canSave: boolean })` рисует весь экран.

- [ ] **Шаг 1: Добавить в SmartTimer уведомления наружу**

В `src/components/timer/SmartTimer.tsx`:

1. Экспортировать тип: `export type TimerState = ...` (был локальным).
2. Добавить пропы в `SmartTimerProps`:

```tsx
  /** Состояние машины таймера — по нему включается режим фокуса. */
  onStateChange?: (state: TimerState) => void;
  /** Завершённая сборка в миллисекундах, до применения штрафов. */
  onSolve?: (timeMs: number) => void;
```

3. Держать колбэки в ref — так же, как уже сделано со `scramble`. Это
   сознательно: если положить их в зависимости `setState` и `stopTimer`, при
   каждом рендере родителя пересоберутся все обработчики, а их поведение
   закреплено 29 тестами.

```tsx
  const onStateChangeRef = useRef(onStateChange);
  const onSolveRef = useRef(onSolve);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
    onSolveRef.current = onSolve;
  }, [onStateChange, onSolve]);
```

4. В `setState` добавить последней строкой `onStateChangeRef.current?.(next);`
   — список зависимостей `useCallback` при этом не меняется.

5. В `stopTimer` сразу после `updateDisplay(elapsed);` добавить:

```tsx
    // До проверки canSave: живые средние нужны и тому, кто не вошёл.
    onSolveRef.current?.(Math.round(elapsed));
```

6. Цвета состояния перевести на токены: `text-text` в покое, `text-success` в
   `READY`, `text-muted` в `STOPPED`. Класс дисплея — `font-mono tabular-nums`.

- [ ] **Шаг 2: Научить ScrambleDisplay обновляться по сигналу**

В `src/components/timer/ScrambleDisplay.tsx` добавить проп и зависимость:

```tsx
  /** Меняется — выдаётся новый скрамбл. */
  refreshToken?: number;
```

```tsx
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    regenerate();
  }, [regenerate, refreshToken]);
```

Оформление: контейнер `rounded-card border bg-surface-2`, текст
`font-mono text-xl tracking-wider` (на 390 px длинный скрамбл должен переноситься,
а не растягивать страницу), кнопка — `Button variant="secondary"`.
`data-testid="scramble"` и `data-testid="new-scramble"` **сохранить**: на них
держится сквозной сценарий.

- [ ] **Шаг 3: Собрать рабочий экран**

Полностью заменить `src/components/timer/TimerWorkspace.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import ScrambleDisplay from "./ScrambleDisplay";
import SmartTimer, { type TimerState } from "./SmartTimer";
import Badge from "@/components/ui/Badge";
import Stat from "@/components/ui/Stat";
import { formatSolveTime } from "@/lib/format";
import {
  calculateAo5,
  calculateAo12,
  effectiveTime,
  type SolveResult,
} from "@/lib/statistics";

interface TimerWorkspaceProps {
  canSave: boolean;
}

/**
 * Весь цикл тренировки на одной странице: скрамбл сверху, таймер в центре,
 * живые средние и последние сборки под ним.
 */
export default function TimerWorkspace({ canSave }: TimerWorkspaceProps) {
  const [scramble, setScramble] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [focused, setFocused] = useState(false);
  const [solves, setSolves] = useState<SolveResult[]>([]);

  const handleStateChange = useCallback((state: TimerState) => {
    setFocused(state === "RUNNING");
    if (state === "STOPPED") {
      // Новый скрамбл после сборки: раньше его нужно было просить кнопкой, и
      // легко было собрать один и тот же скрамбл дважды подряд.
      // saveSolve читает свой scrambleRef синхронно, ещё до того как этот
      // setState доедет до перерисовки, поэтому сборка записывается со своим
      // скрамблом, а не со следующим.
      setRefreshToken((token) => token + 1);
    }
  }, []);

  const handleSolve = useCallback((timeMs: number) => {
    setSolves((previous) => [...previous, { timeMs }]);
  }, []);

  // Во время замера на экране не остаётся ничего, кроме цифр.
  useEffect(() => {
    document.documentElement.dataset.focus = focused ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.focus;
    };
  }, [focused]);

  const recent = solves.map((solve, index) => ({ solve, number: index + 1 })).reverse();

  return (
    <div className="space-y-8">
      <ScrambleDisplay onChange={setScramble} refreshToken={refreshToken} />

      <SmartTimer
        scramble={scramble}
        canSave={canSave}
        onStateChange={handleStateChange}
        onSolve={handleSolve}
      />

      <div data-chrome className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Ao5" value={formatSolveTime(calculateAo5(solves))} testId="ao5" />
          <Stat label="Ao12" value={formatSolveTime(calculateAo12(solves))} testId="ao12" />
        </div>

        {recent.length > 0 && (
          <div className="rounded-card border bg-surface">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">
              Последние сборки
            </h2>
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
                    {!solve.isDNF && solve.isPlusTwo && <Badge tone="warning">+2</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Шаг 4: Добавить правило режима фокуса**

В `src/app/globals.css` дописать:

```css
/* Пока таймер идёт, обвязка гаснет; возвращается при остановке. */
[data-chrome] {
  transition: opacity 150ms ease;
}

[data-focus="on"] [data-chrome] {
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Шаг 5: Упростить страницу таймера**

`src/app/timer/page.tsx` — заголовок и собственный контейнер убрать, страница
становится тонкой обёрткой:

```tsx
import { auth } from "@/auth";
import TimerWorkspace from "@/components/timer/TimerWorkspace";

export const metadata = {
  title: "Таймер | RubikPlatform",
};

export default async function TimerPage() {
  const session = await auth();
  return <TimerWorkspace canSave={Boolean(session?.user)} />;
}
```

- [ ] **Шаг 6: Переписать сквозной сценарий**

Скрамбл переехал с главной на рабочий экран, поэтому сценарий начинается сразу
с `/timer`. Полностью заменить `cypress/e2e/timer.cy.ts`:

```ts
/**
 * Селекторы — только data-testid. Первая версия цеплялась за классы Tailwind
 * (`div.font-mono`), выбирала несколько элементов и ломалась от любой правки
 * оформления.
 */
describe("Рабочий экран", () => {
  const timer = () => cy.get('[data-testid="timer"]');
  const display = () => cy.get('[data-testid="timer-display"]');

  /** Одна сборка: удержать пробел, отпустить, дать часам идти, остановить. */
  function solveOnce() {
    cy.get("body").trigger("keydown", { code: "Space" });
    timer().should("have.attr", "data-state", "READY");
    cy.get("body").trigger("keyup", { code: "Space" });
    timer().should("have.attr", "data-state", "RUNNING");
    cy.wait(150);
    cy.get("body").trigger("keydown", { code: "Space" });
    timer().should("have.attr", "data-state", "STOPPED");
    cy.get("body").trigger("keyup", { code: "Space" });
    timer().should("have.attr", "data-state", "IDLE");
  }

  it("выдаёт скрамбл, засекает время и считает средние", () => {
    cy.visit("/timer");

    cy.get('[data-testid="scramble"]')
      .should("not.have.text", "Генерация...")
      .invoke("text")
      .then((first) => {
        cy.get('[data-testid="new-scramble"]').click();
        cy.get('[data-testid="scramble"]')
          .invoke("text")
          .should((next) => {
            expect(next).to.match(/^[UDLRFB]['2]?( [UDLRFB]['2]?){19}$/);
            expect(next).to.not.equal(first);
          });
      });

    timer().should("have.attr", "data-state", "IDLE");
    cy.get('[data-testid="ao5"]').should("have.text", "-");

    // Скрамбл должен смениться сам после сборки.
    cy.get('[data-testid="scramble"]')
      .invoke("text")
      .then((before) => {
        solveOnce();
        display()
          .invoke("text")
          .should((text) => {
            expect(Number.parseFloat(text)).to.be.greaterThan(0);
          });
        cy.get('[data-testid="scramble"]')
          .invoke("text")
          .should((after) => {
            expect(after).to.not.equal(before);
          });
      });

    cy.get('[data-testid="solve-list"] li').should("have.length", 1);

    // Ao5 появляется ровно на пятой сборке, не раньше.
    for (let i = 0; i < 3; i++) {
      solveOnce();
    }
    cy.get('[data-testid="solve-list"] li').should("have.length", 4);
    cy.get('[data-testid="ao5"]').should("have.text", "-");

    solveOnce();
    cy.get('[data-testid="solve-list"] li').should("have.length", 5);
    cy.get('[data-testid="ao5"]').should("not.have.text", "-");
    cy.get('[data-testid="ao12"]').should("have.text", "-");
  });
});
```

- [ ] **Шаг 7: Прогнать проверки, включая сквозной сценарий**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

Ожидаемо: 47 юнит-тестов из задачи 1 плюс новые — зелёные, сценарий Cypress
проходит. Особое внимание: тесты `dragRotation` и `statistics` не должны даже
дрогнуть — если дрогнули, изменение в `SmartTimer` вышло за рамки аддитивного.

- [ ] **Шаг 8: Проверить в браузере**

- удержание пробела, старт по отпусканию, остановка любой клавишей — как было;
- во время счёта шапка, подвал и статистика гаснут, после остановки возвращаются;
- скрамбл меняется сам после каждой сборки;
- у остановленного таймера сохранённая сборка появляется в списке;
- на 390 px скрамбл переносится, цифры таймера не обрезаются;
- обе темы.

- [ ] **Шаг 9: Коммит и PR**

```bash
git add src/components/timer src/app/timer/page.tsx src/app/globals.css cypress/e2e/timer.cy.ts
git commit -m "feat(#20): рабочий экран со скрамблом, таймером и средними"
git push -u origin feature/issue-20-workspace
gh pr create --base main --title "Рабочий экран: скрамбл, таймер и статистика вместе"
```

---

## Задача 4 — Статистика на реальных данных (ишью #21)

Ветка `feature/issue-21-real-stats`. Зависит от задачи 2.

**Файлы:**
- Создать: `src/lib/solves.ts`, `src/lib/solves.test.ts`, `src/lib/sparkline.ts`,
  `src/lib/sparkline.test.ts`, `src/components/dashboard/Sparkline.tsx`
- Изменить: `src/app/stats/page.tsx`,
  `src/components/dashboard/StatisticsDashboard.tsx`,
  `src/components/timer/TimerWorkspace.tsx`, `src/app/timer/page.tsx`,
  `cypress/e2e/timer.cy.ts`

**Интерфейсы:**
- Потребляет: `SolveResult`, `calculateAo5`, `calculateAo12` из
  `src/lib/statistics.ts`; `prisma` из `src/lib/prisma.ts`; примитивы задачи 2.
- Отдаёт:
  - `toSolveResults(rows: SolveRow[]): SolveResult[]`
  - `getSolvesForUser(userId: string, limit?: number): Promise<SolveResult[]>`
  - `buildSparklinePoints(values: number[], width: number, height: number, padding?: number): SparklinePoint[]`
  - `toPolylinePoints(points: SparklinePoint[]): string`
  - `Sparkline({ values: number[] })`

`src/lib/statistics.ts` **не переписывается**: отбрасывание лучшего и худшего,
штраф +2, правила DNF и округление до 0.01 с по регламенту WCA 9f2 там уже
разобраны и покрыты тестами.

- [ ] **Шаг 1: Написать падающий тест геометрии графика**

Создать `src/lib/sparkline.test.ts`:

```ts
import { buildSparklinePoints, toPolylinePoints } from "./sparkline";
import { DNF } from "./statistics";

describe("геометрия спарклайна", () => {
  it("на пустом списке не даёт точек", () => {
    expect(buildSparklinePoints([], 100, 20)).toEqual([]);
  });

  it("рисует лучшую сборку выше худшей", () => {
    const [slow, fast] = buildSparklinePoints([20000, 10000], 100, 20, 2);
    expect(fast.y).toBeLessThan(slow.y);
  });

  it("растягивает точки на всю ширину за вычетом полей", () => {
    const points = buildSparklinePoints([1, 2, 3], 102, 20, 2);
    expect(points[0].x).toBeCloseTo(2, 5);
    expect(points[2].x).toBeCloseTo(100, 5);
  });

  it("пропускает DNF, не разрывая линию", () => {
    const points = buildSparklinePoints([10000, DNF, 12000], 100, 20);
    expect(points).toHaveLength(2);
  });

  it("не делит на ноль, когда все сборки одинаковы", () => {
    const points = buildSparklinePoints([9000, 9000], 100, 20);
    expect(points.every((point) => Number.isFinite(point.y))).toBe(true);
  });

  it("на единственной сборке ставит одну точку", () => {
    expect(buildSparklinePoints([9000], 100, 20)).toHaveLength(1);
  });

  it("собирает строку для polyline", () => {
    expect(toPolylinePoints([{ x: 1, y: 2 }, { x: 3.456, y: 4 }])).toBe(
      "1.00,2.00 3.46,4.00"
    );
  });
});
```

- [ ] **Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `npx jest src/lib/sparkline.test.ts` → FAIL, модуль не найден.

- [ ] **Шаг 3: Реализовать геометрию**

Создать `src/lib/sparkline.ts`:

```ts
export interface SparklinePoint {
  x: number;
  y: number;
}

/**
 * Точки ломаной для спарклайна прогресса. Значения идут слева направо в
 * хронологическом порядке; DNF (Infinity) пропускаются — линия через них не
 * рвётся и не улетает в бесконечность.
 *
 * Библиотека графиков ради одного графика не окупается, а попадание в палитру
 * при своей реализации точное.
 */
export function buildSparklinePoints(
  values: number[],
  width: number,
  height: number,
  padding = 2
): SparklinePoint[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [];

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  // Все сборки одинаковы — деления на ноль быть не должно.
  const span = max - min || 1;

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const step = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  const points: SparklinePoint[] = [];
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    // Быстрее — выше: ось Y в SVG растёт вниз.
    const ratio = (value - min) / span;
    points.push({
      x: padding + step * index,
      y: padding + ratio * usableHeight,
    });
  });
  return points;
}

export function toPolylinePoints(points: SparklinePoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}
```

- [ ] **Шаг 4: Запустить тест и убедиться, что он проходит**

Запуск: `npx jest src/lib/sparkline.test.ts` → PASS, 7 тестов.

- [ ] **Шаг 5: Написать падающий тест чтения сборок**

Создать `src/lib/solves.test.ts` — проверяется только чистое отображение,
обращение к базе в юнит-тестах не поднимается:

```ts
import { toSolveResults } from "./solves";

describe("отображение строк базы в доменную модель", () => {
  it("переносит идентификатор, время и флаги", () => {
    expect(
      toSolveResults([
        { id: "a", timeMs: 12450, isDNF: false, isPlusTwo: true },
        { id: "b", timeMs: 9800, isDNF: true, isPlusTwo: false },
      ])
    ).toEqual([
      { id: "a", timeMs: 12450, isDNF: false, isPlusTwo: true },
      { id: "b", timeMs: 9800, isDNF: true, isPlusTwo: false },
    ]);
  });

  it("на пустом списке возвращает пустой", () => {
    expect(toSolveResults([])).toEqual([]);
  });
});
```

- [ ] **Шаг 6: Запустить тест и убедиться, что он падает**

Запуск: `npx jest src/lib/solves.test.ts` → FAIL, модуль не найден.

- [ ] **Шаг 7: Реализовать чтение сборок**

Создать `src/lib/solves.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { SolveResult } from "@/lib/statistics";

export interface SolveRow {
  id: string;
  timeMs: number;
  isDNF: boolean;
  isPlusTwo: boolean;
}

export function toSolveResults(rows: SolveRow[]): SolveResult[] {
  return rows.map((row) => ({
    id: row.id,
    timeMs: row.timeMs,
    isDNF: row.isDNF,
    isPlusTwo: row.isPlusTwo,
  }));
}

/**
 * Последние сборки пользователя в хронологическом порядке — средние читают
 * окно с конца. Из базы берутся свежие, потому что интересен хвост, а не
 * начало истории; ограничение сверху не даёт вытащить всю таблицу разом.
 */
export async function getSolvesForUser(
  userId: string,
  limit = 200
): Promise<SolveResult[]> {
  const rows = await prisma.solve.findMany({
    where: { trainingSession: { userId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, timeMs: true, isDNF: true, isPlusTwo: true },
  });
  return toSolveResults(rows).reverse();
}
```

- [ ] **Шаг 8: Запустить тест и убедиться, что он проходит**

Запуск: `npx jest src/lib/solves.test.ts` → PASS, 2 теста.

- [ ] **Шаг 9: Коммит**

```bash
git add src/lib/sparkline.ts src/lib/sparkline.test.ts src/lib/solves.ts src/lib/solves.test.ts
git commit -m "feat(#21): чтение сборок пользователя и геометрия графика"
```

- [ ] **Шаг 10: Нарисовать график**

Создать `src/components/dashboard/Sparkline.tsx`:

```tsx
import { buildSparklinePoints, toPolylinePoints } from "@/lib/sparkline";

const WIDTH = 600;
const HEIGHT = 80;

/** График прогресса: рукописный SVG по токенам оформления. */
export default function Sparkline({ values }: { values: number[] }) {
  const points = buildSparklinePoints(values, WIDTH, HEIGHT);
  if (points.length < 2) return null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-20 w-full"
      role="img"
      aria-label="График времени последних сборок"
      preserveAspectRatio="none"
    >
      <polyline
        points={toPolylinePoints(points)}
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

- [ ] **Шаг 11: Перевести панель статистики на примитивы и график**

В `src/components/dashboard/StatisticsDashboard.tsx`:

- убрать `max-w-4xl`, `bg-white`, `bg-blue-50`, `bg-purple-50`,
  `text-blue-700`, `text-purple-700`, `text-yellow-*`, `divide-gray-200`;
- Ao5 и Ao12 — через `Stat` с `testId="ao5"` и `testId="ao12"`;
- `+2` — через `Badge tone="warning"`, DNF — `text-danger`;
- добавить `Sparkline` по эффективным временам сборок;
- вместо прочерка при нехватке сборок показывать, сколько ещё нужно:

```tsx
/** Не прочерк, а сколько ещё осталось: прочерк ничего не объясняет. */
function averageHint(count: number, needed: number): string | null {
  if (count >= needed) return null;
  return `ещё ${needed - count} до Ao${needed}`;
}
```

- [ ] **Шаг 12: Перевести страницу статистики на реальные данные**

Полностью заменить `src/app/stats/page.tsx`:

```tsx
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

  return <StatisticsDashboard solves={solves} />;
}
```

Выдуманный массив `mockSolves` удаляется целиком.

- [ ] **Шаг 13: Подтянуть сохранённые сборки на рабочий экран**

`src/app/timer/page.tsx` начинает передавать историю:

```tsx
export default async function TimerPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const initialSolves = userId ? await getSolvesForUser(userId) : [];

  return (
    <TimerWorkspace canSave={Boolean(session?.user)} initialSolves={initialSolves} />
  );
}
```

В `TimerWorkspace` добавить проп `initialSolves: SolveResult[]` и начинать с
него: `useState<SolveResult[]>(initialSolves)`. Тогда Ao5 и Ao12 на рабочем
экране считаются с учётом прошлых тренировок, а не с нуля.

- [ ] **Шаг 14: Поправить сквозной сценарий**

Анонимный посетитель больше не видит ни выдуманных средних, ни списка: на
`/stats` его встречает приглашение войти. Дописать в `cypress/e2e/timer.cy.ts`:

```ts
  it("не показывает чужую статистику тому, кто не вошёл", () => {
    cy.visit("/stats");
    cy.contains("Статистика появится после входа").should("be.visible");
    cy.contains("a", "Войти").should("have.attr", "href", "/login");
  });
```

Проверка Ao5 на реальной базе требует посеянного пользователя и входа в
сценарии — это отдельная работа, в объём редизайна она не входит. Записать её
в `TECHDEBT.md` как осознанно отложенную.

- [ ] **Шаг 15: Прогнать проверки**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

- [ ] **Шаг 16: Проверить в браузере**

Три пустых состояния проверяются отдельно, и ни одно не должно быть пустым
списком:

1. выйти из аккаунта, открыть `/stats` → приглашение войти;
2. войти новым пользователем → приглашение начать со ссылкой на рабочий экран;
3. записать 3 сборки → вместо прочерка «ещё 2 до Ao5»;
4. записать 5 сборок → Ao5 считается, график появляется.

Обе темы, 390 px.

- [ ] **Шаг 17: Коммит и PR**

```bash
git add src/lib src/components/dashboard src/app/stats/page.tsx src/app/timer/page.tsx src/components/timer/TimerWorkspace.tsx cypress/e2e/timer.cy.ts
git commit -m "feat(#21): статистика на реальных сборках и график прогресса"
git push -u origin feature/issue-21-real-stats
gh pr create --base main --title "Статистика на реальных данных и график прогресса"
```

---

## Задача 5 — Лендинг (ишью #22)

Ветка `feature/issue-22-landing`. Зависит от задачи 3: забирает у неё генератор
скрамблов с главной.

**Файлы:**
- Создать: `src/components/cube/CubeHero.tsx`
- Изменить: `src/app/page.tsx`

**Интерфейсы:**
- Потребляет: `Button`, `Card` из задачи 2; `RubiksCube` из
  `src/components/cube/RubiksCube.tsx`.
- Отдаёт: `CubeHero` — клиентский компонент с ленивой загрузкой куба.

- [ ] **Шаг 1: Написать обёртку с ленивой загрузкой**

Куб не должен блокировать отрисовку и не должен грузиться там, где его не
потянут. `ssr: false` в серверном компоненте использовать нельзя — Next это
прямо запрещает (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`:
«`ssr: false` is not supported in Server Components»), поэтому нужна клиентская
обёртка. Создать `src/components/cube/CubeHero.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/** Запасной статичный вариант: показывается до загрузки и при reduced-motion. */
function CubePoster() {
  return (
    <div
      className="grid h-full w-full place-items-center rounded-card border bg-surface-2"
      aria-hidden
    >
      <div className="grid grid-cols-3 gap-1.5 rotate-12">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className="h-8 w-8 rounded-[4px] border bg-surface" />
        ))}
      </div>
    </div>
  );
}

const RubiksCube = dynamic(() => import("./RubiksCube"), {
  ssr: false,
  loading: () => <CubePoster />,
});

export default function CubeHero() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAnimated(!query.matches);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <div className="h-[320px] w-full sm:h-[420px]">
      {animated ? <RubiksCube /> : <CubePoster />}
    </div>
  );
}
```

- [ ] **Шаг 2: Собрать первый экран**

Полностью заменить `src/app/page.tsx`. Генератор скрамблов с главной уходит —
он живёт на рабочем экране. Страница остаётся статически отрисовываемой:
серверный компонент, никаких запросов и request-time API.

```tsx
import Link from "next/link";
import CubeHero from "@/components/cube/CubeHero";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const FEATURES = [
  {
    title: "Скрамблы по правилам WCA",
    text: "Двадцать движений, без повторов подряд — как на официальных стартах.",
  },
  {
    title: "Таймер с удержанием пробела",
    text: "Старт по отпусканию, остановка любой клавишей. Во время замера экран пустеет.",
  },
  {
    title: "Ao5 и Ao12",
    text: "Средние считаются по регламенту: лучшая и худшая сборки отбрасываются.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Научитесь собирать кубик и следите за прогрессом
          </h1>
          <p className="text-lg text-muted">
            Скрамблы по правилам WCA, таймер и 3D-тренажёр на одной странице.
          </p>
          <Link href="/timer" className="inline-block">
            <Button className="px-6 py-3 text-base">Начать тренировку</Button>
          </Link>
        </div>
        <CubeHero />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted">{feature.text}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Шаг 3: Проверить, что страница осталась статической**

```bash
npm run build
```

В выводе сборки у маршрута `/` должен стоять значок статической отрисовки. Если
он стал динамическим — в дерево страницы попал request-time API, искать и
убирать.

- [ ] **Шаг 4: Прогнать проверки и проверить в браузере**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
```

В браузере: куб появляется без блокировки отрисовки; при включённом
«уменьшить движение» в системе вместо него статичная раскладка; на 390 px
первый экран не ломается; обе темы.

- [ ] **Шаг 5: Коммит и PR**

```bash
git add src/app/page.tsx src/components/cube/CubeHero.tsx
git commit -m "feat(#22): лендинг с живым кубом и одним входом в тренировку"
git push -u origin feature/issue-22-landing
gh pr create --base main --title "Лендинг"
```

---

## Задача 6 — Оформление 3D-куба (ишью #23)

Ветка `feature/issue-23-cube-look`. **Независима от остальных, можно вести
параллельно** — общих файлов с задачами 1–5 у неё нет, кроме токенов.

**Файлы:**
- Создать: `src/components/cube/cubeTheme.ts`
- Изменить: `src/components/cube/RubiksCube.tsx`

**Интерфейсы:**
- Потребляет: `@react-three/fiber`, `@react-three/drei` (уже установлены), `three`.
- Отдаёт: ничего наружу; публичный API `RubiksCubeRef.rotateSlice` не меняется.

**Что нельзя потерять:**
1. `dragRotation.ts` и логика указателя не трогаются — там разобраны три
   отдельных дефекта, поведение закреплено 29 тестами.
2. Дисциплина ресурсов: геометрия и материалы создаются один раз на
   монтирование и освобождаются при размонтировании.

- [ ] **Шаг 1: Свести палитру куба с токенами**

Three не читает CSS-переменные, поэтому цвета задаются литералами. Создать
`src/components/cube/cubeTheme.ts`:

```ts
/**
 * Палитра куба. Значения сведены с токенами оформления вручную: WebGL не видит
 * CSS-переменные, поэтому при правке --surface и соседей эти литералы надо
 * менять здесь же.
 */

/** Стикеры в порядке материалов BoxGeometry: +X, -X, +Y, -Y, +Z, -Z. */
export const STICKER_COLORS = [
  "#C41E1E", // право
  "#F26B1D", // лево
  "#F2F3F5", // верх
  "#F5C518", // низ
  "#1FA85C", // фронт
  "#1F5FD0", // тыл
] as const;

/** Корпус: чуть светлее фона тёмной темы, чтобы щели не читались дырами. */
export const BODY_COLOR = "#15181D";
```

- [ ] **Шаг 2: Заменить геометрию кубика на скруглённую**

В `RubiksCube.tsx` добавить построение скруглённого параллелепипеда. Рецепт —
тот же, что внутри `RoundedBox` из `drei`: плоская скруглённая рамка,
выдавленная с фаской. Повторяем его вручную, потому что `drei` экспортирует
`RoundedBoxGeometry` как JSX-компонент, а кубики здесь собираются императивно
через `new THREE.Mesh`; брать же класс из `three-stdlib` нельзя — она в дереве
только как транзитивная зависимость `drei`, в `package.json` её нет.

```ts
const CUBIE_SIZE = 0.98;
const CORNER_RADIUS = 0.12;
const STICKER_SIZE = 0.76;

/** Скруглённый куб: рецепт RoundedBox из drei, воспроизведённый вручную. */
function createRoundedCubieGeometry(size: number, radius: number): THREE.ExtrudeGeometry {
  const eps = 0.00001;
  const inner = radius - eps;
  const shape = new THREE.Shape();
  shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
  shape.absarc(eps, size - inner * 2, eps, Math.PI, Math.PI / 2, true);
  shape.absarc(size - inner * 2, size - inner * 2, eps, Math.PI / 2, 0, true);
  shape.absarc(size - inner * 2, eps, eps, 0, -Math.PI / 2, true);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: size - radius * 2,
    bevelEnabled: true,
    bevelSegments: 6,
    steps: 1,
    bevelSize: inner,
    bevelThickness: radius,
    curveSegments: 4,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}
```

- [ ] **Шаг 3: Вынести стикеры в отдельные плоскости**

Сейчас цвет граней задаётся шестью материалами в порядке групп `BoxGeometry`.
У выдавленной геометрии таких групп нет, и это не помеха, а ровно то, чего
требует спека: корпус становится единым тёмным материалом, а стикеры — шестью
плоскостями, слегка утопленными в него. Промежутки перестают быть чёрными
дырами.

Расширить `useCubeResources`: одна общая `PlaneGeometry(STICKER_SIZE, STICKER_SIZE)`,
шесть `MeshStandardMaterial` по `STICKER_COLORS`, один `BODY_COLOR` для корпуса.
Все они, как и раньше, создаются в `useMemo` и освобождаются в `useEffect`
при размонтировании — включая новую геометрию стикера.

Для каждого кубика собирается корпус, а к нему добавляются дочерние плоскости
только для внешних граней:

```ts
const STICKER_FACES = [
  { axis: "x", sign: 1, rotation: [0, Math.PI / 2, 0] },
  { axis: "x", sign: -1, rotation: [0, -Math.PI / 2, 0] },
  { axis: "y", sign: 1, rotation: [-Math.PI / 2, 0, 0] },
  { axis: "y", sign: -1, rotation: [Math.PI / 2, 0, 0] },
  { axis: "z", sign: 1, rotation: [0, 0, 0] },
  { axis: "z", sign: -1, rotation: [0, Math.PI, 0] },
] as const;

/** Чуть утопить в корпус, иначе плоскость мерцает на поверхности. */
const STICKER_INSET = CUBIE_SIZE / 2 - 0.012;
```

- [ ] **Шаг 4: Сохранить работу жестов**

Самое опасное место задачи. `handlePointerDown` берёт нормаль грани:
`event.face?.normal?.clone().transformDirection(...).round()`. У скруглённого
корпуса нормали на фаске **не осевые**, и `.round()` вернёт неверную ось — жест
начнёт поворачивать не тот слой.

Решение: интерактивны только стикеры. У `PlaneGeometry` нормаль в локальных
координатах всегда `(0, 0, 1)`, после переноса в мир она точно осевая, и
контракт `resolveDragRotation` сохраняется без единой правки.

1. Корпусу отключить попадание луча: `bodyMesh.raycast = () => null;`
2. В `handlePointerDown` брать кубик как родителя стикера:

```ts
    const sticker = event.object as THREE.Mesh;
    const cubie = sticker.parent as THREE.Mesh;
    dragStart.current = {
      point: event.point.clone(),
      normal:
        event.face?.normal?.clone().transformDirection(sticker.matrixWorld).round() ??
        new THREE.Vector3(),
      mesh: cubie,
    };
```

`dragStart.mesh` используется дальше только в `getWorldPosition(origin)`, так
что родительский кубик — ровно то, что нужно. `handlePointerMove`,
`endSliceGesture`, `endPointerSession` и `dragRotation.ts` **не меняются**.

Следствие: драг по щели между кубиками больше не начинает поворот слоя, а
вращает камеру. Это осознанно — щель не стикер.

- [ ] **Шаг 5: Добавить свет, отражения и тень**

В `RubiksCube.tsx` заменить содержимое `<Canvas>`:

```tsx
      <Canvas
        camera={{ position: [5, 5, 5], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1.2} />
        <CubeCore ref={ref} onRotateEnd={onRotateEnd} setOrbitEnabled={setOrbitEnabled} />
        {/*
          Окружение собирается из источников прямо здесь. Пресеты (preset="...")
          использовать нельзя: drei скачивает для них HDRI с raw.githack.com в
          рантайме — это внешняя зависимость, которой в спеке нет. С детьми и без
          preset/files загрузчик не вызывается вовсе.
        */}
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={6} />
          <Lightformer form="rect" intensity={1} position={[-4, 1, 2]} scale={4} />
        </Environment>
        <ContactShadows position={[0, -1.7, 0]} opacity={0.45} blur={2.4} far={4} />
        <OrbitControls enablePan={false} enableZoom enabled={orbitEnabled} />
      </Canvas>
```

Импорты: `import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";`

- [ ] **Шаг 6: Прогнать проверки**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Ожидаемо: 29 тестов `dragRotation` зелёные **без единой правки**. Если
понадобилось поменять тест — значит, поведение жеста изменилось, и это ошибка,
а не повод править тест.

- [ ] **Шаг 7: Проверить руками на `/trainer`**

- поворот слоя драгом по стикеру работает на всех шести гранях, включая драг,
  переходящий с одной грани на соседнюю;
- драг вне куба вращает камеру, во время поворота слоя камера не уезжает;
- рёбра скруглены, щели не выглядят чёрными дырами, есть контактная тень;
- частота кадров: открыть панель производительности браузера, покрутить куб
  20–30 секунд, убедиться, что держится около 60 кадров;
- утечек нет: уйти со страницы и вернуться 5 раз, сравнить число объектов
  в снимке кучи — оно не должно расти монотонно.

- [ ] **Шаг 8: Коммит и PR**

```bash
git add src/components/cube/RubiksCube.tsx src/components/cube/cubeTheme.ts
git commit -m "feat(#23): скруглённые рёбра, стикеры-плоскости, отражения и тень"
git push -u origin feature/issue-23-cube-look
gh pr create --base main --title "Оформление 3D-куба"
```

---

## Порядок вливания

```
#18 токены ──┬── #19 каркас ──┬── #20 рабочий экран ── #22 лендинг
             │                └── #21 статистика
             └── #23 куб (параллельно)
```

Каждая задача — отдельный PR со своим ишью и скриншотами. Фундамент (#18, #19)
вливается первым. После каждого вливания следующая ветка получает статус
`BEHIND`: подтянуть `gh pr update-branch N`, дождаться проверок, влить
merge-коммитом. `--admin` не использовать.

**Не начинать следующую задачу без явного подтверждения владельца.**

## Самопроверка плана

Покрытие спеки по разделам:

| Раздел спеки | Где в плане |
|---|---|
| 1. Токены и темизация | Задача 1, шаги 8, 11 |
| Переключатель темы | Задача 1, шаги 12–15 |
| Типографика (Arial, табличные цифры) | Задача 1, шаги 8, 11; задача 3, шаг 1 |
| 2. Каркас и примитивы | Задача 2, шаги 1–4 |
| Формы на Field и Button | Задача 2, шаг 4 |
| 3. Рабочий экран | Задача 3, шаг 3 |
| Режим фокуса | Задача 3, шаги 1, 3, 4 |
| Новый скрамбл после сборки | Задача 3, шаги 2, 3 |
| 4. Статистика на реальных данных | Задача 4, шаги 7, 12 |
| График прогресса | Задача 4, шаги 1–4, 10 |
| Три пустых состояния | Задача 4, шаги 11, 12, 16 |
| 5. Лендинг | Задача 5, шаги 1–3 |
| 6. Оформление куба | Задача 6, шаги 1–5 |
| Доступность: контраст AA | Задача 1, шаги 6–9, 19 |
| Доступность: видимый фокус | Задача 1, шаг 8; задача 2, шаг 6 |
| `prefers-reduced-motion` | Задача 1, шаг 8; задача 5, шаг 1 |
| Проверка: скриншоты в обеих темах | Критерии готовности задач 1–5 |
| Проверка: 47 тестов зелёные | Общие ограничения; шаги проверок |
| Проверка: E2E под новую компоновку | Задача 3, шаг 6; задача 4, шаг 14 |
| Проверка: кадры и утечки у куба | Задача 6, шаг 7 |

Открытые вопросы, сознательно оставленные за рамками:

1. **Сквозной сценарий не проверяет Ao5 на реальной базе.** Для этого нужен
   посеянный пользователь и вход внутри сценария. Записать в `TECHDEBT.md`.
2. **Страница `/styleguide` остаётся в сборке.** Она не ведёт из навигации, но
   доступна по прямой ссылке и служит справкой по токенам. Если владелец
   захочет убрать её из продакшена — это отдельная правка.
3. **Палитра куба продублирована литералами** в `cubeTheme.ts`: WebGL не видит
   CSS-переменные. Связь поддерживается вручную, о чём сказано в комментарии.
