"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import Button from "./ui/Button";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    /* data-chrome — по нему задача 3 гасит обвязку во время замера. */
    <nav data-chrome className="sticky top-0 z-10 border-b bg-bg">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="text-xl font-bold text-accent-text">
          RubikPlatform
        </Link>
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
