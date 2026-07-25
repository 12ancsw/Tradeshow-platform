import { redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { RoleForm } from "./role-form";

export default async function ChooseRolePage() {
  const current = await getCurrentUserWithRoles();

  if (!current) {
    redirect("/login");
  }

  if (current.roles.length > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold">One more thing</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          How will you be using the platform?
        </p>
      </div>
      <RoleForm />
    </main>
  );
}
