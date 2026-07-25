"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShowFormState = {
  error: string | null;
};

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
