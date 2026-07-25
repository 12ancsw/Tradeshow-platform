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

  const [{ data: boothTypes }, { data: booths }, { data: boothGroups }, floorplanVersionResult] =
    await Promise.all([
      supabase.from("booth_types").select("id, category").eq("show_id", showId),
      supabase
        .from("booths")
        .select("id, organiser_ref, map_x, map_y, booth_type_id")
        .eq("show_id", showId)
        .order("organiser_ref", { ascending: true }),
      supabase
        .from("booth_groups")
        .select("id, organiser_ref, map_x, map_y")
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

  // Islands are their own pin now (below), so individual booths within one
  // no longer get tagged separately -- only standard/corner booths do.
  const boothPins = (booths ?? [])
    .filter((booth) => boothTypeCategoryById.get(booth.booth_type_id) !== "island")
    .map((booth) => ({
      id: booth.id,
      kind: "booth" as const,
      organiser_ref: booth.organiser_ref,
      map_x: booth.map_x === null ? null : Number(booth.map_x),
      map_y: booth.map_y === null ? null : Number(booth.map_y),
    }));

  const islandPins = (boothGroups ?? []).map((boothGroup) => ({
    id: boothGroup.id,
    kind: "island" as const,
    organiser_ref: boothGroup.organiser_ref,
    map_x: boothGroup.map_x === null ? null : Number(boothGroup.map_x),
    map_y: boothGroup.map_y === null ? null : Number(boothGroup.map_y),
  }));

  const pins = [...boothPins, ...islandPins];

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
        pins.length > 0 ? (
          <FloorplanTagger imageUrl={floorplanImageUrl} pins={pins} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add booths or islands above before tagging them on the floorplan.
          </p>
        )
      ) : null}
    </section>
  );
}
