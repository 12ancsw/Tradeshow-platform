"use client";

import { useActionState } from "react";
import { createAddOn, type AddOnFormState } from "@/lib/actions/add-ons";

const initialState: AddOnFormState = { error: null };

export function AddOnForm({ showId }: { showId: string }) {
  const createAddOnForShow = createAddOn.bind(null, showId);
  const [state, formAction, pending] = useActionState(createAddOnForShow, initialState);

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
          placeholder="e.g. Electricity"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="price" className="text-sm font-medium">
          Price ($)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue="0"
          className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          name="mandatory"
          type="checkbox"
          className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
        />
        Mandatory on every application
      </label>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {pending ? "Creating…" : "Create Add-on"}
      </button>
    </form>
  );
}
