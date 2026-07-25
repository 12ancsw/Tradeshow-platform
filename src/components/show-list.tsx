import Link from "next/link";

type Show = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue_name: string;
};

export function ShowList({ shows }: { shows: Show[] }) {
  if (shows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No shows yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {shows.map((show) => (
        <li key={show.id}>
          <Link
            href={`/dashboard/shows/${show.id}`}
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
  );
}
