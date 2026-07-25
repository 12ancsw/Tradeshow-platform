"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type IslandTypeFormState = {
  error: string | null;
};

type ParsedIslandType = { error: string } | { error: null; name: string; basePrice: number };

function parseIslandTypeInput(formData: FormData): ParsedIslandType {
  const name = String(formData.get("name") ?? "").trim();
  const basePriceInput = String(formData.get("base_price") ?? "");

  if (!name) {
    return { error: "Name is required." };
  }

  const basePrice = Number(basePriceInput);

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { error: "Cost must be a valid non-negative number." };
  }

  return { error: null, name, basePrice };
}

export async function createIslandType(
  showId: string,
  _prevState: IslandTypeFormState,
  formData: FormData,
): Promise<IslandTypeFormState> {
  const parsed = parseIslandTypeInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("island_types").insert({
    show_id: showId,
    name: parsed.name,
    base_price: parsed.basePrice,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}

export async function updateIslandType(
  islandTypeId: string,
  showId: string,
  _prevState: IslandTypeFormState,
  formData: FormData,
): Promise<IslandTypeFormState> {
  const parsed = parseIslandTypeInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("island_types")
    .update({ name: parsed.name, base_price: parsed.basePrice })
    .eq("id", islandTypeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}

export async function deleteIslandType(
  islandTypeId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("island_types").delete().eq("id", islandTypeId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "Can't delete this island type — it's used by existing islands. Reassign or remove those islands first.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}
