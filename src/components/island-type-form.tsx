"use client";

import { useActionState } from "react";
import { createIslandType, type IslandTypeFormState } from "@/lib/actions/island-types";

const initialState: IslandTypeFormState = { error: null };

export function IslandTypeForm({ showId }: { showId: string }) {
  const createIslandTypeForShow = createIslandType.bind(null, showId);
  const [state, formAction, pending] = useActionState(createIslandTypeForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Premium Island"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="base_price" className="text-sm font-medium">
          Cost ($)
        </label>
        <input
          id="base_price"
          name="base_price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue="0"
          className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
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
        {pending ? "Creating…" : "Create Island Type"}
      </button>
    </form>
  );
}
