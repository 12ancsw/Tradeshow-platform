import { redirect } from "next/navigation";
import { getCurrentUserWithRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { HomeContent } from "./home-content";

export default async function DashboardPage() {
  const current = await getCurrentUserWithRoles();

  if (!current) {
    redirect("/login");
  }

  const supabase = await createClient();
  const isPlatformAdmin = current.roles.some((role) => role.role === "platform_admin");
  const isVendor = current.roles.some((role) => role.role === "vendor");
  const organiserStaffIds = current.roles
    .filter((role) => role.role === "organiser_staff" && role.organiser_id)
    .map((role) => role.organiser_id as string);

  const [organisersResult, organiserStaffData, applicationsResult] = await Promise.all([
    isPlatformAdmin
      ? supabase
          .from("organisers")
          .select("id, name, slug, status")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    Promise.all(
      organiserStaffIds.map(async (organiserId) => {
        const [{ data: organiser }, { data: shows }] = await Promise.all([
          supabase.from("organisers").select("id, name, slug, status").eq("id", organiserId).single(),
          supabase
            .from("shows")
            .select("id, name, start_date, end_date, venue_name")
            .eq("organiser_id", organiserId)
            .order("start_date", { ascending: true }),
        ]);

        return { organiserId, organiser, shows: shows ?? [] };
      }),
    ),
    isVendor
      ? supabase
          .from("applications")
          .select("id, show_id, release_phase_id, status")
          .eq("applicant_user_id", current.user.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const rawApplications = applicationsResult.data ?? [];
  const applicationIds = rawApplications.map((application) => application.id);
  const showIds = [...new Set(rawApplications.map((application) => application.show_id))];
  const phaseIds = [...new Set(rawApplications.map((application) => application.release_phase_id))];

  const [showsResult, phasesResult, paymentsResult, boothsResult, boothGroupsResult] =
    await Promise.all([
      showIds.length > 0
        ? supabase.from("shows").select("id, name, payment_instructions").in("id", showIds)
        : Promise.resolve({ data: [] }),
      phaseIds.length > 0
        ? supabase.from("release_phases").select("id, name").in("id", phaseIds)
        : Promise.resolve({ data: [] }),
      applicationIds.length > 0
        ? supabase
            .from("payment_records")
            .select("application_id, amount, status, proof_path, notes")
            .in("application_id", applicationIds)
        : Promise.resolve({ data: [] }),
      applicationIds.length > 0
        ? supabase
            .from("booths")
            .select("application_id, organiser_ref")
            .in("application_id", applicationIds)
        : Promise.resolve({ data: [] }),
      applicationIds.length > 0
        ? supabase
            .from("booth_groups")
            .select("application_id, organiser_ref")
            .in("application_id", applicationIds)
        : Promise.resolve({ data: [] }),
    ]);

  const showById = new Map((showsResult.data ?? []).map((show) => [show.id, show]));
  const phaseById = new Map((phasesResult.data ?? []).map((phase) => [phase.id, phase]));
  const paymentByApplicationId = new Map(
    (paymentsResult.data ?? []).map((payment) => [payment.application_id, payment]),
  );

  const boothRefsByApplicationId = new Map<string, string[]>();
  for (const booth of boothsResult.data ?? []) {
    if (!booth.application_id) continue;
    const refs = boothRefsByApplicationId.get(booth.application_id) ?? [];
    refs.push(booth.organiser_ref);
    boothRefsByApplicationId.set(booth.application_id, refs);
  }

  const islandRefByApplicationId = new Map(
    (boothGroupsResult.data ?? [])
      .filter((group) => group.application_id)
      .map((group) => [group.application_id as string, group.organiser_ref]),
  );

  const myApplications = await Promise.all(
    rawApplications.map(async (application) => {
      const payment = paymentByApplicationId.get(application.id);
      const proofUrl = payment?.proof_path
        ? (
            await supabase.storage
              .from("payment-proofs")
              .createSignedUrl(payment.proof_path, 60 * 60)
          ).data?.signedUrl ?? null
        : null;

      return {
        id: application.id,
        showId: application.show_id,
        showName: showById.get(application.show_id)?.name ?? "Unknown show",
        showPaymentInstructions: showById.get(application.show_id)?.payment_instructions ?? null,
        phaseName: phaseById.get(application.release_phase_id)?.name ?? "Unknown phase",
        status: application.status,
        isSelfSelected: false,
        paymentStatus: payment?.status ?? "awaiting_proof",
        amount: Number(payment?.amount ?? 0),
        proofUrl,
        paymentNotes: payment?.notes ?? null,
        boothRefs: boothRefsByApplicationId.get(application.id) ?? [],
        islandRef: islandRefByApplicationId.get(application.id) ?? null,
      };
    }),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Tradeshow Platform</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-500 underline dark:text-zinc-400"
          >
            Log out
          </button>
        </form>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <HomeContent
          name={current.name ?? current.user.email ?? "there"}
          roles={current.roles}
          allOrganisers={organisersResult.data ?? undefined}
          organiserStaffData={organiserStaffData}
          myApplications={myApplications}
        />
      </main>
    </div>
  );
}
