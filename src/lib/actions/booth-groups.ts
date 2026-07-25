"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BoothGroupFormState = {
  error: string | null;
};

export async function createBoothGroup(
  showId: string,
  _prevState: BoothGroupFormState,
  formData: FormData,
): Promise<BoothGroupFormState> {
  const organiserRef = String(formData.get("organiser_ref") ?? "").trim();
  const islandTypeId = String(formData.get("island_type_id") ?? "").trim();

  if (!organiserRef) {
    return { error: "Island identifier is required." };
  }

  if (!islandTypeId) {
    return { error: "Island type is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booth_groups").insert({
    show_id: showId,
    organiser_ref: organiserRef,
    island_type_id: islandTypeId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Island "${organiserRef}" already exists for this show.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}

export async function updateBoothGroup(
  boothGroupId: string,
  showId: string,
  _prevState: BoothGroupFormState,
  formData: FormData,
): Promise<BoothGroupFormState> {
  const organiserRef = String(formData.get("organiser_ref") ?? "").trim();
  const islandTypeId = String(formData.get("island_type_id") ?? "").trim();

  if (!organiserRef) {
    return { error: "Island identifier is required." };
  }

  if (!islandTypeId) {
    return { error: "Island type is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("booth_groups")
    .update({ organiser_ref: organiserRef, island_type_id: islandTypeId })
    .eq("id", boothGroupId);

  if (error) {
    if (error.code === "23505") {
      return { error: `Island "${organiserRef}" already exists for this show.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  return { error: null };
}

export async function deleteBoothGroup(
  boothGroupId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("booth_groups").delete().eq("id", boothGroupId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  return { error: null };
}

export async function updateIslandPosition(
  boothGroupId: string,
  mapX: number,
  mapY: number,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: boothGroup, error: fetchError } = await supabase
    .from("booth_groups")
    .select("show_id")
    .eq("id", boothGroupId)
    .single();

  if (fetchError || !boothGroup) {
    return { error: fetchError?.message ?? "Island not found." };
  }

  const { error } = await supabase
    .from("booth_groups")
    .update({ map_x: mapX, map_y: mapY })
    .eq("id", boothGroupId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${boothGroup.show_id}/floorplan`);
  revalidatePath(`/dashboard/shows/${boothGroup.show_id}/islands`);
  return { error: null };
}

export async function setBoothGroup(
  boothId: string,
  boothGroupId: string | null,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("booths")
    .update({ booth_group_id: boothGroupId })
    .eq("id", boothId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}
