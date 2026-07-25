"use client";

import { useActionState } from "react";
import { submitPaymentProof, type PaymentProofFormState } from "@/lib/actions/payments";

const initialState: PaymentProofFormState = { error: null };

export function PaymentProofForm({
  applicationId,
  showId,
  alreadySubmitted,
}: {
  applicationId: string;
  showId: string;
  alreadySubmitted: boolean;
}) {
  const submitForApplication = submitPaymentProof.bind(null, applicationId, showId);
  const [state, formAction, pending] = useActionState(submitForApplication, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input
        name="proof"
        type="file"
        accept="image/*,application/pdf"
        required
        className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-white dark:file:text-black"
      />

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {pending ? "Uploading…" : alreadySubmitted ? "Replace proof" : "Upload payment proof"}
      </button>
    </form>
  );
}
