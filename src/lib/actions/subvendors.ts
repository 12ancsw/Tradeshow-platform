"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SubvendorFormState = {
  error: string | null;
};

type ParsedSubvendor =
  | { error: string }
  | {
      error: null;
      businessName: string;
      contactEmail: string | null;
      contactPhone: string | null;
      notes: string | null;
      passesNote: string | null;
      boothId: string | null;
    };

function parseSubvendorInput(formData: FormData): ParsedSubvendor {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const passesNote = String(formData.get("passes_note") ?? "").trim();
  const boothId = String(formData.get("booth_id") ?? "").trim();

  if (!businessName) {
    return { error: "Business name is required." };
  }

  return {
    error: null,
    businessName,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
    notes: notes || null,
    passesNote: passesNote || null,
    boothId: boothId || null,
  };
}

async function uploadLogoIfProvided(
  supabase: Awaited<ReturnType<typeof createClient>>,
  showId: string,
  formData: FormData,
): Promise<{ logoPath: string | null; error: string | null }> {
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return { logoPath: null, error: null };
  }

  if (!file.type.startsWith("image/")) {
    return { logoPath: null, error: "Logo must be an image." };
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${showId}/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from("vendor-logos").upload(path, file, {
    contentType: file.type,
  });

  if (error) {
    return { logoPath: null, error: error.message };
  }

  return { logoPath: path, error: null };
}

export async function createSubvendor(
  boothGroupId: string,
  showId: string,
  _prevState: SubvendorFormState,
  formData: FormData,
): Promise<SubvendorFormState> {
  const parsed = parseSubvendorInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();

  const { logoPath, error: logoError } = await uploadLogoIfProvided(supabase, showId, formData);

  if (logoError) {
    return { error: logoError };
  }

  const { error } = await supabase.from("booth_group_subvendors").insert({
    show_id: showId,
    booth_group_id: boothGroupId,
    booth_id: parsed.boothId,
    business_name: parsed.businessName,
    contact_email: parsed.contactEmail,
    contact_phone: parsed.contactPhone,
    notes: parsed.notes,
    passes_note: parsed.passesNote,
    logo_path: logoPath,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That booth already has a subvendor assigned." };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}

export async function updateSubvendor(
  subvendorId: string,
  showId: string,
  _prevState: SubvendorFormState,
  formData: FormData,
): Promise<SubvendorFormState> {
  const parsed = parseSubvendorInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();

  const { logoPath, error: logoError } = await uploadLogoIfProvided(supabase, showId, formData);

  if (logoError) {
    return { error: logoError };
  }

  const update: Record<string, unknown> = {
    booth_id: parsed.boothId,
    business_name: parsed.businessName,
    contact_email: parsed.contactEmail,
    contact_phone: parsed.contactPhone,
    notes: parsed.notes,
    passes_note: parsed.passesNote,
  };

  if (logoPath) {
    update.logo_path = logoPath;
  }

  const { error } = await supabase
    .from("booth_group_subvendors")
    .update(update)
    .eq("id", subvendorId);

  if (error) {
    if (error.code === "23505") {
      return { error: "That booth already has a subvendor assigned." };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}

export async function deleteSubvendor(
  subvendorId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("booth_group_subvendors").delete().eq("id", subvendorId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/islands`);
  return { error: null };
}
