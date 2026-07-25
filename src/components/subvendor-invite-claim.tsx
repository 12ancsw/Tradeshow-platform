"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { claimSubvendor, updateOwnSubvendor } from "@/lib/actions/subvendor-claims";
import type { SubvendorFormState } from "@/lib/actions/subvendors";

type Preview = {
  id: string;
  business_name: string;
  claimed: boolean;
  island_ref: string | null;
  booth_ref: string | null;
};

type OwnRow = {
  id: string;
  business_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  logo_url: string | null;
};

const initialState: SubvendorFormState = { error: null };

function inviteLabel(preview: Preview) {
  if (preview.island_ref && preview.booth_ref) {
    return `${preview.island_ref}, booth ${preview.booth_ref}`;
  }
  if (preview.island_ref) {
    return preview.island_ref;
  }
  return "this island";
}

function ClaimButton({ subvendorId }: { subvendorId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function claim() {
    startTransition(async () => {
      const result = await claimSubvendor(subvendorId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={claim}
        disabled={isPending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isPending ? "Claiming…" : "Claim this listing"}
      </button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function EditForm({ subvendorId, ownRow }: { subvendorId: string; ownRow: OwnRow }) {
  const updateForSubvendor = updateOwnSubvendor.bind(null, subvendorId);
  const [state, formAction, pending] = useActionState(updateForSubvendor, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {ownRow.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ownRow.logo_url} alt="" className="h-16 w-16 rounded object-cover" />
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="business_name" className="text-sm font-medium">
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          defaultValue={ownRow.business_name}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="contact_email" className="text-sm font-medium">
          Contact email
        </label>
        <input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={ownRow.contact_email ?? ""}
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
          defaultValue={ownRow.contact_phone ?? ""}
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
          defaultValue={ownRow.notes ?? ""}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="logo" className="text-sm font-medium">
          {`Logo${ownRow.logo_url ? " (choose a file to replace)" : ""}`}
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
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function SubvendorInviteClaim({
  subvendorId,
  preview,
  isLoggedIn,
  ownRow,
}: {
  subvendorId: string;
  preview: Preview;
  isLoggedIn: boolean;
  ownRow: OwnRow | null;
}) {
  if (ownRow) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">Your listing</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{inviteLabel(preview)}</p>
        <EditForm subvendorId={subvendorId} ownRow={ownRow} />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">You&apos;re invited</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {`${preview.business_name || "You've"} been invited to provide your business details for ${inviteLabel(preview)}. Sign up or log in, then come back to this link to claim your listing.`}
        </p>
        <div className="flex gap-2">
          <Link
            href="/signup"
            className="flex-1 rounded-lg bg-black px-4 py-3 text-center text-base font-medium text-white dark:bg-white dark:text-black"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-center text-base font-medium dark:border-zinc-700"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  if (preview.claimed) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">Already claimed</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {`This invite for ${inviteLabel(preview)} has already been claimed by a different account. If that's a mistake, ask the organiser for a new invite.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">You&apos;re invited</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {`Claim your listing for ${inviteLabel(preview)} to provide your own business details, logo, and contact info.`}
      </p>
      <ClaimButton subvendorId={subvendorId} />
    </div>
  );
}
