"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  updateSubvendor,
  deleteSubvendor,
  type SubvendorFormState,
} from "@/lib/actions/subvendors";

type Booth = { id: string; organiser_ref: string };
type Subvendor = {
  id: string;
  booth_id: string | null;
  business_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  passes_note: string | null;
  logo_url: string | null;
};

const initialState: SubvendorFormState = { error: null };

function EditSubvendorForm({
  subvendor,
  showId,
  availableBooths,
  onDone,
}: {
  subvendor: Subvendor;
  showId: string;
  availableBooths: Booth[];
  onDone: () => void;
}) {
  const updateForSubvendor = updateSubvendor.bind(null, subvendor.id, showId);
  const [state, formAction, pending] = useActionState(updateForSubvendor, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`business_name-${subvendor.id}`} className="text-sm font-medium">
          Business name
        </label>
        <input
          id={`business_name-${subvendor.id}`}
          name="business_name"
          type="text"
          required
          defaultValue={subvendor.business_name}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`booth_id-${subvendor.id}`} className="text-sm font-medium">
          Booth
        </label>
        <select
          id={`booth_id-${subvendor.id}`}
          name="booth_id"
          defaultValue={subvendor.booth_id ?? ""}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Not assigned to a specific booth</option>
          {availableBooths.map((booth) => (
            <option key={booth.id} value={booth.id}>
              {booth.organiser_ref}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`contact_email-${subvendor.id}`} className="text-sm font-medium">
          Contact email
        </label>
        <input
          id={`contact_email-${subvendor.id}`}
          name="contact_email"
          type="email"
          defaultValue={subvendor.contact_email ?? ""}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`contact_phone-${subvendor.id}`} className="text-sm font-medium">
          Contact phone
        </label>
        <input
          id={`contact_phone-${subvendor.id}`}
          name="contact_phone"
          type="text"
          defaultValue={subvendor.contact_phone ?? ""}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`passes_note-${subvendor.id}`} className="text-sm font-medium">
          Vendor passes
        </label>
        <input
          id={`passes_note-${subvendor.id}`}
          name="passes_note"
          type="text"
          defaultValue={subvendor.passes_note ?? ""}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`notes-${subvendor.id}`} className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id={`notes-${subvendor.id}`}
          name="notes"
          rows={2}
          defaultValue={subvendor.notes ?? ""}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`logo-${subvendor.id}`} className="text-sm font-medium">
          Logo{subvendor.logo_url ? " (choose a file to replace)" : ""}
        </label>
        <input
          id={`logo-${subvendor.id}`}
          name="logo"
          type="file"
          accept="image/*"
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-white dark:file:text-black"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base font-medium dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteSubvendorConfirm({
  subvendor,
  showId,
  onCancel,
}: {
  subvendor: Subvendor;
  showId: string;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteSubvendor(subvendor.id, showId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Delete <span className="font-medium">{subvendor.business_name}</span>? This can&apos;t be
        undone.
      </p>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmDelete}
          disabled={isPending}
          className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base font-medium dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SubvendorList({
  subvendors,
  boothById,
  showId,
  availableBooths,
}: {
  subvendors: Subvendor[];
  boothById: Map<string, Booth>;
  showId: string;
  availableBooths: Booth[];
}) {
  const [mode, setMode] = useState<{ id: string; type: "edit" | "delete" } | null>(null);

  if (subvendors.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No subvendors recorded yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {subvendors.map((subvendor) => {
        // A subvendor being edited needs its own current booth back in the
        // option list -- it's "available" to itself even though it's the
        // one occupying it (booths without a subvendor are the only ones
        // otherwise offered).
        const currentBooth = subvendor.booth_id ? boothById.get(subvendor.booth_id) : undefined;
        const boothsForEdit =
          currentBooth && !availableBooths.some((booth) => booth.id === currentBooth.id)
            ? [...availableBooths, currentBooth]
            : availableBooths;

        return (
          <li
            key={subvendor.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
          >
            {mode?.id === subvendor.id && mode.type === "edit" ? (
              <EditSubvendorForm
                subvendor={subvendor}
                showId={showId}
                availableBooths={boothsForEdit}
                onDone={() => setMode(null)}
              />
            ) : mode?.id === subvendor.id && mode.type === "delete" ? (
              <DeleteSubvendorConfirm
                subvendor={subvendor}
                showId={showId}
                onCancel={() => setMode(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {subvendor.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={subvendor.logo_url}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : null}
                  <span className="flex flex-col">
                    <span className="font-medium">{subvendor.business_name}</span>
                    {currentBooth ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Booth {currentBooth.organiser_ref}
                      </span>
                    ) : null}
                    {subvendor.contact_email ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {subvendor.contact_email}
                      </span>
                    ) : null}
                    {subvendor.contact_phone ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {subvendor.contact_phone}
                      </span>
                    ) : null}
                    {subvendor.passes_note ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Passes: {subvendor.passes_note}
                      </span>
                    ) : null}
                    {subvendor.notes ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {subvendor.notes}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode({ id: subvendor.id, type: "edit" })}
                    className="text-sm text-zinc-500 underline dark:text-zinc-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode({ id: subvendor.id, type: "delete" })}
                    className="text-sm text-red-600 underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
