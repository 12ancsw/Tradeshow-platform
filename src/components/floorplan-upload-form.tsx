"use client";

import { useActionState } from "react";
import { uploadFloorplan, type FloorplanFormState } from "@/lib/actions/floorplans";

const initialState: FloorplanFormState = { error: null };

export function FloorplanUploadForm({ showId }: { showId: string }) {
  const uploadForShow = uploadFloorplan.bind(null, showId);
  const [state, formAction, pending] = useActionState(uploadForShow, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="image"
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
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
