"use client";

import { useActionState } from "react";
import { uploadShowLogo, type ShowFormState } from "@/lib/actions/shows";

const initialState: ShowFormState = { error: null };

export function ShowLogoUploadForm({
  showId,
  logoUrl,
}: {
  showId: string;
  logoUrl: string | null;
}) {
  const uploadForShow = uploadShowLogo.bind(null, showId);
  const [state, formAction, pending] = useActionState(uploadForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-16 w-16 rounded object-cover" />
      ) : null}

      <input
        name="logo"
        type="file"
        accept="image/*"
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
        {pending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
      </button>
    </form>
  );
}
