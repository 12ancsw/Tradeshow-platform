import { redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { logout } from "./actions";
import { HomeContent } from "./home-content";

export default async function DashboardPage() {
  const current = await getCurrentUserWithRoles();

  if (!current) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-500 underline dark:text-zinc-400"
          >
            Log out
          </button>
        </form>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <HomeContent name={current.name ?? current.user.email ?? "there"} roles={current.roles} />
      </main>
    </div>
  );
}
