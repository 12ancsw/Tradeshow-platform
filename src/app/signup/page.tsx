import { redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const current = await getCurrentUserWithRoles();

  if (current) {
    redirect(current.roles.length > 0 ? "/dashboard" : "/signup/role");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <SignupForm />
    </main>
  );
}
