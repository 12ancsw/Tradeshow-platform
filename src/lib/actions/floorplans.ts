"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FloorplanFormState = {
  error: string | null;
};

export async function uploadFloorplan(
  showId: string,
  _prevState: FloorplanFormState,
  formData: FormData,
): Promise<FloorplanFormState> {
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${showId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("floorplans").upload(path, file, {
    contentType: file.type,
  });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: version, error: versionError } = await supabase
    .from("floorplan_versions")
    .insert({ show_id: showId, image_path: path, uploaded_by: user.id })
    .select("id")
    .single();

  if (versionError || !version) {
    return { error: versionError?.message ?? "Couldn't save the floorplan version." };
  }

  const { error: showError } = await supabase
    .from("shows")
    .update({ active_floorplan_version_id: version.id })
    .eq("id", showId);

  if (showError) {
    return { error: showError.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  return { error: null };
}
