import { createClient } from "@/lib/supabase/server";
import { ApplicationReview } from "@/components/application-review";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const supabase = await createClient();

  const [
    { data: boothTypes },
    { data: islandTypes },
    { data: booths },
    { data: boothGroups },
    { data: pendingApps },
    { data: paymentQueue },
  ] = await Promise.all([
    supabase.from("booth_types").select("id, name, category").eq("show_id", showId),
    supabase.from("island_types").select("id, name").eq("show_id", showId),
    supabase
      .from("booths")
      .select("id, organiser_ref, booth_type_id, status, map_x, application_id")
      .eq("show_id", showId),
    supabase
      .from("booth_groups")
      .select("id, organiser_ref, island_type_id, status, map_x, application_id")
      .eq("show_id", showId),
    supabase
      .from("applications")
      .select("id, applicant_user_id, requested_island_type_id")
      .eq("show_id", showId)
      .eq("status", "submitted"),
    supabase
      .from("payment_records")
      .select("application_id, amount, proof_path")
      .eq("show_id", showId)
      .eq("status", "proof_submitted"),
  ]);

  const boothTypeById = new Map((boothTypes ?? []).map((type) => [type.id, type]));
  const islandTypeById = new Map((islandTypes ?? []).map((type) => [type.id, type]));

  const availableBooths = (booths ?? [])
    .filter((booth) => booth.status === "available" && booth.map_x !== null)
    .filter((booth) => boothTypeById.get(booth.booth_type_id)?.category !== "island")
    .map((booth) => ({
      id: booth.id,
      organiser_ref: booth.organiser_ref,
      boothTypeId: booth.booth_type_id,
    }));

  const availableIslands = (boothGroups ?? [])
    .filter((group) => group.status === "available" && group.map_x !== null)
    .map((group) => ({
      id: group.id,
      organiser_ref: group.organiser_ref,
      islandTypeId: group.island_type_id as string,
    }));

  const pendingIds = (pendingApps ?? []).map((app) => app.id);
  const paymentApplicationIds = (paymentQueue ?? []).map((payment) => payment.application_id);

  const [{ data: boothRequests }, { data: paymentApps }] = await Promise.all([
    pendingIds.length > 0
      ? supabase
          .from("application_booth_requests")
          .select("application_id, booth_type_id, quantity")
          .in("application_id", pendingIds)
      : Promise.resolve({ data: [] }),
    paymentApplicationIds.length > 0
      ? supabase
          .from("applications")
          .select("id, applicant_user_id")
          .in("id", paymentApplicationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const userIds = [
    ...new Set([
      ...(pendingApps ?? []).map((app) => app.applicant_user_id),
      ...(paymentApps ?? []).map((app) => app.applicant_user_id),
    ]),
  ];

  const { data: users } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, email").in("id", userIds)
      : { data: [] };

  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  const pendingApplications = (pendingApps ?? []).map((app) => {
    const requests = (boothRequests ?? [])
      .filter((request) => request.application_id === app.id)
      .map((request) => ({
        boothTypeId: request.booth_type_id,
        boothTypeName: boothTypeById.get(request.booth_type_id)?.name ?? "Unknown type",
        quantity: request.quantity,
      }));
    const applicant = userById.get(app.applicant_user_id);

    return {
      id: app.id,
      applicantLabel: applicant?.name || applicant?.email || "Unknown applicant",
      boothRequests: requests,
      islandTypeId: app.requested_island_type_id,
      islandTypeName: app.requested_island_type_id
        ? (islandTypeById.get(app.requested_island_type_id)?.name ?? "Unknown type")
        : null,
    };
  });

  const paymentAppById = new Map((paymentApps ?? []).map((app) => [app.id, app]));

  const queuedPayments = await Promise.all(
    (paymentQueue ?? []).map(async (payment) => {
      const app = paymentAppById.get(payment.application_id);
      const applicant = app ? userById.get(app.applicant_user_id) : undefined;
      const proofUrl = payment.proof_path
        ? (
            await supabase.storage
              .from("payment-proofs")
              .createSignedUrl(payment.proof_path, 60 * 60)
          ).data?.signedUrl ?? null
        : null;
      const boothRefs = (booths ?? [])
        .filter((booth) => booth.application_id === payment.application_id)
        .map((booth) => booth.organiser_ref);
      const islandRef = (boothGroups ?? []).find(
        (group) => group.application_id === payment.application_id,
      )?.organiser_ref;

      return {
        applicationId: payment.application_id,
        applicantLabel: applicant?.name || applicant?.email || "Unknown applicant",
        amount: Number(payment.amount),
        proofUrl,
        boothRefs,
        islandRef: islandRef ?? null,
      };
    }),
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Applications</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Organiser-assigned applications waiting for specific booths/an island, and payment proofs
        waiting to be verified.
      </p>

      <ApplicationReview
        showId={showId}
        pendingApplications={pendingApplications}
        queuedPayments={queuedPayments}
        availableBooths={availableBooths}
        availableIslands={availableIslands}
      />
    </section>
  );
}
