import { createClient } from "@/lib/supabase/server";

export type AppRole = "platform_admin" | "organiser_staff" | "vendor" | "attendee";

export type UserRoleRow = {
  role: AppRole;
  organiser_id: string | null;
};

export async function getCurrentUserWithRoles() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).single(),
    supabase.from("user_roles").select("role, organiser_id").eq("user_id", user.id),
  ]);

  return {
    user,
    name: profile?.name ?? null,
    roles: (roles ?? []) as UserRoleRow[],
  };
}
