"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadLogoIfProvided, type SubvendorFormState } from "@/lib/actions/subvendors";

export async function claimSubvendor(subvendorId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to claim this invite." };
  }

  const { error: claimError } = await supabase.rpc("claim_booth_group_subvendor", {
    target_id: subvendorId,
  });

  if (claimError) {
    return { error: claimError.message };
  }

  // Claiming an invite is the "vendor role gets granted as part of a real
  // flow" moment described in CLAUDE.md -- same self-serve RLS policy
  // signup itself never uses. Ignore duplicate-key errors: the user may
  // already hold the role / have a profile from an earlier claim.
  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "vendor")
    .maybeSingle();

  if (!existingRole) {
    await supabase.from("user_roles").insert({
      user_id: user.id,
      role: "vendor",
      organiser_id: null,
      granted_by: null,
    });
  }

  await supabase
    .from("vendor_profiles")
    .insert({ user_id: user.id })
    .select()
    .maybeSingle();

  revalidatePath(`/subvendor-invite/${subvendorId}`);
  return { error: null };
}

export async function updateOwnSubvendor(
  subvendorId: string,
  _prevState: SubvendorFormState,
  formData: FormData,
): Promise<SubvendorFormState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!businessName) {
    return { error: "Business name is required." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: own, error: fetchError } = await supabase
    .from("booth_group_subvendors")
    .select("show_id")
    .eq("id", subvendorId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !own) {
    return { error: "This listing isn't linked to your account." };
  }

  const { logoPath, error: logoError } = await uploadLogoIfProvided(supabase, own.show_id, formData);

  if (logoError) {
    return { error: logoError };
  }

  const { error } = await supabase.rpc("update_own_booth_group_subvendor", {
    target_id: subvendorId,
    new_business_name: businessName,
    new_contact_email: contactEmail || null,
    new_contact_phone: contactPhone || null,
    new_notes: notes || null,
    new_logo_path: logoPath,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/subvendor-invite/${subvendorId}`);
  return { error: null };
}
