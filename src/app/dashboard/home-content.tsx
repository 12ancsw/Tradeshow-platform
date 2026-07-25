"use client";

import { useState } from "react";
import type { AppRole, UserRoleRow } from "@/lib/auth";

const ROLE_LABELS: Record<AppRole, string> = {
  platform_admin: "Platform Admin",
  organiser_staff: "Organiser Staff",
  vendor: "Vendor",
  attendee: "Attendee",
};

function roleKey(role: UserRoleRow) {
  return `${role.role}:${role.organiser_id ?? ""}`;
}

function roleLabel(role: UserRoleRow) {
  if (role.role === "organiser_staff" && role.organiser_id) {
    return `${ROLE_LABELS[role.role]} (${role.organiser_id.slice(0, 8)})`;
  }
  return ROLE_LABELS[role.role];
}

export function HomeContent({ name, roles }: { name: string; roles: UserRoleRow[] }) {
  const [activeKey, setActiveKey] = useState(roleKey(roles[0]));
  const activeRole = roles.find((role) => roleKey(role) === activeKey) ?? roles[0];

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-lg font-medium">
        Logged in as {name}, role: {roleLabel(activeRole)}
      </p>

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
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
