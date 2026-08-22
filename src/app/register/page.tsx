"use client";

import { useState } from "react";
import { registerUser } from "@/actions/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const res = await registerUser(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/login?registered=true");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Регистрация
          </h2>
        </div>
        <form action={handleSubmit} className="mt-8 space-y-6">
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="name" className="sr-only">Имя</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="relative block w-full rounded-t-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Имя"
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="relative block w-full border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
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
              {loading ? "Загрузка..." : "Зарегистрироваться"}
            </button>
          </div>
        </form>
        <div className="text-center text-sm">
          Есть аккаунт?{" "}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
