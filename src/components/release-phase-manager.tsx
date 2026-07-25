"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  updateReleasePhase,
  updateReleasePhaseStatus,
  deleteReleasePhase,
  attachBoothTypeToPhase,
  detachBoothTypeFromPhase,
  attachIslandTypeToPhase,
  detachIslandTypeFromPhase,
  type ReleasePhaseFormState,
} from "@/lib/actions/release-phases";

type Phase = {
  id: string;
  name: string;
  status: "draft" | "open" | "closed";
  selection_fee_amount: number | string;
};
type BoothType = { id: string; name: string };
type IslandType = { id: string; name: string };
type PhaseBoothType = { id: string; release_phase_id: string; booth_type_id: string };
type PhaseIslandType = { id: string; release_phase_id: string; island_type_id: string };

const STATUS_LABELS: Record<Phase["status"], string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

const initialState: ReleasePhaseFormState = { error: null };

function EditPhaseForm({
  phase,
  showId,
  onDone,
}: {
  phase: Phase;
  showId: string;
  onDone: () => void;
}) {
  const updateForPhase = updateReleasePhase.bind(null, phase.id, showId);
  const [state, formAction, pending] = useActionState(updateForPhase, initialState);
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
        <label htmlFor={`name-${phase.id}`} className="text-sm font-medium">
          Phase name
        </label>
        <input
          id={`name-${phase.id}`}
          name="name"
          type="text"
          required
          defaultValue={phase.name}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`selection_fee_amount-${phase.id}`} className="text-sm font-medium">
          Selection fee ($)
        </label>
        <input
          id={`selection_fee_amount-${phase.id}`}
          name="selection_fee_amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={Number(phase.selection_fee_amount)}
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

function DeletePhaseConfirm({
  phase,
  showId,
  onCancel,
}: {
  phase: Phase;
  showId: string;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteReleasePhase(phase.id, showId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {`Delete ${phase.name}? This can't be undone.`}
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

function StatusButtons({ phase, showId }: { phase: Phase; showId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setStatus(status: Phase["status"]) {
    startTransition(async () => {
      const result = await updateReleasePhaseStatus(phase.id, showId, status);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {(["draft", "open", "closed"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatus(status)}
            disabled={isPending || phase.status === status}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-100 ${
              phase.status === status
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function TypeAttachments({
  label,
  allTypes,
  attachedLinks,
  onAttach,
  onDetach,
}: {
  label: string;
  allTypes: BoothType[] | IslandType[];
  attachedLinks: { id: string; typeId: string }[];
  onAttach: (typeId: string) => Promise<{ error: string | null }>;
  onDetach: (linkId: string) => Promise<{ error: string | null }>;
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const attachedTypeIds = new Set(attachedLinks.map((link) => link.typeId));
  const typeById = new Map(allTypes.map((type) => [type.id, type]));
  const unattachedTypes = allTypes.filter((type) => !attachedTypeIds.has(type.id));

  function attach() {
    if (!selected) return;
    startTransition(async () => {
      const result = await onAttach(selected);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelected("");
      setError(null);
    });
  }

  function detach(linkId: string) {
    startTransition(async () => {
      const result = await onDetach(linkId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <h5 className="text-sm font-semibold">{label}</h5>
      {attachedLinks.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">None released yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {attachedLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            >
              <span className="text-sm font-medium">
                {typeById.get(link.typeId)?.name ?? "Unknown"}
              </span>
              <button
                type="button"
                onClick={() => detach(link.id)}
                disabled={isPending}
                className="text-sm text-red-600 underline disabled:opacity-60 dark:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {unattachedTypes.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Choose…</option>
            {unattachedTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={attach}
            disabled={!selected || isPending}
            className="rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            Add
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

export function ReleasePhaseManager({
  showId,
  phases,
  boothTypes,
  islandTypes,
  phaseBoothTypes,
  phaseIslandTypes,
}: {
  showId: string;
  phases: Phase[];
  boothTypes: BoothType[];
  islandTypes: IslandType[];
  phaseBoothTypes: PhaseBoothType[];
  phaseIslandTypes: PhaseIslandType[];
}) {
  const [mode, setMode] = useState<{ id: string; type: "edit" | "delete" } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (phases.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No release phases yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {phases.map((phase) => {
        const isExpanded = expandedId === phase.id;
        const boothLinks = phaseBoothTypes
          .filter((link) => link.release_phase_id === phase.id)
          .map((link) => ({ id: link.id, typeId: link.booth_type_id }));
        const islandLinks = phaseIslandTypes
          .filter((link) => link.release_phase_id === phase.id)
          .map((link) => ({ id: link.id, typeId: link.island_type_id }));

        return (
          <div
            key={phase.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
          >
            {mode?.id === phase.id && mode.type === "edit" ? (
              <EditPhaseForm phase={phase} showId={showId} onDone={() => setMode(null)} />
            ) : mode?.id === phase.id && mode.type === "delete" ? (
              <DeletePhaseConfirm phase={phase} showId={showId} onCancel={() => setMode(null)} />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-medium">{phase.name}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {`${STATUS_LABELS[phase.status]} · $${Number(phase.selection_fee_amount).toFixed(2)} selection fee`}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode({ id: phase.id, type: "edit" })}
                    className="text-sm text-zinc-500 underline dark:text-zinc-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode({ id: phase.id, type: "delete" })}
                    className="text-sm text-red-600 underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <StatusButtons phase={phase} showId={showId} />

            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : phase.id)}
              className="text-left text-sm text-zinc-500 underline dark:text-zinc-400"
            >
              {`${isExpanded ? "Hide" : "Manage"} released types`}
            </button>

            {isExpanded ? (
              <div className="flex flex-col gap-4 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
                <TypeAttachments
                  label="Booth types"
                  allTypes={boothTypes}
                  attachedLinks={boothLinks}
                  onAttach={(typeId) => attachBoothTypeToPhase(phase.id, typeId, showId)}
                  onDetach={(linkId) => detachBoothTypeFromPhase(linkId, showId)}
                />
                <TypeAttachments
                  label="Island types"
                  allTypes={islandTypes}
                  attachedLinks={islandLinks}
                  onAttach={(typeId) => attachIslandTypeToPhase(phase.id, typeId, showId)}
                  onDetach={(linkId) => detachIslandTypeFromPhase(linkId, showId)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
