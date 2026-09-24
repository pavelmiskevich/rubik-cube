import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LocalProgressMerge from "@/components/learn/LocalProgressMerge";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Любой вход ведёт сюда — здесь прогресс анонима и переезжает в аккаунт. */}
      <LocalProgressMerge />
      <Card className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <h1 className="text-2xl font-bold">Профиль</h1>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="danger">
              Выйти
            </Button>
          </form>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-surface-2">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <svg
                className="h-full w-full text-muted"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">
              {session.user.name || "Пользователь"}
            </h2>
            <p className="truncate text-muted">{session.user.email}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
