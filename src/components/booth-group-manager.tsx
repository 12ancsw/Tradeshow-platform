"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  updateBoothGroup,
  deleteBoothGroup,
  setBoothGroup,
  type BoothGroupFormState,
} from "@/lib/actions/booth-groups";
import { SubvendorForm } from "@/components/subvendor-form";
import { SubvendorList } from "@/components/subvendor-list";

type BoothGroup = { id: string; organiser_ref: string };
type Booth = { id: string; organiser_ref: string; booth_group_id: string | null };
type Subvendor = {
  id: string;
  booth_group_id: string;
  booth_id: string | null;
  business_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  passes_note: string | null;
  logo_url: string | null;
  user_id: string | null;
};

const initialState: BoothGroupFormState = { error: null };

function EditBoothGroupForm({
  boothGroup,
  showId,
  onDone,
}: {
  boothGroup: BoothGroup;
  showId: string;
  onDone: () => void;
}) {
  const updateForGroup = updateBoothGroup.bind(null, boothGroup.id, showId);
  const [state, formAction, pending] = useActionState(updateForGroup, initialState);
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
        <label htmlFor={`organiser_ref-${boothGroup.id}`} className="text-sm font-medium">
          Island identifier
        </label>
        <input
          id={`organiser_ref-${boothGroup.id}`}
          name="organiser_ref"
          type="text"
          required
          defaultValue={boothGroup.organiser_ref}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
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

function DeleteBoothGroupConfirm({
  boothGroup,
  showId,
  subvendorCount,
  onCancel,
}: {
  boothGroup: BoothGroup;
  showId: string;
  subvendorCount: number;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteBoothGroup(boothGroup.id, showId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Delete <span className="font-medium">{boothGroup.organiser_ref}</span>?
        {subvendorCount > 0
          ? ` This also removes ${subvendorCount} subvendor${subvendorCount === 1 ? "" : "s"} recorded against it.`
          : ""}{" "}
        Booths assigned to it are unassigned, not deleted.
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

function AssignBoothControl({
  boothGroupId,
  showId,
  unassignedBooths,
}: {
  boothGroupId: string;
  showId: string;
  unassignedBooths: Booth[];
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (unassignedBooths.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No unassigned island booths left to add.
      </p>
    );
  }

  function addBooth() {
    if (!selected) return;
    startTransition(async () => {
      const result = await setBoothGroup(selected, boothGroupId, showId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelected("");
      setError(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Choose a booth…</option>
          {unassignedBooths.map((booth) => (
            <option key={booth.id} value={booth.id}>
              {booth.organiser_ref}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addBooth}
          disabled={!selected || isPending}
          className="rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          Add
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function AssignedBoothRow({ booth, showId }: { booth: Booth; showId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await setBoothGroup(booth.id, null, showId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
        <span className="text-sm font-medium">{booth.organiser_ref}</span>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="text-sm text-red-600 underline disabled:opacity-60 dark:text-red-400"
        >
          {isPending ? "Removing…" : "Remove"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

export function BoothGroupManager({
  showId,
  boothGroups,
  islandBooths,
  subvendors,
}: {
  showId: string;
  boothGroups: BoothGroup[];
  islandBooths: Booth[];
  subvendors: Subvendor[];
}) {
  const [mode, setMode] = useState<{ id: string; type: "edit" | "delete" } | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const boothById = new Map(
    islandBooths.map((booth) => [booth.id, { id: booth.id, organiser_ref: booth.organiser_ref }]),
  );
  const unassignedBooths = islandBooths.filter((booth) => booth.booth_group_id === null);

  if (boothGroups.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No islands yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {boothGroups.map((boothGroup) => {
        const assignedBooths = islandBooths.filter(
          (booth) => booth.booth_group_id === boothGroup.id,
        );
        const groupSubvendors = subvendors.filter((s) => s.booth_group_id === boothGroup.id);
        const boothsWithoutSubvendor = assignedBooths
          .filter((booth) => !groupSubvendors.some((s) => s.booth_id === booth.id))
          .map((booth) => ({ id: booth.id, organiser_ref: booth.organiser_ref }));
        const isExpanded = expandedGroupId === boothGroup.id;

        return (
          <div
            key={boothGroup.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
          >
            {mode?.id === boothGroup.id && mode.type === "edit" ? (
              <EditBoothGroupForm
                boothGroup={boothGroup}
                showId={showId}
                onDone={() => setMode(null)}
              />
            ) : mode?.id === boothGroup.id && mode.type === "delete" ? (
              <DeleteBoothGroupConfirm
                boothGroup={boothGroup}
                showId={showId}
                subvendorCount={groupSubvendors.length}
                onCancel={() => setMode(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-medium">{boothGroup.organiser_ref}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {assignedBooths.length} booth{assignedBooths.length === 1 ? "" : "s"} ·{" "}
                    {groupSubvendors.length} subvendor{groupSubvendors.length === 1 ? "" : "s"}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode({ id: boothGroup.id, type: "edit" })}
                    className="text-sm text-zinc-500 underline dark:text-zinc-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode({ id: boothGroup.id, type: "delete" })}
                    className="text-sm text-red-600 underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setExpandedGroupId(isExpanded ? null : boothGroup.id)}
              className="text-left text-sm text-zinc-500 underline dark:text-zinc-400"
            >
              {`${isExpanded ? "Hide" : "Manage"} booths & subvendors`}
            </button>

            {isExpanded ? (
              <div className="flex flex-col gap-4 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold">Booths in this island</h4>
                  {assignedBooths.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No booths assigned yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {assignedBooths.map((booth) => (
                        <AssignedBoothRow key={booth.id} booth={booth} showId={showId} />
                      ))}
                    </div>
                  )}
                  <AssignBoothControl
                    boothGroupId={boothGroup.id}
                    showId={showId}
                    unassignedBooths={unassignedBooths}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold">Subvendors</h4>
                  <SubvendorList
                    subvendors={groupSubvendors}
                    boothById={boothById}
                    showId={showId}
                    availableBooths={boothsWithoutSubvendor}
                  />
                  <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
                    <h5 className="font-medium">Add Subvendor</h5>
                    <SubvendorForm
                      boothGroupId={boothGroup.id}
                      showId={showId}
                      availableBooths={boothsWithoutSubvendor}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
