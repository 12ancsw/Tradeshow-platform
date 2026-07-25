"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateBoothType, type BoothTypeFormState } from "@/lib/actions/booth-types";

type BoothType = {
  id: string;
  name: string;
  category: string;
  base_price: number | string;
};

const CATEGORY_LABELS: Record<string, string> = {
  island: "Island",
  standard: "Standard",
  corner: "Corner",
};

const initialState: BoothTypeFormState = { error: null };

function EditBoothTypeForm({
  boothType,
  showId,
  onDone,
}: {
  boothType: BoothType;
  showId: string;
  onDone: () => void;
}) {
  const updateForBoothType = updateBoothType.bind(null, boothType.id, showId);
  const [state, formAction, pending] = useActionState(updateForBoothType, initialState);
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
        <label htmlFor={`name-${boothType.id}`} className="text-sm font-medium">
          Name
        </label>
        <input
          id={`name-${boothType.id}`}
          name="name"
          type="text"
          required
          defaultValue={boothType.name}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`category-${boothType.id}`} className="text-sm font-medium">
          Type
        </label>
        <select
          id={`category-${boothType.id}`}
          name="category"
          defaultValue={boothType.category}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="standard">Standard</option>
          <option value="corner">Corner</option>
          <option value="island">Island</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`base_price-${boothType.id}`} className="text-sm font-medium">
          Cost ($)
        </label>
        <input
          id={`base_price-${boothType.id}`}
          name="base_price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={Number(boothType.base_price)}
          className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
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

export function BoothTypeList({
  boothTypes,
  showId,
}: {
  boothTypes: BoothType[];
  showId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (boothTypes.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No booth types yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {boothTypes.map((boothType) => (
        <li
          key={boothType.id}
          className="flex flex-col gap-2 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          {editingId === boothType.id ? (
            <EditBoothTypeForm
              boothType={boothType}
              showId={showId}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="font-medium">{boothType.name}</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {CATEGORY_LABELS[boothType.category] ?? boothType.category}
                </span>
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm">${Number(boothType.base_price).toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => setEditingId(boothType.id)}
                  className="text-sm text-zinc-500 underline dark:text-zinc-400"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
