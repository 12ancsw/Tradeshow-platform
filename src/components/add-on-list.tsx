"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { updateAddOn, deleteAddOn, type AddOnFormState } from "@/lib/actions/add-ons";

type AddOn = {
  id: string;
  name: string;
  price: number | string;
  mandatory: boolean;
};

const initialState: AddOnFormState = { error: null };

function EditAddOnForm({
  addOn,
  showId,
  onDone,
}: {
  addOn: AddOn;
  showId: string;
  onDone: () => void;
}) {
  const updateForAddOn = updateAddOn.bind(null, addOn.id, showId);
  const [state, formAction, pending] = useActionState(updateForAddOn, initialState);
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
        <label htmlFor={`name-${addOn.id}`} className="text-sm font-medium">
          Name
        </label>
        <input
          id={`name-${addOn.id}`}
          name="name"
          type="text"
          required
          defaultValue={addOn.name}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`price-${addOn.id}`} className="text-sm font-medium">
          Price ($)
        </label>
        <input
          id={`price-${addOn.id}`}
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={Number(addOn.price)}
          className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          name="mandatory"
          type="checkbox"
          defaultChecked={addOn.mandatory}
          className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
        />
        Mandatory on every application
      </label>

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

function DeleteAddOnConfirm({
  addOn,
  showId,
  onCancel,
}: {
  addOn: AddOn;
  showId: string;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteAddOn(addOn.id, showId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Delete <span className="font-medium">{addOn.name}</span>? This can&apos;t be undone.
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

export function AddOnList({ addOns, showId }: { addOns: AddOn[]; showId: string }) {
  const [mode, setMode] = useState<{ id: string; type: "edit" | "delete" } | null>(null);

  if (addOns.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No add-ons yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {addOns.map((addOn) => (
        <li
          key={addOn.id}
          className="flex flex-col gap-2 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          {mode?.id === addOn.id && mode.type === "edit" ? (
            <EditAddOnForm addOn={addOn} showId={showId} onDone={() => setMode(null)} />
          ) : mode?.id === addOn.id && mode.type === "delete" ? (
            <DeleteAddOnConfirm addOn={addOn} showId={showId} onCancel={() => setMode(null)} />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="font-medium">{addOn.name}</span>
                {addOn.mandatory ? (
                  <span className="text-sm text-amber-700 dark:text-amber-400">Mandatory</span>
                ) : (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Optional</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm">${Number(addOn.price).toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => setMode({ id: addOn.id, type: "edit" })}
                  className="text-sm text-zinc-500 underline dark:text-zinc-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setMode({ id: addOn.id, type: "delete" })}
                  className="text-sm text-red-600 underline dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
