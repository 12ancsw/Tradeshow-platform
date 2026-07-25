import { createClient } from "@/lib/supabase/server";
import { FloorplanUploadForm } from "@/components/floorplan-upload-form";
import { FloorplanTagger } from "@/components/floorplan-tagger";

export default async function FloorplanPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const { data: show } = await supabase
    .from("shows")
    .select("active_floorplan_version_id")
    .eq("id", showId)
    .single();

  const [{ data: boothTypes }, { data: booths }, floorplanVersionResult] = await Promise.all([
    supabase.from("booth_types").select("id, category").eq("show_id", showId),
    supabase
      .from("booths")
      .select("id, organiser_ref, map_x, map_y, booth_type_id")
      .eq("show_id", showId)
      .order("organiser_ref", { ascending: true }),
    show?.active_floorplan_version_id
      ? supabase
          .from("floorplan_versions")
          .select("image_path")
          .eq("id", show.active_floorplan_version_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const floorplanImageUrl = floorplanVersionResult.data
    ? supabase.storage.from("floorplans").getPublicUrl(floorplanVersionResult.data.image_path).data
        .publicUrl
    : null;

  const boothTypeCategoryById = new Map(
    (boothTypes ?? []).map((boothType) => [boothType.id, boothType.category]),
  );

  const taggerBooths = (booths ?? []).map((booth) => ({
    id: booth.id,
    organiser_ref: booth.organiser_ref,
    category: boothTypeCategoryById.get(booth.booth_type_id) ?? "standard",
    map_x: booth.map_x === null ? null : Number(booth.map_x),
    map_y: booth.map_y === null ? null : Number(booth.map_y),
  }));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Floorplan</h2>
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="font-medium">
          {floorplanImageUrl ? "Replace floorplan image" : "Upload floorplan image"}
        </h3>
        <FloorplanUploadForm showId={showId} />
      </div>

      {floorplanImageUrl ? (
        taggerBooths.length > 0 ? (
          <FloorplanTagger imageUrl={floorplanImageUrl} booths={taggerBooths} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add booths above before tagging them on the floorplan.
          </p>
        )
      ) : null}
    </section>
  );
}
