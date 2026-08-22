"use client";

import { useState } from "react";
import { loginUser } from "@/actions/auth";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const res = await loginUser(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-md">
      <div className="text-center">
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
          Вход в аккаунт
        </h2>
        {registered && (
          <p className="mt-2 text-sm text-green-600">
            Регистрация успешна! Теперь вы можете войти.
          </p>
        )}
      </div>
      <form action={handleSubmit} className="mt-8 space-y-6">
        {error && <div className="text-sm text-red-500">{error}</div>}
        <div className="space-y-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="relative block w-full rounded-t-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              placeholder="Email address"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="relative block w-full rounded-b-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              placeholder="Password"
            />
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {loading ? "Загрузка..." : "Войти"}
          </button>
        </div>
      </form>
      
      <div className="mt-6 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">Или</span>
        </div>
      </div>
      
      <div className="mt-6">
        <button
          onClick={() => signIn("google", { callbackUrl: "/profile" })}
          className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold leading-6 text-gray-900 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Войти через Google
        </button>
      </div>

      <div className="text-center text-sm">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Зарегистрироваться
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <Suspense fallback={<div>Загрузка...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
