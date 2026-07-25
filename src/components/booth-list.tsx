"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateBooth, type BoothFormState } from "@/lib/actions/booths";

type BoothType = { id: string; name: string; category: string };
type Booth = {
  id: string;
  organiser_ref: string;
  status: string;
  map_x: number | string | null;
  map_y: number | string | null;
  booth_type_id: string;
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  held: "Held",
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  blocked: "Blocked",
};

const initialState: BoothFormState = { error: null };

function EditBoothForm({
  booth,
  boothTypes,
  showId,
  onDone,
}: {
  booth: Booth;
  boothTypes: BoothType[];
  showId: string;
  onDone: () => void;
}) {
  const updateForBooth = updateBooth.bind(null, booth.id, showId);
  const [state, formAction, pending] = useActionState(updateForBooth, initialState);
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
        <label htmlFor={`booth_type_id-${booth.id}`} className="text-sm font-medium">
          Booth type
        </label>
        <select
          id={`booth_type_id-${booth.id}`}
          name="booth_type_id"
          defaultValue={booth.booth_type_id}
          required
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          {boothTypes.map((boothType) => (
            <option key={boothType.id} value={boothType.id}>
              {boothType.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`organiser_ref-${booth.id}`} className="text-sm font-medium">
          Booth identifier
        </label>
        <input
          id={`organiser_ref-${booth.id}`}
          name="organiser_ref"
          type="text"
          required
          defaultValue={booth.organiser_ref}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`status-${booth.id}`} className="text-sm font-medium">
          Status
        </label>
        <select
          id={`status-${booth.id}`}
          name="status"
          defaultValue={booth.status}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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

function BoothCard({
  booth,
  boothType,
  boothTypes,
  showId,
}: {
  booth: Booth;
  boothType: BoothType | undefined;
  boothTypes: BoothType[];
  showId: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="col-span-full rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <EditBoothForm
          booth={booth}
          boothTypes={boothTypes}
          showId={showId}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex flex-col items-start gap-1 rounded-lg border border-zinc-300 p-3 text-left dark:border-zinc-700"
    >
      <span className="font-medium">{booth.organiser_ref}</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {boothType?.name ?? "Unknown type"}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {STATUS_LABELS[booth.status] ?? booth.status}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {booth.map_x === null ? "Not placed" : "Placed"}
      </span>
    </button>
  );
}

// Booths don't have a real parent/child island relationship yet (no
// BoothGroup -- see CLAUDE.md's "Deliberate simplifications"), so an
// "island" here just means every booth sharing an island-category booth
// type. Grouping by booth_type_id and collapsing those groups behind an
// expand toggle is what makes an island's individual booths read as
// "sub booths within it" despite there being no real grouping in the data.
export function BoothList({
  booths,
  boothTypes,
  showId,
}: {
  booths: Booth[];
  boothTypes: BoothType[];
  showId: string;
}) {
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

  if (booths.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No booths yet.</p>;
  }

  const boothTypeById = new Map(boothTypes.map((boothType) => [boothType.id, boothType]));

  const boothsByType = new Map<string, Booth[]>();
  for (const booth of booths) {
    const group = boothsByType.get(booth.booth_type_id);
    if (group) {
      group.push(booth);
    } else {
      boothsByType.set(booth.booth_type_id, [booth]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {[...boothsByType.entries()].map(([boothTypeId, typeBooths]) => {
        const boothType = boothTypeById.get(boothTypeId);

        if (boothType?.category !== "island") {
          return typeBooths.map((booth) => (
            <BoothCard
              key={booth.id}
              booth={booth}
              boothType={boothType}
              boothTypes={boothTypes}
              showId={showId}
            />
          ));
        }

        const isExpanded = expandedTypeId === boothTypeId;

        return (
          <div key={boothTypeId} className="col-span-full flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setExpandedTypeId(isExpanded ? null : boothTypeId)}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 p-3 text-left dark:border-zinc-700"
            >
              <span className="flex flex-col">
                <span className="font-medium">{boothType.name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {typeBooths.length} booth{typeBooths.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {isExpanded ? "Hide" : "Show"} booths
              </span>
            </button>

            {isExpanded ? (
              <div className="grid grid-cols-2 gap-2 border-l-2 border-zinc-200 pl-3 sm:grid-cols-3 md:grid-cols-4 dark:border-zinc-800">
                {typeBooths.map((booth) => (
                  <BoothCard
                    key={booth.id}
                    booth={booth}
                    boothType={boothType}
                    boothTypes={boothTypes}
                    showId={showId}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
