"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import Button from "./ui/Button";

/*
  Подписи повторяют заголовки самих разделов. Слово «Тренировка» из спеки в
  шапку не попало: рядом с ним «Тренажёр» читается как тот же раздел, а это
  разные экраны — замер времени и куб, который крутят руками.
*/
const SECTIONS = [
  { href: "/learn", label: "Учиться" },
  { href: "/timer", label: "Таймер" },
  { href: "/trainer", label: "Тренажёр" },
  { href: "/stats", label: "Статистика" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    /* data-chrome — по нему задача 3 гасит обвязку во время замера. */
    <nav data-chrome className="sticky top-0 z-10 border-b bg-bg">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="text-xl font-bold text-accent-text">
            RubikPlatform
          </Link>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
            {SECTIONS.map((section) => {
              /* Вложенные маршруты вроде /learn/[slug] тоже подсвечивают раздел. */
              const active =
                pathname === section.href ||
                pathname.startsWith(`${section.href}/`);

              return (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    aria-current={active ? "page" : undefined}
                    /*
                      Активный раздел отличается не только цветом: подчёркивание
                      остаётся заметным и тем, кто цвет различает плохо.
                    */
                    className={
                      active
                        ? "text-text underline decoration-accent-text decoration-2 underline-offset-8"
                        : "text-muted hover:text-text"
                    }
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
          {session?.user ? (
            <>
              <Link href="/profile" className="text-muted hover:text-text">
                Профиль
              </Link>
              <button
                onClick={() => signOut()}
                className="text-danger hover:opacity-80"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-text">
                Войти
              </Link>
              <Link href="/register">
                <Button>Регистрация</Button>
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
