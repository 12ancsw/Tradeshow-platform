"use client";

import { useActionState } from "react";
import { updateShow, type ShowFormState } from "@/lib/actions/shows";

const initialState: ShowFormState = { error: null };

type Show = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue_name: string;
  payment_instructions: string | null;
};

export function ShowEditForm({ show }: { show: Show }) {
  const updateForShow = updateShow.bind(null, show.id);
  const [state, formAction, pending] = useActionState(updateForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Show name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={show.name}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="start_date" className="text-sm font-medium">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={show.start_date}
            className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="end_date" className="text-sm font-medium">
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            defaultValue={show.end_date}
            className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="venue_name" className="text-sm font-medium">
          Venue
        </label>
        <input
          id="venue_name"
          name="venue_name"
          type="text"
          required
          defaultValue={show.venue_name}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="payment_instructions" className="text-sm font-medium">
          Payment instructions
        </label>
        <textarea
          id="payment_instructions"
          name="payment_instructions"
          rows={3}
          defaultValue={show.payment_instructions ?? ""}
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
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
