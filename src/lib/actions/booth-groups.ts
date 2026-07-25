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

  if (!organiserRef) {
    return { error: "Island identifier is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booth_groups").insert({
    show_id: showId,
    organiser_ref: organiserRef,
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

  if (!organiserRef) {
    return { error: "Island identifier is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("booth_groups")
    .update({ organiser_ref: organiserRef })
    .eq("id", boothGroupId);

  if (error) {
    if (error.code === "23505") {
      return { error: `Island "${organiserRef}" already exists for this show.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
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
