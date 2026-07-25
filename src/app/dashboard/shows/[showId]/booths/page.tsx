import { createClient } from "@/lib/supabase/server";
import { BoothList } from "@/components/booth-list";
import { BoothForm } from "@/components/booth-form";

export default async function BoothsPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const [{ data: boothTypes }, { data: booths }] = await Promise.all([
    supabase
      .from("booth_types")
      .select("id, name, category, base_price")
      .eq("show_id", showId)
      .order("created_at", { ascending: true }),
    supabase
      .from("booths")
      .select("id, organiser_ref, status, map_x, map_y, booth_type_id")
      .eq("show_id", showId)
      .order("organiser_ref", { ascending: true }),
  ]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Booths</h2>
      <BoothList booths={booths ?? []} boothTypes={boothTypes ?? []} showId={showId} />
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="font-medium">Add Booth</h3>
        {boothTypes && boothTypes.length > 0 ? (
          <BoothForm showId={showId} boothTypes={boothTypes} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Create a booth type first.</p>
        )}
      </div>
    </section>
  );
}
