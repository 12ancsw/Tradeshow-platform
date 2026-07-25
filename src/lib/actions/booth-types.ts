"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BoothTypeFormState = {
  error: string | null;
};

const CATEGORIES = ["island", "standard", "corner"] as const;

type ParsedBoothType =
  | { error: string }
  | {
      error: null;
      name: string;
      category: (typeof CATEGORIES)[number];
      basePrice: number;
    };

function parseBoothTypeInput(formData: FormData): ParsedBoothType {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const basePriceInput = String(formData.get("base_price") ?? "");

  if (!name) {
    return { error: "Name is required." };
  }

  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: "Choose a booth type." };
  }

  const basePrice = Number(basePriceInput);

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { error: "Cost must be a valid non-negative number." };
  }

  return {
    error: null,
    name,
    category: category as (typeof CATEGORIES)[number],
    basePrice,
  };
}

export async function createBoothType(
  showId: string,
  _prevState: BoothTypeFormState,
  formData: FormData,
): Promise<BoothTypeFormState> {
  const parsed = parseBoothTypeInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booth_types").insert({
    show_id: showId,
    name: parsed.name,
    category: parsed.category,
    base_price: parsed.basePrice,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/booth-types`);
  revalidatePath(`/dashboard/shows/${showId}/booths`);
  return { error: null };
}

export async function updateBoothType(
  boothTypeId: string,
  showId: string,
  _prevState: BoothTypeFormState,
  formData: FormData,
): Promise<BoothTypeFormState> {
  const parsed = parseBoothTypeInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("booth_types")
    .update({
      name: parsed.name,
      category: parsed.category,
      base_price: parsed.basePrice,
    })
    .eq("id", boothTypeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/booth-types`);
  revalidatePath(`/dashboard/shows/${showId}/booths`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  return { error: null };
}

export async function deleteBoothType(
  boothTypeId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("booth_types").delete().eq("id", boothTypeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/booth-types`);
  revalidatePath(`/dashboard/shows/${showId}/booths`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  return { error: null };
}
