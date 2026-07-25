type BoothType = {
  id: string;
  name: string;
  category: string;
  base_price: number | string;
  selection_fee: number | string;
};

const CATEGORY_LABELS: Record<string, string> = {
  island: "Island",
  standard: "Standard",
  corner: "Corner",
};

export function BoothTypeList({ boothTypes }: { boothTypes: BoothType[] }) {
  if (boothTypes.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No booth types yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {boothTypes.map((boothType) => (
        <li
          key={boothType.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          <span className="flex flex-col">
            <span className="font-medium">{boothType.name}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {CATEGORY_LABELS[boothType.category] ?? boothType.category}
            </span>
          </span>
          <span className="flex flex-col items-end text-sm">
            <span>${Number(boothType.base_price).toFixed(2)}</span>
            {Number(boothType.selection_fee) > 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                +${Number(boothType.selection_fee).toFixed(2)} selection fee
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
