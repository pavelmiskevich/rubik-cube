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
