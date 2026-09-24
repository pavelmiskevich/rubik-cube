"use client";

import { useEffect, useId, useRef, useState } from "react";
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

/*
  На телефоне под кнопку уходит второстепенное — вход и тема, а разделы
  остаются на виду: ради них шапка и появилась (#48), и прятать их первыми
  значило бы отчасти вернуть исходную проблему. Так на 390 px шапка — два
  ряда: логотип с кнопкой и разделы. С sm и шире кнопки нет, и шапка ровно
  такая, какой была.
*/
export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  /*
    Замер гасит обвязку через data-focus на <html>. Раскрытое меню гаснет с
    ней, но одной прозрачности мало: фокус внутри панели остался бы, и Enter,
    которым останавливают таймер, заодно нажал бы невидимую кнопку — вплоть
    до «Выйти». Поэтому с началом замера меню закрывается, и скрытая панель
    выпадает из фокуса.
  */
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (root.dataset.focus === "on") setMenuOpen(false);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-focus"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      buttonRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  // Переход по ссылке из панели закрывает меню; переключение темы — нет,
  // чтобы было видно, какая выбрана.
  const closeOnLink = (event: React.MouseEvent) => {
    if ((event.target as Element).closest("a")) setMenuOpen(false);
  };

  return (
    /* data-chrome — по нему задача 3 гасит обвязку во время замера. */
    <nav ref={navRef} data-chrome className="sticky top-0 z-10 border-b bg-bg">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 sm:w-auto">
          <div className="flex w-full items-center justify-between sm:w-auto">
            <Link href="/" className="text-xl font-bold text-accent-text">
              RubikPlatform
            </Link>
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls={panelId}
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-control border px-3 py-1 text-sm font-medium text-muted hover:text-text sm:hidden"
            >
              {menuOpen ? "Закрыть" : "Меню"}
            </button>
          </div>
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
        <div
          id={panelId}
          onClick={closeOnLink}
          className={`${
            menuOpen
              ? "absolute inset-x-0 top-full flex flex-col items-start gap-4 border-y bg-bg px-4 py-4"
              : "hidden"
          } text-sm font-medium sm:static sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:border-0 sm:bg-transparent sm:p-0`}
        >
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
