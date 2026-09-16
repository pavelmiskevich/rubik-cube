"use client";

import { useState } from "react";
import { registerUser } from "@/actions/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";

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
    <div className="mx-auto w-full max-w-md">
      <Card className="space-y-6">
        <h1 className="text-center text-2xl font-bold">Регистрация</h1>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Field label="Имя" name="name" type="text" autoComplete="name" required />
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
            autoComplete="new-password"
            required
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Загрузка..." : "Зарегистрироваться"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted">
          Есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-semibold text-accent-text hover:underline"
          >
            Войти
          </Link>
        </p>
      </Card>
    </div>
  );
}
