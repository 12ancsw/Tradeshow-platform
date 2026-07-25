import { createClient } from "@/lib/supabase/server";
import { ShowEditForm } from "@/components/show-edit-form";
import { ShowLogoUploadForm } from "@/components/show-logo-upload-form";

export default async function ShowDetailsPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const { data: show } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date, venue_name, payment_instructions, logo_path")
    .eq("id", showId)
    .single();

  if (!show) {
    return null;
  }

  const logoUrl = show.logo_path
    ? supabase.storage.from("show-logos").getPublicUrl(show.logo_path).data.publicUrl
    : null;

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Show Details</h2>
        <ShowEditForm show={show} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Show Logo</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Shown on your dashboard, every show management tab, and the vendor-facing show page.
        </p>
        <ShowLogoUploadForm showId={showId} logoUrl={logoUrl} />
      </section>
    </>
  );
}
