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
