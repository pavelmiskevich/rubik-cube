import { Suspense } from "react";
import { connection } from "next/server";
import { googleConfigured } from "@/lib/googleAuth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // Ключи Google читаются при запросе, а не при сборке: образ собирается в CI
  // без них, и предварительный рендер навсегда запомнил бы «кнопки нет» (#124).
  await connection();
  const google = googleConfigured();

  return (
    <div className="mx-auto w-full max-w-md">
      <Suspense fallback={<p className="text-muted">Загрузка...</p>}>
        <LoginForm google={google} />
      </Suspense>
    </div>
  );
}
