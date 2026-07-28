import { createClient } from "@/lib/supabase/server";
import { TermList } from "@/components/term-list";
import { TermForm } from "@/components/term-form";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const { data: terms } = await supabase
    .from("terms_and_conditions")
    .select("id, type, content, published_at")
    .eq("show_id", showId)
    .order("created_at", { ascending: true });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Terms & Conditions</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {`Define terms for this show, grouped under whatever type you need (e.g. "Vendor Terms", "Attendee Terms"). Publishing doesn't do anything yet on its own — this is where future vendor/attendee application flows will pull terms from once that's built.`}
      </p>

      <TermList terms={terms ?? []} showId={showId} />

      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="font-medium">Add Terms</h3>
        <TermForm showId={showId} />
      </div>
    </section>
  );
}
