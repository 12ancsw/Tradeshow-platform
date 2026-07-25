import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { ShowList } from "@/components/show-list";
import { ShowForm } from "@/components/show-form";
import { AssignStaffForm } from "@/components/assign-staff-form";

export default async function OrganiserDetailPage({
  params,
}: {
  params: Promise<{ organiserId: string }>;
}) {
  const { organiserId } = await params;
  const current = await getCurrentUserWithRoles();

  if (!current) {
    redirect("/login");
  }

  const isPlatformAdmin = current.roles.some((role) => role.role === "platform_admin");

  if (!isPlatformAdmin) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { data: organiser } = await supabase
    .from("organisers")
    .select("id, name, slug, status")
    .eq("id", organiserId)
    .single();

  if (!organiser) {
    notFound();
  }

  const { data: shows } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date, venue_name, logo_path")
    .eq("organiser_id", organiserId)
    .order("start_date", { ascending: true });

  const showsWithLogoUrl = (shows ?? []).map(({ logo_path, ...show }) => ({
    ...show,
    logo_url: logo_path
      ? supabase.storage.from("show-logos").getPublicUrl(logo_path).data.publicUrl
      : null,
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        <Link href="/dashboard" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Dashboard
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 py-6">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard" className="text-sm text-zinc-500 underline dark:text-zinc-400">
            ← All organisers
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{organiser.name}</h1>
            <StatusBadge status={organiser.status} />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">/{organiser.slug}</p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Shows</h2>
          <ShowList shows={showsWithLogoUrl} />
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <h3 className="font-medium">Create Show</h3>
          <ShowForm organiserId={organiser.id} />
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <h3 className="font-medium">Assign Organiser Staff</h3>
          <AssignStaffForm organiserId={organiser.id} />
        </section>
      </main>
    </div>
  );
}
