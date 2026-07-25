"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AddOnFormState = {
  error: string | null;
};

type ParsedAddOn =
  | { error: string }
  | { error: null; name: string; price: number; mandatory: boolean };

function parseAddOnInput(formData: FormData): ParsedAddOn {
  const name = String(formData.get("name") ?? "").trim();
  const priceInput = String(formData.get("price") ?? "");
  const mandatory = formData.get("mandatory") === "on";

  if (!name) {
    return { error: "Name is required." };
  }

  const price = Number(priceInput);

  if (!Number.isFinite(price) || price < 0) {
    return { error: "Price must be a valid non-negative number." };
  }

  return { error: null, name, price, mandatory };
}

export async function createAddOn(
  showId: string,
  _prevState: AddOnFormState,
  formData: FormData,
): Promise<AddOnFormState> {
  const parsed = parseAddOnInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("add_ons").insert({
    show_id: showId,
    name: parsed.name,
    price: parsed.price,
    mandatory: parsed.mandatory,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/booth-types`);
  return { error: null };
}

export async function updateAddOn(
  addOnId: string,
  showId: string,
  _prevState: AddOnFormState,
  formData: FormData,
): Promise<AddOnFormState> {
  const parsed = parseAddOnInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("add_ons")
    .update({ name: parsed.name, price: parsed.price, mandatory: parsed.mandatory })
    .eq("id", addOnId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/booth-types`);
  return { error: null };
}

export async function deleteAddOn(
  addOnId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("add_ons").delete().eq("id", addOnId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/booth-types`);
  return { error: null };
}
