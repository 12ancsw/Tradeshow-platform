"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReleasePhaseFormState = {
  error: string | null;
};

const STATUSES = ["draft", "open", "closed"] as const;
const ALLOCATION_MODES = ["organiser_allocated", "immediate_selection"] as const;

function parseReleasePhaseInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const feeInput = String(formData.get("selection_fee_amount") ?? "0");
  const fee = Number(feeInput);
  const allocationModeInput = String(formData.get("allocation_mode") ?? "organiser_allocated");

  if (!name) {
    return { error: "Name is required." } as const;
  }

  if (!Number.isFinite(fee) || fee < 0) {
    return { error: "Selection fee must be a valid non-negative number." } as const;
  }

  if (!ALLOCATION_MODES.includes(allocationModeInput as (typeof ALLOCATION_MODES)[number])) {
    return { error: "Invalid assignment option." } as const;
  }

  return {
    error: null,
    name,
    fee,
    allocationMode: allocationModeInput as (typeof ALLOCATION_MODES)[number],
  } as const;
}

export async function createReleasePhase(
  showId: string,
  _prevState: ReleasePhaseFormState,
  formData: FormData,
): Promise<ReleasePhaseFormState> {
  const parsed = parseReleasePhaseInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("release_phases").insert({
    show_id: showId,
    name: parsed.name,
    selection_fee_amount: parsed.fee,
    allocation_mode: parsed.allocationMode,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}

export async function updateReleasePhase(
  phaseId: string,
  showId: string,
  _prevState: ReleasePhaseFormState,
  formData: FormData,
): Promise<ReleasePhaseFormState> {
  const parsed = parseReleasePhaseInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("release_phases")
    .update({
      name: parsed.name,
      selection_fee_amount: parsed.fee,
      allocation_mode: parsed.allocationMode,
    })
    .eq("id", phaseId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}

export async function updateReleasePhaseStatus(
  phaseId: string,
  showId: string,
  status: (typeof STATUSES)[number],
): Promise<{ error: string | null }> {
  if (!STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("release_phases").update({ status }).eq("id", phaseId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}

export async function deleteReleasePhase(
  phaseId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("release_phases").delete().eq("id", phaseId);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "Can't delete this phase — it already has applications submitted against it.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}

export async function attachBoothTypeToPhase(
  phaseId: string,
  boothTypeId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("release_phase_booth_types").insert({
    show_id: showId,
    release_phase_id: phaseId,
    booth_type_id: boothTypeId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}

export async function detachBoothTypeFromPhase(
  linkId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("release_phase_booth_types").delete().eq("id", linkId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}

export async function attachIslandTypeToPhase(
  phaseId: string,
  islandTypeId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("release_phase_island_types").insert({
    show_id: showId,
    release_phase_id: phaseId,
    island_type_id: islandTypeId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}

export async function detachIslandTypeFromPhase(
  linkId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("release_phase_island_types").delete().eq("id", linkId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/phases`);
  return { error: null };
}
