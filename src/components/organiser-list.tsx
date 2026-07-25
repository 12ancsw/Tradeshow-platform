import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";

type Organiser = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export function OrganiserList({ organisers }: { organisers: Organiser[] }) {
  if (organisers.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No organisers yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {organisers.map((organiser) => (
        <li key={organiser.id}>
          <Link
            href={`/dashboard/organisers/${organiser.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
          >
            <span className="flex flex-col">
              <span className="font-medium">{organiser.name}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">/{organiser.slug}</span>
            </span>
            <StatusBadge status={organiser.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
