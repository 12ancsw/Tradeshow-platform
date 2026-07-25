import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ShowsPage() {
  const supabase = await createClient();
  const { data: shows } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date, venue_name")
    .order("start_date", { ascending: true });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        <Link href="/dashboard" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Dashboard
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <h1 className="text-lg font-semibold">Shows</h1>
        {shows && shows.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {shows.map((show) => (
              <li key={show.id}>
                <Link
                  href={`/shows/${show.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
                >
                  <span className="font-medium">{show.name}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {show.start_date} – {show.end_date} · {show.venue_name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No shows yet.</p>
        )}
      </main>
    </div>
  );
}
