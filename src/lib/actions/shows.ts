"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShowFormState = {
  error: string | null;
};

const SHOW_TAB_SEGMENTS = [
  "details",
  "booth-types",
  "booths",
  "floorplan",
  "islands",
  "phases",
  "applications",
];

function revalidateShow(showId: string) {
  for (const segment of SHOW_TAB_SEGMENTS) {
    revalidatePath(`/dashboard/shows/${showId}/${segment}`);
  }
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/shows");
  revalidatePath("/dashboard");
}

export async function createShow(
  organiserId: string,
  _prevState: ShowFormState,
  formData: FormData,
): Promise<ShowFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const paymentInstructions = String(formData.get("payment_instructions") ?? "").trim();

  if (!name || !startDate || !endDate || !venueName) {
    return { error: "Name, dates, and venue are required." };
  }

  if (endDate < startDate) {
    return { error: "End date must be on or after the start date." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shows").insert({
    organiser_id: organiserId,
    name,
    start_date: startDate,
    end_date: endDate,
    venue_name: venueName,
    payment_instructions: paymentInstructions,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/organisers/${organiserId}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateShow(
  showId: string,
  _prevState: ShowFormState,
  formData: FormData,
): Promise<ShowFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const paymentInstructions = String(formData.get("payment_instructions") ?? "").trim();

  if (!name || !startDate || !endDate || !venueName) {
    return { error: "Name, dates, and venue are required." };
  }

  if (endDate < startDate) {
    return { error: "End date must be on or after the start date." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shows")
    .update({
      name,
      start_date: startDate,
      end_date: endDate,
      venue_name: venueName,
      payment_instructions: paymentInstructions,
    })
    .eq("id", showId);

  if (error) {
    return { error: error.message };
  }

  revalidateShow(showId);
  return { error: null };
}

export async function uploadShowLogo(
  showId: string,
  _prevState: ShowFormState,
  formData: FormData,
): Promise<ShowFormState> {
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Logo must be an image." };
  }

  const supabase = await createClient();

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${showId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("show-logos")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error } = await supabase.from("shows").update({ logo_path: path }).eq("id", showId);

  if (error) {
    return { error: error.message };
  }

  revalidateShow(showId);
  return { error: null };
}
