"use client";

import { useActionState } from "react";
import { createTerm, type TermFormState } from "@/lib/actions/terms";

const initialState: TermFormState = { error: null };

export function TermForm({ showId }: { showId: string }) {
  const createForShow = createTerm.bind(null, showId);
  const [state, formAction, pending] = useActionState(createForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="type" className="text-sm font-medium">
          Type
        </label>
        <input
          id="type"
          name="type"
          type="text"
          required
          placeholder="e.g. Vendor Terms, Attendee Terms"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="content" className="text-sm font-medium">
          Content
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={6}
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
        {pending ? "Creating…" : "Create Terms"}
      </button>
    </form>
  );
}
