import { PaymentProofForm } from "@/components/payment-proof-form";

type Application = {
  id: string;
  showId: string;
  showName: string;
  showPaymentInstructions: string | null;
  phaseName: string;
  status: string;
  isSelfSelected: boolean;
  paymentStatus: string;
  amount: number;
  proofUrl: string | null;
  paymentNotes: string | null;
  boothRefs: string[];
  islandRef: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted — awaiting allocation",
  allocated: "Allocated — payment due",
  payment_pending: "Payment submitted — awaiting verification",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function MyApplications({ applications }: { applications: Application[] }) {
  if (applications.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No applications yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {applications.map((application) => (
        <li
          key={application.id}
          className="flex flex-col gap-2 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          <span className="flex flex-col">
            <span className="font-medium">{application.showName}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {`${application.phaseName} · ${STATUS_LABELS[application.status] ?? application.status}`}
            </span>
          </span>

          {application.islandRef ? (
            <p className="text-sm">{`Island: ${application.islandRef}`}</p>
          ) : application.boothRefs.length > 0 ? (
            <p className="text-sm">{`Booths: ${application.boothRefs.join(", ")}`}</p>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Not yet allocated.</p>
          )}

          <p className="text-sm">{`Amount due: $${application.amount.toFixed(2)}`}</p>

          {application.status === "allocated" || application.status === "payment_pending" ? (
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              {application.showPaymentInstructions ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {application.showPaymentInstructions}
                </p>
              ) : null}
              {application.proofUrl ? (
                <a
                  href={application.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-zinc-500 underline dark:text-zinc-400"
                >
                  View your submitted proof
                </a>
              ) : null}
              <PaymentProofForm
                applicationId={application.id}
                showId={application.showId}
                alreadySubmitted={application.paymentStatus !== "awaiting_proof"}
              />
            </div>
          ) : null}

          {application.status === "rejected" && application.paymentNotes ? (
            <p className="text-sm text-red-600 dark:text-red-400">{application.paymentNotes}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
