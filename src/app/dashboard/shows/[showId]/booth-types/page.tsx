import { createClient } from "@/lib/supabase/server";
import { BoothTypeList } from "@/components/booth-type-list";
import { BoothTypeForm } from "@/components/booth-type-form";
import { AddOnList } from "@/components/add-on-list";
import { AddOnForm } from "@/components/add-on-form";

export default async function BoothTypesPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const [{ data: boothTypes }, { data: addOns }, { data: booths }] = await Promise.all([
    supabase
      .from("booth_types")
      .select("id, name, category, base_price")
      .eq("show_id", showId)
      .order("created_at", { ascending: true }),
    supabase
      .from("add_ons")
      .select("id, name, price, mandatory")
      .eq("show_id", showId)
      .order("created_at", { ascending: true }),
    supabase.from("booths").select("booth_type_id").eq("show_id", showId),
  ]);

  const boothCountByType: Record<string, number> = {};
  for (const booth of booths ?? []) {
    boothCountByType[booth.booth_type_id] = (boothCountByType[booth.booth_type_id] ?? 0) + 1;
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Booth Types</h2>
        <BoothTypeList
          boothTypes={boothTypes ?? []}
          boothCountByType={boothCountByType}
          showId={showId}
        />
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <h3 className="font-medium">Create Booth Type</h3>
          <BoothTypeForm showId={showId} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Add-ons</h2>
        <AddOnList addOns={addOns ?? []} showId={showId} />
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <h3 className="font-medium">Create Add-on</h3>
          <AddOnForm showId={showId} />
        </div>
      </section>
    </>
  );
}
