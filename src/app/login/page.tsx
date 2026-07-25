import { redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const current = await getCurrentUserWithRoles();

  if (current) {
    redirect(current.roles.length > 0 ? "/dashboard" : "/signup/role");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Log in</h1>
      <LoginForm />
    </main>
  );
}
