import { createClient } from "@/lib/supabase/server";
import { BoothGroupForm } from "@/components/booth-group-form";
import { BoothGroupManager } from "@/components/booth-group-manager";

export default async function IslandsPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const [{ data: boothGroups }, { data: boothTypes }, { data: booths }, { data: subvendors }] =
    await Promise.all([
      supabase
        .from("booth_groups")
        .select("id, organiser_ref")
        .eq("show_id", showId)
        .order("organiser_ref", { ascending: true }),
      supabase.from("booth_types").select("id, category").eq("show_id", showId),
      supabase
        .from("booths")
        .select("id, organiser_ref, booth_type_id, booth_group_id")
        .eq("show_id", showId)
        .order("organiser_ref", { ascending: true }),
      supabase
        .from("booth_group_subvendors")
        .select(
          "id, booth_group_id, booth_id, business_name, contact_email, contact_phone, notes, passes_note, logo_path",
        )
        .eq("show_id", showId)
        .order("created_at", { ascending: true }),
    ]);

  const islandBoothTypeIds = new Set(
    (boothTypes ?? [])
      .filter((boothType) => boothType.category === "island")
      .map((boothType) => boothType.id),
  );

  const islandBooths = (booths ?? [])
    .filter((booth) => islandBoothTypeIds.has(booth.booth_type_id))
    .map((booth) => ({
      id: booth.id,
      organiser_ref: booth.organiser_ref,
      booth_group_id: booth.booth_group_id,
    }));

  const subvendorsWithLogoUrl = (subvendors ?? []).map(({ logo_path, ...subvendor }) => ({
    ...subvendor,
    logo_url: logo_path
      ? supabase.storage.from("vendor-logos").getPublicUrl(logo_path).data.publicUrl
      : null,
  }));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Islands</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Group island booths together and record their subvendors — business details, logo, and
        passes owed. This is a reference roster only; it doesn&apos;t affect pricing or
        applications.
      </p>

      <BoothGroupManager
        showId={showId}
        boothGroups={boothGroups ?? []}
        islandBooths={islandBooths}
        subvendors={subvendorsWithLogoUrl}
      />

      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="font-medium">Create Island</h3>
        <BoothGroupForm showId={showId} />
      </div>
    </section>
  );
}
