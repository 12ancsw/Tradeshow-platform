import { createClient } from "@/lib/supabase/server";
import { ReleasePhaseForm } from "@/components/release-phase-form";
import { ReleasePhaseManager } from "@/components/release-phase-manager";

export default async function PhasesPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const [
    { data: phases },
    { data: boothTypes },
    { data: islandTypes },
    { data: phaseBoothTypes },
    { data: phaseIslandTypes },
  ] = await Promise.all([
    supabase
      .from("release_phases")
      .select("id, name, status, selection_fee_amount, allocation_mode")
      .eq("show_id", showId)
      .order("created_at", { ascending: true }),
    supabase
      .from("booth_types")
      .select("id, name")
      .eq("show_id", showId)
      .order("created_at", { ascending: true }),
    supabase
      .from("island_types")
      .select("id, name")
      .eq("show_id", showId)
      .order("created_at", { ascending: true }),
    supabase
      .from("release_phase_booth_types")
      .select("id, release_phase_id, booth_type_id")
      .eq("show_id", showId),
    supabase
      .from("release_phase_island_types")
      .select("id, release_phase_id, island_type_id")
      .eq("show_id", showId),
  ]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Release Phases</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Control when vendors can apply. Only booth/island types attached to a phase you&apos;ve
        flipped to Open are applyable-to; flip a phase to Closed to stop new applications and work
        through what came in.
      </p>

      <ReleasePhaseManager
        showId={showId}
        phases={phases ?? []}
        boothTypes={boothTypes ?? []}
        islandTypes={islandTypes ?? []}
        phaseBoothTypes={phaseBoothTypes ?? []}
        phaseIslandTypes={phaseIslandTypes ?? []}
      />

      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="font-medium">Create Phase</h3>
        <ReleasePhaseForm showId={showId} />
      </div>
    </section>
  );
}
