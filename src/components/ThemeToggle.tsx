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
