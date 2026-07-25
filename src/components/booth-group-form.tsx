"use client";

import { useActionState } from "react";
import { createBoothGroup, type BoothGroupFormState } from "@/lib/actions/booth-groups";

const initialState: BoothGroupFormState = { error: null };

type IslandType = { id: string; name: string; base_price: number | string };

export function BoothGroupForm({
  showId,
  islandTypes,
}: {
  showId: string;
  islandTypes: IslandType[];
}) {
  const createForShow = createBoothGroup.bind(null, showId);
  const [state, formAction, pending] = useActionState(createForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="organiser_ref" className="text-sm font-medium">
          Island identifier
        </label>
        <input
          id="organiser_ref"
          name="organiser_ref"
          type="text"
          required
          placeholder="e.g. Island A"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="island_type_id" className="text-sm font-medium">
          Island type
        </label>
        <select
          id="island_type_id"
          name="island_type_id"
          required
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Choose a type…</option>
          {islandTypes.map((islandType) => (
            <option key={islandType.id} value={islandType.id}>
              {islandType.name} (${Number(islandType.base_price).toFixed(2)})
            </option>
          ))}
        </select>
      </div>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {pending ? "Creating…" : "Create Island"}
      </button>
    </form>
  );
}
