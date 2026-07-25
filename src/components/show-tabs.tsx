"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "details", label: "Details" },
  { segment: "booth-types", label: "Booth Types" },
  { segment: "booths", label: "Booths" },
  { segment: "floorplan", label: "Floorplan" },
  { segment: "islands", label: "Islands" },
  { segment: "phases", label: "Phases" },
  { segment: "applications", label: "Applications" },
];

export function ShowTabs({ showId }: { showId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
      {TABS.map((tab) => {
        const href = `/dashboard/shows/${showId}/${tab.segment}`;
        const isActive = pathname === href;

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${
              isActive
                ? "border-black text-black dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
