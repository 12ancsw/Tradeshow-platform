"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { updateBoothPosition } from "@/lib/actions/booths";

type Booth = {
  id: string;
  organiser_ref: string;
  map_x: number | null;
  map_y: number | null;
};

const NUDGE_STEP = 0.5;

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function FloorplanTagger({ imageUrl, booths }: { imageUrl: string; booths: Booth[] }) {
  const [selectedBoothId, setSelectedBoothId] = useState("");
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unplacedCount = booths.filter((booth) => booth.map_x === null).length;
  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId);

  function selectBooth(boothId: string) {
    const booth = booths.find((candidate) => candidate.id === boothId);
    setSelectedBoothId(boothId);
    setError(null);
    setPendingPosition(
      booth && booth.map_x !== null && booth.map_y !== null
        ? { x: booth.map_x, y: booth.map_y }
        : null,
    );
  }

  function handleImageClick(event: MouseEvent<HTMLDivElement>) {
    if (!selectedBoothId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPendingPosition({ x: clamp(x), y: clamp(y) });
    setError(null);
  }

  function handlePinClick(booth: Booth, event: MouseEvent) {
    event.stopPropagation();
    selectBooth(booth.id);
  }

  function nudge(dx: number, dy: number) {
    setPendingPosition((prev) => (prev ? { x: clamp(prev.x + dx), y: clamp(prev.y + dy) } : prev));
  }

  function confirmPlacement() {
    if (!selectedBoothId || !pendingPosition) return;
    startTransition(async () => {
      const result = await updateBoothPosition(selectedBoothId, pendingPosition.x, pendingPosition.y);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelectedBoothId("");
      setPendingPosition(null);
    });
  }

  function cancel() {
    setSelectedBoothId("");
    setPendingPosition(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="booth-picker" className="text-sm font-medium">
          Select a booth to place
        </label>
        <select
          id="booth-picker"
          value={selectedBoothId}
          onChange={(event) => selectBooth(event.target.value)}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Choose a booth…</option>
          {booths.map((booth) => (
            <option key={booth.id} value={booth.id}>
              {booth.organiser_ref}
              {booth.map_x === null ? " (unplaced)" : ""}
            </option>
          ))}
        </select>
        {unplacedCount > 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {unplacedCount} booth{unplacedCount === 1 ? "" : "s"} not yet placed.
          </p>
        ) : null}
      </div>

      <div
        onClick={handleImageClick}
        className="relative w-full touch-pan-x touch-pan-y overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Floorplan" className="block w-full select-none" draggable={false} />

        {booths
          .filter((booth) => booth.map_x !== null && booth.map_y !== null && booth.id !== selectedBoothId)
          .map((booth) => (
            <button
              key={booth.id}
              type="button"
              onClick={(event) => handlePinClick(booth, event)}
              style={{ left: `${booth.map_x}%`, top: `${booth.map_y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-black px-2 py-1 text-xs font-medium text-white shadow dark:bg-white dark:text-black"
            >
              {booth.organiser_ref}
            </button>
          ))}

        {pendingPosition ? (
          <span
            style={{ left: `${pendingPosition.x}%`, top: `${pendingPosition.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 px-2 py-1 text-xs font-medium text-white shadow"
          >
            {selectedBooth?.organiser_ref ?? "?"}
          </span>
        ) : null}
      </div>

      {selectedBoothId && pendingPosition ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-sm">
            Place <span className="font-medium">{selectedBooth?.organiser_ref}</span> here?
          </p>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => nudge(0, -NUDGE_STEP)}
              className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
              aria-label="Nudge up"
            >
              ↑
            </button>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => nudge(-NUDGE_STEP, 0)}
                className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
                aria-label="Nudge left"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => nudge(NUDGE_STEP, 0)}
                className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
                aria-label="Nudge right"
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={() => nudge(0, NUDGE_STEP)}
              className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
              aria-label="Nudge down"
            >
              ↓
            </button>
          </div>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={confirmPlacement}
              disabled={isPending}
              className="flex-1 rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {isPending ? "Saving…" : "Confirm placement"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base font-medium dark:border-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
