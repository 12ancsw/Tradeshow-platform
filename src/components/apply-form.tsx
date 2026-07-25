"use client";

import { useActionState, useState } from "react";
import { applyAssigned, applySelfSelected, type ApplyFormState } from "@/lib/actions/applications";

type OpenPhase = {
  id: string;
  name: string;
  selection_fee_amount: number;
  boothTypeIds: string[];
  islandTypeIds: string[];
};
type BoothTypeOption = { id: string; name: string; base_price: number; available: number };
type IslandTypeOption = { id: string; name: string; base_price: number; available: number };
type AvailableBooth = { id: string; organiser_ref: string; booth_type_id: string };
type AvailableIsland = { id: string; organiser_ref: string; island_type_id: string };

const initialState: ApplyFormState = { error: null };
const MAX_BOOTHS = 6;

export function ApplyForm({
  showId,
  openPhases,
  boothTypeOptions,
  islandTypeOptions,
  availableBooths,
  availableIslands,
}: {
  showId: string;
  openPhases: OpenPhase[];
  boothTypeOptions: BoothTypeOption[];
  islandTypeOptions: IslandTypeOption[];
  availableBooths: AvailableBooth[];
  availableIslands: AvailableIsland[];
}) {
  const [phaseId, setPhaseId] = useState(openPhases[0]?.id ?? "");
  const [applicationType, setApplicationType] = useState<"booths" | "island">("booths");
  const [mode, setMode] = useState<"assign" | "self">("assign");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedIslandTypeId, setSelectedIslandTypeId] = useState("");
  const [selectedBoothIds, setSelectedBoothIds] = useState<string[]>([]);
  const [selectedIslandId, setSelectedIslandId] = useState("");

  const applyAssignedForShow = applyAssigned.bind(null, showId);
  const applySelfSelectedForShow = applySelfSelected.bind(null, showId);
  const [assignState, assignAction, assignPending] = useActionState(
    applyAssignedForShow,
    initialState,
  );
  const [selfState, selfAction, selfPending] = useActionState(
    applySelfSelectedForShow,
    initialState,
  );

  if (openPhases.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Not currently accepting applications.
      </p>
    );
  }

  const phase = openPhases.find((candidate) => candidate.id === phaseId) ?? openPhases[0];
  const phaseBoothTypes = boothTypeOptions.filter((type) => phase.boothTypeIds.includes(type.id));
  const phaseIslandTypes = islandTypeOptions.filter((type) =>
    phase.islandTypeIds.includes(type.id),
  );
  const phaseAvailableBooths = availableBooths.filter((booth) =>
    phase.boothTypeIds.includes(booth.booth_type_id),
  );
  const phaseAvailableIslands = availableIslands.filter((island) =>
    phase.islandTypeIds.includes(island.island_type_id),
  );

  const totalRequestedBooths = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  function setQuantity(boothTypeId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [boothTypeId]: Math.max(0, qty) }));
  }

  function toggleBooth(boothId: string) {
    setSelectedBoothIds((prev) =>
      prev.includes(boothId)
        ? prev.filter((id) => id !== boothId)
        : prev.length >= MAX_BOOTHS
          ? prev
          : [...prev, boothId],
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h3 className="font-medium">Apply</h3>

      {openPhases.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="phase" className="text-sm font-medium">
            Phase
          </label>
          <select
            id="phase"
            value={phaseId}
            onChange={(event) => setPhaseId(event.target.value)}
            className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            {openPhases.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">What are you applying for?</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setApplicationType("booths")}
            disabled={phaseBoothTypes.length === 0}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40 ${
              applicationType === "booths"
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            Booths
          </button>
          <button
            type="button"
            onClick={() => setApplicationType("island")}
            disabled={phaseIslandTypes.length === 0}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40 ${
              applicationType === "island"
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            Island
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">How should it be assigned?</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("assign")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              mode === "assign"
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            Organiser assigns
          </button>
          <button
            type="button"
            onClick={() => setMode("self")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              mode === "self"
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            I&apos;ll pick my own
          </button>
        </div>
        {mode === "self" && applicationType === "booths" ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {`A $${phase.selection_fee_amount.toFixed(2)} selection fee applies per booth you pick yourself.`}
          </p>
        ) : null}
      </div>

      {mode === "assign" ? (
        <form action={assignAction} className="flex flex-col gap-3">
          <input type="hidden" name="release_phase_id" value={phase.id} />

          {applicationType === "booths" ? (
            <div className="flex flex-col gap-2">
              {phaseBoothTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between gap-3">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{type.name}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {`$${type.base_price.toFixed(2)} · ${type.available} available`}
                    </span>
                  </span>
                  <input
                    type="number"
                    name={`quantity_${type.id}`}
                    min="0"
                    max={MAX_BOOTHS}
                    value={quantities[type.id] ?? 0}
                    onChange={(event) => setQuantity(type.id, Number(event.target.value))}
                    className="w-20 rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              ))}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {`${totalRequestedBooths} of ${MAX_BOOTHS} booths requested.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="island_type_id" className="text-sm font-medium">
                Island type
              </label>
              <select
                id="island_type_id"
                name="island_type_id"
                required
                value={selectedIslandTypeId}
                onChange={(event) => setSelectedIslandTypeId(event.target.value)}
                className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Choose an island type…</option>
                {phaseIslandTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {`${type.name} ($${type.base_price.toFixed(2)}) · ${type.available} available`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {assignState.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{assignState.error}</p>
          ) : null}

          <button
            type="submit"
            disabled={
              assignPending ||
              (applicationType === "booths" ? totalRequestedBooths === 0 : !selectedIslandTypeId)
            }
            className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {assignPending ? "Submitting…" : "Submit Application"}
          </button>
        </form>
      ) : (
        <form action={selfAction} className="flex flex-col gap-3">
          <input type="hidden" name="release_phase_id" value={phase.id} />

          {applicationType === "booths" ? (
            <div className="flex flex-col gap-2">
              {phaseAvailableBooths.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No live, available booths right now.
                </p>
              ) : (
                phaseAvailableBooths.map((booth) => (
                  <label key={booth.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="booth_id"
                      value={booth.id}
                      checked={selectedBoothIds.includes(booth.id)}
                      disabled={
                        !selectedBoothIds.includes(booth.id) && selectedBoothIds.length >= MAX_BOOTHS
                      }
                      onChange={() => toggleBooth(booth.id)}
                      className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                    />
                    {booth.organiser_ref}
                  </label>
                ))
              )}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {`${selectedBoothIds.length} of ${MAX_BOOTHS} booths selected.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="island_id" className="text-sm font-medium">
                Island
              </label>
              <select
                id="island_id"
                name="island_id"
                required
                value={selectedIslandId}
                onChange={(event) => setSelectedIslandId(event.target.value)}
                className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Choose an island…</option>
                {phaseAvailableIslands.map((island) => (
                  <option key={island.id} value={island.id}>
                    {island.organiser_ref}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selfState.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{selfState.error}</p>
          ) : null}

          <button
            type="submit"
            disabled={
              selfPending ||
              (applicationType === "booths" ? selectedBoothIds.length === 0 : !selectedIslandId)
            }
            className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {selfPending ? "Submitting…" : "Submit Application"}
          </button>
        </form>
      )}
    </div>
  );
}
