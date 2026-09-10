import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-24">
      <div className="w-full max-w-2xl space-y-8 rounded-xl bg-white p-10 shadow-md">
        <div className="flex items-center justify-between border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Профиль</h1>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              Выйти
            </button>
          </form>
        </div>

        <div className="flex items-center space-x-6">
          <div className="relative h-24 w-24 overflow-hidden rounded-full bg-gray-100">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="Profile picture"
                fill
                className="object-cover"
              />
            ) : (
              <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{session.user.name || "Пользователь"}</h2>
            <p className="text-gray-500">{session.user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
