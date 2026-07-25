"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BoothFormState = {
  error: string | null;
};

export async function createBooth(
  showId: string,
  _prevState: BoothFormState,
  formData: FormData,
): Promise<BoothFormState> {
  const boothTypeId = String(formData.get("booth_type_id") ?? "");
  const organiserRef = String(formData.get("organiser_ref") ?? "").trim();

  if (!boothTypeId || !organiserRef) {
    return { error: "Booth type and identifier are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booths").insert({
    show_id: showId,
    booth_type_id: boothTypeId,
    organiser_ref: organiserRef,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Booth "${organiserRef}" already exists for this show.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}`);
  return { error: null };
}

export async function updateBoothPosition(
  boothId: string,
  mapX: number,
  mapY: number,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: booth, error: fetchError } = await supabase
    .from("booths")
    .select("show_id")
    .eq("id", boothId)
    .single();

  if (fetchError || !booth) {
    return { error: fetchError?.message ?? "Booth not found." };
  }

  const { error } = await supabase
    .from("booths")
    .update({ map_x: mapX, map_y: mapY })
    .eq("id", boothId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${booth.show_id}`);
  return { error: null };
}
