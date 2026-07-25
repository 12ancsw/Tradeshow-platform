"use client";

import { useActionState } from "react";
import { createBooth, type BoothFormState } from "@/lib/actions/booths";

const initialState: BoothFormState = { error: null };

type BoothType = { id: string; name: string };

export function BoothForm({ showId, boothTypes }: { showId: string; boothTypes: BoothType[] }) {
  const createBoothForShow = createBooth.bind(null, showId);
  const [state, formAction, pending] = useActionState(createBoothForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="booth_type_id" className="text-sm font-medium">
          Booth type
        </label>
        <select
          id="booth_type_id"
          name="booth_type_id"
          required
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          {boothTypes.map((boothType) => (
            <option key={boothType.id} value={boothType.id}>
              {boothType.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="organiser_ref" className="text-sm font-medium">
          Booth identifier
        </label>
        <input
          id="organiser_ref"
          name="organiser_ref"
          type="text"
          required
          placeholder="e.g. A1"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
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
        {pending ? "Adding…" : "Add Booth"}
      </button>
    </form>
  );
}
