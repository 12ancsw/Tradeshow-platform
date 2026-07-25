"use client";

import { useState, useTransition } from "react";
import {
  allocateBoothsToApplication,
  allocateIslandToApplication,
  verifyPayment,
  rejectPayment,
} from "@/lib/actions/allocation";

type BoothRequest = { boothTypeId: string; boothTypeName: string; quantity: number };
type AvailableBooth = { id: string; organiser_ref: string; boothTypeId: string };
type AvailableIsland = { id: string; organiser_ref: string; islandTypeId: string };

type PendingApplication = {
  id: string;
  applicantLabel: string;
  boothRequests: BoothRequest[];
  islandTypeId: string | null;
  islandTypeName: string | null;
};

type QueuedPayment = {
  applicationId: string;
  applicantLabel: string;
  amount: number;
  proofUrl: string | null;
  boothRefs: string[];
  islandRef: string | null;
};

function AllocationCard({
  application,
  showId,
  availableBooths,
  availableIslands,
}: {
  application: PendingApplication;
  showId: string;
  availableBooths: AvailableBooth[];
  availableIslands: AvailableIsland[];
}) {
  const [selectedByType, setSelectedByType] = useState<Record<string, string[]>>({});
  const [selectedIslandId, setSelectedIslandId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleBooth(boothTypeId: string, boothId: string, max: number) {
    setSelectedByType((prev) => {
      const current = prev[boothTypeId] ?? [];
      if (current.includes(boothId)) {
        return { ...prev, [boothTypeId]: current.filter((id) => id !== boothId) };
      }
      if (current.length >= max) return prev;
      return { ...prev, [boothTypeId]: [...current, boothId] };
    });
  }

  function confirmAllocation() {
    startTransition(async () => {
      const result = application.islandTypeId
        ? await allocateIslandToApplication(application.id, showId, selectedIslandId)
        : await allocateBoothsToApplication(
            application.id,
            showId,
            Object.values(selectedByType).flat(),
          );
      if (result.error) {
        setError(result.error);
      }
    });
  }

  const totalSelected = Object.values(selectedByType).flat().length;
  const totalRequested = application.boothRequests.reduce((sum, r) => sum + r.quantity, 0);
  const canConfirm = application.islandTypeId
    ? Boolean(selectedIslandId)
    : totalSelected === totalRequested && totalRequested > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <span className="font-medium">{application.applicantLabel}</span>

      {application.islandTypeId ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{`Island type: ${application.islandTypeName}`}</label>
          <select
            value={selectedIslandId}
            onChange={(event) => setSelectedIslandId(event.target.value)}
            className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Choose an island…</option>
            {availableIslands
              .filter((island) => island.islandTypeId === application.islandTypeId)
              .map((island) => (
                <option key={island.id} value={island.id}>
                  {island.organiser_ref}
                </option>
              ))}
          </select>
        </div>
      ) : (
        application.boothRequests.map((request) => {
          const options = availableBooths.filter(
            (booth) => booth.boothTypeId === request.boothTypeId,
          );
          const selected = selectedByType[request.boothTypeId] ?? [];
          return (
            <div key={request.boothTypeId} className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {`${request.boothTypeName} — pick ${request.quantity} (${selected.length}/${request.quantity})`}
              </span>
              <div className="flex flex-col gap-1">
                {options.map((booth) => (
                  <label key={booth.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(booth.id)}
                      disabled={
                        !selected.includes(booth.id) && selected.length >= request.quantity
                      }
                      onChange={() => toggleBooth(request.boothTypeId, booth.id, request.quantity)}
                      className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                    />
                    {booth.organiser_ref}
                  </label>
                ))}
              </div>
            </div>
          );
        })
      )}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="button"
        onClick={confirmAllocation}
        disabled={!canConfirm || isPending}
        className="w-full rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isPending ? "Allocating…" : "Confirm Allocation"}
      </button>
    </div>
  );
}

function PaymentQueueCard({ payment, showId }: { payment: QueuedPayment; showId: string }) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function verify() {
    startTransition(async () => {
      const result = await verifyPayment(payment.applicationId, showId);
      if (result.error) setError(result.error);
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectPayment(payment.applicationId, showId, notes);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <span className="font-medium">{payment.applicantLabel}</span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        {payment.islandRef
          ? `Island: ${payment.islandRef}`
          : `Booths: ${payment.boothRefs.join(", ")}`}
      </span>
      <span className="text-sm">{`Amount: $${payment.amount.toFixed(2)}`}</span>
      {payment.proofUrl ? (
        <a
          href={payment.proofUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-zinc-500 underline dark:text-zinc-400"
        >
          View proof
        </a>
      ) : null}
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Rejection note (optional)"
        rows={2}
        className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={verify}
          disabled={isPending}
          className="flex-1 rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          Verify
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={isPending}
          className="flex-1 rounded-lg border border-red-600 px-4 py-3 text-base font-medium text-red-600 disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export function ApplicationReview({
  showId,
  pendingApplications,
  queuedPayments,
  availableBooths,
  availableIslands,
}: {
  showId: string;
  pendingApplications: PendingApplication[];
  queuedPayments: QueuedPayment[];
  availableBooths: AvailableBooth[];
  availableIslands: AvailableIsland[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Awaiting Allocation</h3>
        {pendingApplications.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing to allocate.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingApplications.map((application) => (
              <AllocationCard
                key={application.id}
                application={application}
                showId={showId}
                availableBooths={availableBooths}
                availableIslands={availableIslands}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Payment Verification Queue</h3>
        {queuedPayments.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing to verify.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {queuedPayments.map((payment) => (
              <PaymentQueueCard key={payment.applicationId} payment={payment} showId={showId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
