type BoothType = { id: string; name: string };
type Booth = {
  id: string;
  organiser_ref: string;
  status: string;
  map_x: number | string | null;
  map_y: number | string | null;
  booth_type_id: string;
};

export function BoothList({ booths, boothTypes }: { booths: Booth[]; boothTypes: BoothType[] }) {
  if (booths.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No booths yet.</p>;
  }

  const boothTypeById = new Map(boothTypes.map((boothType) => [boothType.id, boothType]));

  return (
    <ul className="flex flex-col gap-2">
      {booths.map((booth) => (
        <li
          key={booth.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          <span className="flex flex-col">
            <span className="font-medium">{booth.organiser_ref}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {boothTypeById.get(booth.booth_type_id)?.name ?? "Unknown type"}
            </span>
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {booth.map_x === null ? "Not placed" : "Placed"}
          </span>
        </li>
      ))}
    </ul>
  );
}
