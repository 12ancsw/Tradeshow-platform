"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OrganiserFormState = {
  error: string | null;
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createOrganiser(
  _prevState: OrganiserFormState,
  formData: FormData,
): Promise<OrganiserFormState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }

  const slug = slugify(name);

  if (!slug) {
    return { error: "Name must contain at least one letter or number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organisers").insert({ name, slug });

  if (error) {
    return { error: `Couldn't create organiser: ${error.message}` };
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export type AssignStaffFormState = {
  error: string | null;
  message: string | null;
};

export async function assignOrganiserStaff(
  organiserId: string,
  _prevState: AssignStaffFormState,
  formData: FormData,
): Promise<AssignStaffFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email is required.", message: null };
  }

  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { error: "You must be logged in.", message: null };
  }

  const { data: targetUser, error: lookupError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message, message: null };
  }

  if (!targetUser) {
    return { error: `No account found for ${email}.`, message: null };
  }

  const { error: grantError } = await supabase.from("user_roles").insert({
    user_id: targetUser.id,
    role: "organiser_staff",
    organiser_id: organiserId,
    granted_by: currentUser.id,
  });

  if (grantError) {
    if (grantError.code === "23505") {
      return { error: `${email} already has organiser staff access here.`, message: null };
    }
    return { error: grantError.message, message: null };
  }

  revalidatePath(`/dashboard/organisers/${organiserId}`);
  revalidatePath("/dashboard");
  return { error: null, message: `${email} is now organiser staff for this organiser.` };
}
