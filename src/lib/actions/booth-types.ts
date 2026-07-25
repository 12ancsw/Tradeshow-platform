"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BoothTypeFormState = {
  error: string | null;
};

const CATEGORIES = ["island", "standard", "corner"] as const;

export async function createBoothType(
  showId: string,
  _prevState: BoothTypeFormState,
  formData: FormData,
): Promise<BoothTypeFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const basePriceInput = String(formData.get("base_price") ?? "");
  const selectionFeeInput = String(formData.get("selection_fee") ?? "0");

  if (!name) {
    return { error: "Name is required." };
  }

  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: "Choose a booth type." };
  }

  const basePrice = Number(basePriceInput);
  const selectionFee = Number(selectionFeeInput || "0");

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { error: "Cost must be a valid non-negative number." };
  }

  if (!Number.isFinite(selectionFee) || selectionFee < 0) {
    return { error: "Selection fee must be a valid non-negative number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booth_types").insert({
    show_id: showId,
    name,
    category,
    base_price: basePrice,
    selection_fee: selectionFee,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}`);
  return { error: null };
}
