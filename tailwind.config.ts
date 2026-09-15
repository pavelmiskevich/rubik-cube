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
