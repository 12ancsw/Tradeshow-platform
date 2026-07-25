"use client";

import { useActionState } from "react";
import { assignOrganiserStaff, type AssignStaffFormState } from "@/lib/actions/organisers";

const initialState: AssignStaffFormState = { error: null, message: null };

export function AssignStaffForm({ organiserId }: { organiserId: string }) {
  const assignForOrganiser = assignOrganiserStaff.bind(null, organiserId);
  const [state, formAction, pending] = useActionState(assignForOrganiser, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="organiser@example.com"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-green-700 dark:text-green-400">{state.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {pending ? "Assigning…" : "Assign Organiser Staff"}
      </button>
    </form>
  );
}
