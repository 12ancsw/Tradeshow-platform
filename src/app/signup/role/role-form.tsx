"use client";

import { useActionState } from "react";
import { chooseRole, type RoleFormState } from "./actions";

const initialState: RoleFormState = { error: null };

export function RoleForm() {
  const chooseVendor = chooseRole.bind(null, "vendor");
  const chooseAttendee = chooseRole.bind(null, "attendee");

  const [vendorState, vendorAction, vendorPending] = useActionState(chooseVendor, initialState);
  const [attendeeState, attendeeAction, attendeePending] = useActionState(
    chooseAttendee,
    initialState,
  );

  const pending = vendorPending || attendeePending;
  const error = vendorState.error ?? attendeeState.error;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={vendorAction}>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-zinc-300 px-4 py-4 text-base font-medium disabled:opacity-60 dark:border-zinc-700"
        >
          I&apos;m a vendor
        </button>
      </form>

      <form action={attendeeAction}>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-zinc-300 px-4 py-4 text-base font-medium disabled:opacity-60 dark:border-zinc-700"
        >
          I&apos;m attending as a guest
        </button>
      </form>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
