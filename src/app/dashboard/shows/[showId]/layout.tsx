import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShowTabs } from "@/components/show-tabs";

export default async function ShowLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const current = await getCurrentUserWithRoles();

  if (!current) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: show } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date, venue_name")
    .eq("id", showId)
    .single();

  if (!show) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        <Link href="/dashboard" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Dashboard
        </Link>
      </header>

      <div className="flex flex-col gap-1 px-4 pt-6 pb-4">
        <h1 className="text-lg font-semibold">{show.name}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {show.start_date} – {show.end_date} · {show.venue_name}
        </p>
      </div>

      <div className="px-4">
        <ShowTabs showId={show.id} />
      </div>

      <main className="flex flex-1 flex-col gap-8 px-4 py-6">{children}</main>
    </div>
  );
}
