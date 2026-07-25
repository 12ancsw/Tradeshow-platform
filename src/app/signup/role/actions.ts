"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RoleFormState = {
  error: string | null;
};

// prevState/formData are required by useActionState's action signature but
// unused here — the role comes from the bound first argument instead.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function chooseRole(
  role: "vendor" | "attendee",
  _prevState: RoleFormState,
  _formData: FormData,
): Promise<RoleFormState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: user.id,
    role,
  });

  if (roleError) {
    return { error: roleError.message };
  }

  if (role === "vendor") {
    const { error: vendorError } = await supabase
      .from("vendor_profiles")
      .insert({ user_id: user.id });

    if (vendorError) {
      return { error: vendorError.message };
    }
  }

  redirect("/dashboard");
}
