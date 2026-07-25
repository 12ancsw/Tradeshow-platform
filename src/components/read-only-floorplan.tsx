type Pin = {
  id: string;
  kind: "booth" | "island";
  organiser_ref: string;
  status: string;
  map_x: number | null;
  map_y: number | null;
};

const PIN_BASE_CLASS =
  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full font-semibold leading-none shadow";

function pinSizeClass(kind: Pin["kind"]) {
  return kind === "island" ? "h-5 px-1.5 text-[9px]" : "h-[6.67px] w-[6.67px] text-[0px]";
}

function pinColorClass(status: string) {
  return status === "available"
    ? "bg-black text-white dark:bg-white dark:text-black"
    : "bg-zinc-400 text-white dark:bg-zinc-600";
}

// Read-only reference view for vendors browsing a show -- no click
// handlers, no editing. Reuses the same pin sizing/shape as the
// organiser's floorplan tagger for visual consistency, colored by
// status instead: black/white = available, grey = anything else
// (held/pending_payment/confirmed/blocked all read the same here, since
// the point is just "can I still get this," not the exact reason not).
export function ReadOnlyFloorplan({ imageUrl, pins }: { imageUrl: string; pins: Pin[] }) {
  return (
    <div className="max-h-[70vh] w-full overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Floorplan" className="block w-full select-none" draggable={false} />

        {pins
          .filter((pin) => pin.map_x !== null && pin.map_y !== null)
          .map((pin) => (
            <span
              key={pin.id}
              style={{ left: `${pin.map_x}%`, top: `${pin.map_y}%` }}
              title={`${pin.organiser_ref} — ${pin.status}`}
              className={`${PIN_BASE_CLASS} ${pinSizeClass(pin.kind)} ${pinColorClass(pin.status)}`}
            >
              {pin.organiser_ref}
            </span>
          ))}
      </div>
    </div>
  );
}
