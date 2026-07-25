import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReadOnlyFloorplan } from "@/components/read-only-floorplan";
import { ApplyForm } from "@/components/apply-form";

export default async function VendorShowPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const { data: show } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date, venue_name, payment_instructions, active_floorplan_version_id")
    .eq("id", showId)
    .single();

  if (!show) {
    notFound();
  }

  const [
    { data: boothTypes },
    { data: booths },
    { data: islandTypes },
    { data: boothGroups },
    { data: openPhasesData },
    { data: phaseBoothTypes },
    { data: phaseIslandTypes },
    floorplanVersionResult,
  ] = await Promise.all([
    supabase.from("booth_types").select("id, name, category, base_price").eq("show_id", showId),
    supabase
      .from("booths")
      .select("id, organiser_ref, status, map_x, map_y, booth_type_id")
      .eq("show_id", showId),
    supabase.from("island_types").select("id, name, base_price").eq("show_id", showId),
    supabase
      .from("booth_groups")
      .select("id, organiser_ref, status, map_x, map_y, island_type_id")
      .eq("show_id", showId),
    supabase
      .from("release_phases")
      .select("id, name, selection_fee_amount")
      .eq("show_id", showId)
      .eq("status", "open"),
    supabase
      .from("release_phase_booth_types")
      .select("release_phase_id, booth_type_id")
      .eq("show_id", showId),
    supabase
      .from("release_phase_island_types")
      .select("release_phase_id, island_type_id")
      .eq("show_id", showId),
    show.active_floorplan_version_id
      ? supabase
          .from("floorplan_versions")
          .select("image_path")
          .eq("id", show.active_floorplan_version_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const floorplanImageUrl = floorplanVersionResult.data
    ? supabase.storage.from("floorplans").getPublicUrl(floorplanVersionResult.data.image_path).data
        .publicUrl
    : null;

  const boothTypeCategoryById = new Map(
    (boothTypes ?? []).map((boothType) => [boothType.id, boothType.category]),
  );

  const boothTypeOptions = (boothTypes ?? [])
    .filter((boothType) => boothType.category !== "island")
    .map((boothType) => ({
      id: boothType.id,
      name: boothType.name,
      base_price: Number(boothType.base_price),
      available: (booths ?? []).filter(
        (booth) =>
          booth.booth_type_id === boothType.id && booth.status === "available" && booth.map_x !== null,
      ).length,
    }));

  const islandTypeOptions = (islandTypes ?? []).map((islandType) => ({
    id: islandType.id,
    name: islandType.name,
    base_price: Number(islandType.base_price),
    available: (boothGroups ?? []).filter(
      (group) =>
        group.island_type_id === islandType.id && group.status === "available" && group.map_x !== null,
    ).length,
  }));

  const availableBooths = (booths ?? [])
    .filter((booth) => booth.status === "available" && booth.map_x !== null)
    .filter((booth) => boothTypeCategoryById.get(booth.booth_type_id) !== "island")
    .map((booth) => ({
      id: booth.id,
      organiser_ref: booth.organiser_ref,
      booth_type_id: booth.booth_type_id,
    }));

  const availableIslands = (boothGroups ?? [])
    .filter((group) => group.status === "available" && group.map_x !== null)
    .map((group) => ({
      id: group.id,
      organiser_ref: group.organiser_ref,
      island_type_id: group.island_type_id as string,
    }));

  const openPhases = (openPhasesData ?? []).map((phase) => ({
    id: phase.id,
    name: phase.name,
    selection_fee_amount: Number(phase.selection_fee_amount),
    boothTypeIds: (phaseBoothTypes ?? [])
      .filter((link) => link.release_phase_id === phase.id)
      .map((link) => link.booth_type_id),
    islandTypeIds: (phaseIslandTypes ?? [])
      .filter((link) => link.release_phase_id === phase.id)
      .map((link) => link.island_type_id),
  }));

  const boothPins = (booths ?? [])
    .filter((booth) => boothTypeCategoryById.get(booth.booth_type_id) !== "island")
    .map((booth) => ({
      id: booth.id,
      kind: "booth" as const,
      organiser_ref: booth.organiser_ref,
      status: booth.status,
      map_x: booth.map_x === null ? null : Number(booth.map_x),
      map_y: booth.map_y === null ? null : Number(booth.map_y),
    }));

  const islandPins = (boothGroups ?? []).map((group) => ({
    id: group.id,
    kind: "island" as const,
    organiser_ref: group.organiser_ref,
    status: group.status,
    map_x: group.map_x === null ? null : Number(group.map_x),
    map_y: group.map_y === null ? null : Number(group.map_y),
  }));

  const pins = [...boothPins, ...islandPins];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        <Link href="/shows" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Shows
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">{show.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {show.start_date} – {show.end_date} · {show.venue_name}
          </p>
        </div>

        {floorplanImageUrl ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Floorplan</h2>
            <ReadOnlyFloorplan imageUrl={floorplanImageUrl} pins={pins} />
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Booth Types</h2>
          {boothTypeOptions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">None set up yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {boothTypeOptions.map((type) => (
                <li
                  key={type.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
                >
                  <span className="font-medium">{type.name}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {`$${type.base_price.toFixed(2)} · ${type.available} available`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {islandTypeOptions.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Island Types</h2>
            <ul className="flex flex-col gap-2">
              {islandTypeOptions.map((type) => (
                <li
                  key={type.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
                >
                  <span className="font-medium">{type.name}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {`$${type.base_price.toFixed(2)} · ${type.available} available`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Apply</h2>
          {user ? (
            <ApplyForm
              showId={showId}
              openPhases={openPhases}
              boothTypeOptions={boothTypeOptions}
              islandTypeOptions={islandTypeOptions}
              availableBooths={availableBooths}
              availableIslands={availableIslands}
            />
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sign up or log in to apply for a booth or island.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/signup"
                  className="flex-1 rounded-lg bg-black px-4 py-3 text-center text-base font-medium text-white dark:bg-white dark:text-black"
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-center text-base font-medium dark:border-zinc-700"
                >
                  Log in
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
