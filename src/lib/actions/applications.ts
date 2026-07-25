"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ApplyFormState = {
  error: string | null;
};

async function ensureVendorRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "vendor")
    .maybeSingle();

  if (!existingRole) {
    await supabase.from("user_roles").insert({
      user_id: userId,
      role: "vendor",
      organiser_id: null,
      granted_by: null,
    });
  }

  await supabase.from("vendor_profiles").insert({ user_id: userId }).select().maybeSingle();
}

export async function applyAssigned(
  showId: string,
  _prevState: ApplyFormState,
  formData: FormData,
): Promise<ApplyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to apply." };
  }

  const releasePhaseId = String(formData.get("release_phase_id") ?? "").trim();
  const islandTypeId = String(formData.get("island_type_id") ?? "").trim() || null;

  if (!releasePhaseId) {
    return { error: "Choose a phase to apply under." };
  }

  const boothTypeIds: string[] = [];
  const quantities: number[] = [];

  if (!islandTypeId) {
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("quantity_")) continue;
      const qty = Number(value);
      if (qty > 0) {
        boothTypeIds.push(key.slice("quantity_".length));
        quantities.push(qty);
      }
    }
  }

  await ensureVendorRole(supabase, user.id);

  const { error } = await supabase.rpc("submit_application_assigned", {
    p_show_id: showId,
    p_release_phase_id: releasePhaseId,
    p_island_type_id: islandTypeId,
    p_booth_type_ids: islandTypeId ? null : boothTypeIds,
    p_booth_type_quantities: islandTypeId ? null : quantities,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/shows/${showId}`);
  revalidatePath(`/dashboard`);
  return { error: null };
}

export async function applySelfSelected(
  showId: string,
  _prevState: ApplyFormState,
  formData: FormData,
): Promise<ApplyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to apply." };
  }

  const releasePhaseId = String(formData.get("release_phase_id") ?? "").trim();
  const islandId = String(formData.get("island_id") ?? "").trim() || null;
  const boothIds = islandId ? [] : formData.getAll("booth_id").map(String);

  if (!releasePhaseId) {
    return { error: "Choose a phase to apply under." };
  }

  if (!islandId && boothIds.length === 0) {
    return { error: "Select at least one booth or an island." };
  }

  await ensureVendorRole(supabase, user.id);

  const { error } = await supabase.rpc("submit_application_self_selected", {
    p_show_id: showId,
    p_release_phase_id: releasePhaseId,
    p_booth_ids: islandId ? null : boothIds,
    p_island_id: islandId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/shows/${showId}`);
  revalidatePath(`/dashboard`);
  return { error: null };
}
