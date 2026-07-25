import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubvendorInviteClaim } from "@/components/subvendor-invite-claim";

export default async function SubvendorInvitePage({
  params,
}: {
  params: Promise<{ subvendorId: string }>;
}) {
  const { subvendorId } = await params;
  const supabase = await createClient();

  const { data: preview } = (await supabase
    .rpc("get_subvendor_invite_preview", { target_id: subvendorId })
    .maybeSingle()) as {
    data: {
      id: string;
      business_name: string;
      claimed: boolean;
      island_ref: string | null;
      booth_ref: string | null;
    } | null;
  };

  if (!preview) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let ownRow: {
    id: string;
    business_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
    logo_url: string | null;
  } | null = null;

  if (user) {
    const { data } = await supabase
      .from("booth_group_subvendors")
      .select("id, business_name, contact_email, contact_phone, notes, logo_path")
      .eq("id", subvendorId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const { logo_path, ...rest } = data;
      ownRow = {
        ...rest,
        logo_url: logo_path
          ? supabase.storage.from("vendor-logos").getPublicUrl(logo_path).data.publicUrl
          : null,
      };
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        {user ? null : (
          <Link href="/login" className="text-sm text-zinc-500 underline dark:text-zinc-400">
            Log in
          </Link>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <SubvendorInviteClaim
          subvendorId={subvendorId}
          preview={preview}
          isLoggedIn={Boolean(user)}
          ownRow={ownRow}
        />
      </main>
    </div>
  );
}
