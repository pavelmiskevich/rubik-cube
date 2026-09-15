"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 p-4">
        <Link href="/" className="text-xl font-bold text-indigo-600">
          RubikPlatform
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
          {session?.user ? (
            <>
              <Link href="/profile" className="text-gray-600 hover:text-indigo-600">
                Профиль
              </Link>
              <button 
                onClick={() => signOut()} 
                className="text-red-600 hover:text-red-500"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-indigo-600">
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500"
              >
                Регистрация
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
