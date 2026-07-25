"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { updateBoothPosition } from "@/lib/actions/booths";
import { updateIslandPosition } from "@/lib/actions/booth-groups";

type Pin = {
  id: string;
  kind: "booth" | "island";
  organiser_ref: string;
  map_x: number | null;
  map_y: number | null;
};

const NUDGE_STEP = 0.5;
const ZOOM_STEP = 0.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

// Shared shape/sizing for every pin on the floorplan: centered, clipped.
// Currently always shows the ref as text, but the same container
// (overflow-hidden, centered content) is what a vendor's logo would later
// render into in place of that text, once booths/islands can be assigned
// to a vendor -- no layout changes needed then.
const PIN_BASE_CLASS =
  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full font-semibold leading-none shadow";

// Islands are few and are the unit an applicant actually books, so they
// stay at full size to stay tappable/legible. Standard/corner booths are
// far more numerous and clutter the floorplan at that size, so they're
// shown at a third of the size -- zoom in (above) to place or reselect
// them precisely. Individual booths within an island no longer get their
// own pin at all -- see the Islands tab for that roster.
function pinSizeClass(kind: Pin["kind"]) {
  return kind === "island" ? "h-5 px-1.5 text-[9px]" : "h-[6.67px] w-[6.67px] text-[0px]";
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function FloorplanTagger({ imageUrl, pins }: { imageUrl: string; pins: Pin[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [isPending, startTransition] = useTransition();

  const unplacedPins = pins.filter((pin) => pin.map_x === null);
  const unplacedCount = unplacedPins.length;
  const selectedPin = pins.find((pin) => pin.id === selectedId);

  function selectPin(pinId: string) {
    const pin = pins.find((candidate) => candidate.id === pinId);
    setSelectedId(pinId);
    setError(null);
    setPendingPosition(
      pin && pin.map_x !== null && pin.map_y !== null ? { x: pin.map_x, y: pin.map_y } : null,
    );
  }

  // Coordinates are computed against this element's own bounding rect (not
  // the scrollable outer container's), so they stay correct however far
  // it's zoomed in or scrolled -- important for placing several pins
  // close together.
  function handleImageClick(event: MouseEvent<HTMLDivElement>) {
    if (!selectedId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPendingPosition({ x: clamp(x), y: clamp(y) });
    setError(null);
  }

  function handlePinClick(pin: Pin, event: MouseEvent) {
    event.stopPropagation();
    selectPin(pin.id);
  }

  function nudge(dx: number, dy: number) {
    setPendingPosition((prev) => (prev ? { x: clamp(prev.x + dx), y: clamp(prev.y + dy) } : prev));
  }

  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }

  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }

  function confirmPlacement() {
    if (!selectedId || !pendingPosition || !selectedPin) return;
    startTransition(async () => {
      const result =
        selectedPin.kind === "island"
          ? await updateIslandPosition(selectedId, pendingPosition.x, pendingPosition.y)
          : await updateBoothPosition(selectedId, pendingPosition.x, pendingPosition.y);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelectedId("");
      setPendingPosition(null);
    });
  }

  function cancel() {
    setSelectedId("");
    setPendingPosition(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="pin-picker" className="text-sm font-medium">
          Select a booth or island to place
        </label>
        <select
          id="pin-picker"
          value={selectedId}
          onChange={(event) => selectPin(event.target.value)}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Choose…</option>
          {unplacedPins.map((pin) => (
            <option key={pin.id} value={pin.id}>
              {`${pin.kind === "island" ? "Island: " : ""}${pin.organiser_ref}`}
            </option>
          ))}
          {selectedPin && selectedPin.map_x !== null ? (
            <option key={selectedPin.id} value={selectedPin.id}>
              {`${selectedPin.kind === "island" ? "Island: " : ""}${selectedPin.organiser_ref} (placed — tap a pin to reposition)`}
            </option>
          ) : null}
        </select>
        {unplacedCount > 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {`${unplacedCount} not yet placed.`}
          </p>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            All placed — tap a pin on the floorplan to reposition it.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Zoom: {Math.round(zoom * 100)}%{" "}
          <span className="text-zinc-400 dark:text-zinc-500">
            — zoom in to place booths precisely
          </span>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="h-9 w-9 rounded-lg border border-zinc-300 text-lg disabled:opacity-40 dark:border-zinc-700"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="h-9 w-9 rounded-lg border border-zinc-300 text-lg disabled:opacity-40 dark:border-zinc-700"
          >
            +
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] w-full touch-pan-x touch-pan-y overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
        <div
          onClick={handleImageClick}
          className="relative"
          style={{ width: `${zoom * 100}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Floorplan"
            className="block w-full select-none"
            draggable={false}
          />

          {pins
            .filter((pin) => pin.map_x !== null && pin.map_y !== null && pin.id !== selectedId)
            .map((pin) => (
              <button
                key={pin.id}
                type="button"
                onClick={(event) => handlePinClick(pin, event)}
                style={{ left: `${pin.map_x}%`, top: `${pin.map_y}%` }}
                title={pin.organiser_ref}
                className={`${PIN_BASE_CLASS} ${pinSizeClass(pin.kind)} bg-black text-white dark:bg-white dark:text-black`}
              >
                {pin.organiser_ref}
              </button>
            ))}

          {pendingPosition ? (
            <span
              style={{ left: `${pendingPosition.x}%`, top: `${pendingPosition.y}%` }}
              title={selectedPin?.organiser_ref}
              className={`${PIN_BASE_CLASS} ${pinSizeClass(selectedPin?.kind ?? "booth")} bg-red-600 text-white`}
            >
              {selectedPin?.organiser_ref ?? "?"}
            </span>
          ) : null}
        </div>
      </div>

      {selectedId && pendingPosition ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-sm">
            Place <span className="font-medium">{selectedPin?.organiser_ref}</span> here?
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
