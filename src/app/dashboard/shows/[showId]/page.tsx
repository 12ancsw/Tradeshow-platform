import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoothTypeList } from "@/components/booth-type-list";
import { BoothTypeForm } from "@/components/booth-type-form";
import { BoothList } from "@/components/booth-list";
import { BoothForm } from "@/components/booth-form";
import { FloorplanUploadForm } from "@/components/floorplan-upload-form";
import { FloorplanTagger } from "@/components/floorplan-tagger";

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const current = await getCurrentUserWithRoles();

  if (!current) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: show } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date, venue_name, active_floorplan_version_id")
    .eq("id", showId)
    .single();

  if (!show) {
    notFound();
  }

  const [{ data: boothTypes }, { data: booths }, floorplanVersionResult] = await Promise.all([
    supabase
      .from("booth_types")
      .select("id, name, category, base_price, selection_fee")
      .eq("show_id", showId)
      .order("created_at", { ascending: true }),
    supabase
      .from("booths")
      .select("id, organiser_ref, status, map_x, map_y, booth_type_id")
      .eq("show_id", showId)
      .order("organiser_ref", { ascending: true }),
    show.active_floorplan_version_id
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

  const taggerBooths = (booths ?? []).map((booth) => ({
    id: booth.id,
    organiser_ref: booth.organiser_ref,
    map_x: booth.map_x === null ? null : Number(booth.map_x),
    map_y: booth.map_y === null ? null : Number(booth.map_y),
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        <Link href="/dashboard" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Dashboard
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">{show.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {show.start_date} – {show.end_date} · {show.venue_name}
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Booth Types</h2>
          <BoothTypeList boothTypes={boothTypes ?? []} showId={show.id} />
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <h3 className="font-medium">Create Booth Type</h3>
            <BoothTypeForm showId={show.id} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Booths</h2>
          <BoothList booths={booths ?? []} boothTypes={boothTypes ?? []} showId={show.id} />
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <h3 className="font-medium">Add Booth</h3>
            {boothTypes && boothTypes.length > 0 ? (
              <BoothForm showId={show.id} boothTypes={boothTypes} />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Create a booth type first.
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Floorplan</h2>
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <h3 className="font-medium">
              {floorplanImageUrl ? "Replace floorplan image" : "Upload floorplan image"}
            </h3>
            <FloorplanUploadForm showId={show.id} />
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
      </main>
    </div>
  );
}
