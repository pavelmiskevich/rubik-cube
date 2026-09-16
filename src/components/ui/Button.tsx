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
      /*
        Отключённая кнопка гасится в нейтральный, а не в акцент под прозрачностью:
        приглушённый акцент продолжает читаться как «главное действие», что для
        непрожимаемой кнопки ровно неверный сигнал. Вариант disabled: перебивает
        заливку варианта по специфичности (класс + псевдокласс).
      */
      className={`inline-flex items-center justify-center rounded-control px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:hover:opacity-100 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
