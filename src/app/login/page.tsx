"use client";

import { useState, Suspense } from "react";
import { loginUser } from "@/actions/auth";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";

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
    <Card className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Вход в аккаунт</h1>
        {registered && (
          <p className="text-sm text-success">
            Регистрация успешна — теперь можно войти.
          </p>
        )}
      </div>

      <form action={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Field
          label="Электронная почта"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Пароль"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Загрузка..." : "Войти"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        Или
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => signIn("google", { redirectTo: "/profile" })}
      >
        Войти через Google
      </Button>

      <p className="text-center text-sm text-muted">
        Нет аккаунта?{" "}
        <Link
          href="/register"
          className="font-semibold text-accent-text hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Suspense fallback={<p className="text-muted">Загрузка...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
