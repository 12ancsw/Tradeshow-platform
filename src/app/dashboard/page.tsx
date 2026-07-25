import { redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { HomeContent } from "./home-content";

export default async function DashboardPage() {
  const current = await getCurrentUserWithRoles();

  if (!current) {
    redirect("/login");
  }

  const supabase = await createClient();
  const isPlatformAdmin = current.roles.some((role) => role.role === "platform_admin");
  const organiserStaffIds = current.roles
    .filter((role) => role.role === "organiser_staff" && role.organiser_id)
    .map((role) => role.organiser_id as string);

  const [organisersResult, organiserStaffData] = await Promise.all([
    isPlatformAdmin
      ? supabase
          .from("organisers")
          .select("id, name, slug, status")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    Promise.all(
      organiserStaffIds.map(async (organiserId) => {
        const [{ data: organiser }, { data: shows }] = await Promise.all([
          supabase.from("organisers").select("id, name, slug, status").eq("id", organiserId).single(),
          supabase
            .from("shows")
            .select("id, name, start_date, end_date, venue_name")
            .eq("organiser_id", organiserId)
            .order("start_date", { ascending: true }),
        ]);

        return { organiserId, organiser, shows: shows ?? [] };
      }),
    ),
  ]);

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

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <HomeContent
          name={current.name ?? current.user.email ?? "there"}
          roles={current.roles}
          allOrganisers={organisersResult.data ?? undefined}
          organiserStaffData={organiserStaffData}
        />
      </main>
    </div>
  );
}
