"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppRole, UserRoleRow } from "@/lib/auth";
import { OrganiserList } from "@/components/organiser-list";
import { OrganiserForm } from "@/components/organiser-form";
import { ShowList } from "@/components/show-list";
import { ShowForm } from "@/components/show-form";
import { MyApplications } from "@/components/my-applications";

const ROLE_LABELS: Record<AppRole, string> = {
  platform_admin: "Platform Admin",
  organiser_staff: "Organiser Staff",
  vendor: "Vendor",
  attendee: "Attendee",
};

type Organiser = { id: string; name: string; slug: string; status: string };
type Show = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue_name: string;
  logo_url?: string | null;
};
type OrganiserStaffEntry = { organiserId: string; organiser: Organiser | null; shows: Show[] };
type Application = {
  id: string;
  showId: string;
  showName: string;
  showPaymentInstructions: string | null;
  phaseName: string;
  status: string;
  isSelfSelected: boolean;
  paymentStatus: string;
  amount: number;
  proofUrl: string | null;
  paymentNotes: string | null;
  boothRefs: string[];
  islandRef: string | null;
};

function roleKey(role: UserRoleRow) {
  return `${role.role}:${role.organiser_id ?? ""}`;
}

function organiserNameFor(role: UserRoleRow, organiserStaffData: OrganiserStaffEntry[]) {
  return organiserStaffData.find((entry) => entry.organiserId === role.organiser_id)?.organiser?.name;
}

function roleLabel(role: UserRoleRow, organiserStaffData: OrganiserStaffEntry[]) {
  if (role.role === "organiser_staff") {
    const organiserName = organiserNameFor(role, organiserStaffData);
    return organiserName ? `Organiser Staff — ${organiserName}` : "Organiser Staff";
  }
  return ROLE_LABELS[role.role];
}

export function HomeContent({
  name,
  roles,
  allOrganisers,
  organiserStaffData,
  myApplications,
}: {
  name: string;
  roles: UserRoleRow[];
  allOrganisers?: Organiser[];
  organiserStaffData: OrganiserStaffEntry[];
  myApplications: Application[];
}) {
  const [activeKey, setActiveKey] = useState(roles.length > 0 ? roleKey(roles[0]) : "");
  const activeRole = roles.find((role) => roleKey(role) === activeKey) ?? roles[0];

  const activeStaffEntry =
    activeRole?.role === "organiser_staff"
      ? organiserStaffData.find((entry) => entry.organiserId === activeRole.organiser_id)
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {activeRole ? (
          <p className="text-lg font-medium">
            Logged in as {name}, role: {roleLabel(activeRole, organiserStaffData)}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg font-medium">Logged in as {name}</p>
            <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              You don&apos;t have any roles yet — you&apos;ll pick one (vendor or guest) when you
              apply to a show or get a ticket.
            </p>
            <Link
              href="/shows"
              className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Browse Shows
            </Link>
          </div>
        )}

        {roles.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-center text-zinc-500 dark:text-zinc-400">Switch role</span>
            <select
              value={activeKey}
              onChange={(event) => setActiveKey(event.target.value)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              {roles.map((role) => (
                <option key={roleKey(role)} value={roleKey(role)}>
                  {roleLabel(role, organiserStaffData)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {activeRole?.role === "platform_admin" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Organisers</h2>
          <OrganiserList organisers={allOrganisers ?? []} />
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <h3 className="font-medium">Create Organiser</h3>
            <OrganiserForm />
          </div>
        </section>
      ) : null}

      {activeStaffEntry ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            Shows — {activeStaffEntry.organiser?.name ?? "Your organiser"}
          </h2>
          <ShowList shows={activeStaffEntry.shows} />
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <h3 className="font-medium">Create Show</h3>
            <ShowForm organiserId={activeStaffEntry.organiserId} />
          </div>
        </section>
      ) : null}

      {activeRole?.role === "vendor" ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">My Applications</h2>
            <Link href="/shows" className="text-sm text-zinc-500 underline dark:text-zinc-400">
              Browse Shows
            </Link>
          </div>
          <MyApplications applications={myApplications} />
        </section>
      ) : null}
    </div>
  );
}
