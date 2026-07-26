"use client";

import { useActionState } from "react";
import { createReleasePhase, type ReleasePhaseFormState } from "@/lib/actions/release-phases";

const initialState: ReleasePhaseFormState = { error: null };

export function ReleasePhaseForm({ showId }: { showId: string }) {
  const createForShow = createReleasePhase.bind(null, showId);
  const [state, formAction, pending] = useActionState(createForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Phase name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Phase 1 — Early Bird"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="allocation_mode" className="text-sm font-medium">
          How booths are assigned
        </label>
        <select
          id="allocation_mode"
          name="allocation_mode"
          defaultValue="organiser_allocated"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="organiser_allocated">You assign booths after reviewing applications</option>
          <option value="immediate_selection">Applicants pick their own booth locations</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="selection_fee_amount" className="text-sm font-medium">
          Selection fee ($)
        </label>
        <input
          id="selection_fee_amount"
          name="selection_fee_amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue="0"
          className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Only charged (per booth) when this phase lets applicants pick their own booth locations.
          Never charged for islands.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {pending ? "Creating…" : "Create Phase"}
      </button>
    </form>
  );
}
