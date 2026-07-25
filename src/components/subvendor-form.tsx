"use client";

import { useActionState } from "react";
import { createSubvendor, type SubvendorFormState } from "@/lib/actions/subvendors";

const initialState: SubvendorFormState = { error: null };

type Booth = { id: string; organiser_ref: string };

export function SubvendorForm({
  boothGroupId,
  showId,
  availableBooths,
}: {
  boothGroupId: string;
  showId: string;
  availableBooths: Booth[];
}) {
  const createForGroup = createSubvendor.bind(null, boothGroupId, showId);
  const [state, formAction, pending] = useActionState(createForGroup, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="business_name" className="text-sm font-medium">
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="booth_id" className="text-sm font-medium">
          Booth
        </label>
        <select
          id="booth_id"
          name="booth_id"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Not assigned to a specific booth</option>
          {availableBooths.map((booth) => (
            <option key={booth.id} value={booth.id}>
              {booth.organiser_ref}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="contact_email" className="text-sm font-medium">
          Contact email
        </label>
        <input
          id="contact_email"
          name="contact_email"
          type="email"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="contact_phone" className="text-sm font-medium">
          Contact phone
        </label>
        <input
          id="contact_phone"
          name="contact_phone"
          type="text"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="passes_note" className="text-sm font-medium">
          Vendor passes
        </label>
        <input
          id="passes_note"
          name="passes_note"
          type="text"
          placeholder="e.g. 2x vendor passes"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="logo" className="text-sm font-medium">
          Logo
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/*"
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-white dark:file:text-black"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {pending ? "Adding…" : "Add Subvendor"}
      </button>
    </form>
  );
}
