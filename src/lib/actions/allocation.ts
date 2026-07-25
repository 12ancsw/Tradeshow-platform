"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function allocateBoothsToApplication(
  applicationId: string,
  showId: string,
  boothIds: string[],
): Promise<{ error: string | null }> {
  if (boothIds.length === 0) {
    return { error: "Choose at least one booth to allocate." };
  }

  const supabase = await createClient();

  const { error: boothsError } = await supabase
    .from("booths")
    .update({ application_id: applicationId, status: "held" })
    .in("id", boothIds)
    .eq("status", "available");

  if (boothsError) {
    return { error: boothsError.message };
  }

  const { error: applicationError } = await supabase
    .from("applications")
    .update({ status: "allocated" })
    .eq("id", applicationId);

  if (applicationError) {
    return { error: applicationError.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/applications`);
  revalidatePath(`/dashboard/shows/${showId}/booths`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  return { error: null };
}

export async function allocateIslandToApplication(
  applicationId: string,
  showId: string,
  islandId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error: islandError } = await supabase
    .from("booth_groups")
    .update({ application_id: applicationId, status: "held" })
    .eq("id", islandId)
    .eq("status", "available");

  if (islandError) {
    return { error: islandError.message };
  }

  const { error: applicationError } = await supabase
    .from("applications")
    .update({ status: "allocated" })
    .eq("id", applicationId);

  if (applicationError) {
    return { error: applicationError.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/applications`);
  revalidatePath(`/dashboard/shows/${showId}/islands`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  return { error: null };
}

export async function verifyPayment(
  applicationId: string,
  showId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { error: paymentError } = await supabase
    .from("payment_records")
    .update({ status: "verified", verified_by: user.id, verified_at: new Date().toISOString() })
    .eq("application_id", applicationId);

  if (paymentError) {
    return { error: paymentError.message };
  }

  const { error: applicationError } = await supabase
    .from("applications")
    .update({ status: "confirmed" })
    .eq("id", applicationId);

  if (applicationError) {
    return { error: applicationError.message };
  }

  await supabase
    .from("booths")
    .update({ status: "confirmed" })
    .eq("application_id", applicationId);

  await supabase
    .from("booth_groups")
    .update({ status: "confirmed" })
    .eq("application_id", applicationId);

  revalidatePath(`/dashboard/shows/${showId}/applications`);
  revalidatePath(`/dashboard/shows/${showId}/booths`);
  revalidatePath(`/dashboard/shows/${showId}/islands`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  revalidatePath(`/dashboard`);
  return { error: null };
}

export async function rejectPayment(
  applicationId: string,
  showId: string,
  notes: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error: paymentError } = await supabase
    .from("payment_records")
    .update({ status: "rejected", notes: notes || null })
    .eq("application_id", applicationId);

  if (paymentError) {
    return { error: paymentError.message };
  }

  const { error: applicationError } = await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("id", applicationId);

  if (applicationError) {
    return { error: applicationError.message };
  }

  // Release whatever was held for this application back into the pool
  // rather than leaving it stranded on a rejected application.
  await supabase
    .from("booths")
    .update({ application_id: null, status: "available" })
    .eq("application_id", applicationId);

  await supabase
    .from("booth_groups")
    .update({ application_id: null, status: "available" })
    .eq("application_id", applicationId);

  revalidatePath(`/dashboard/shows/${showId}/applications`);
  revalidatePath(`/dashboard/shows/${showId}/booths`);
  revalidatePath(`/dashboard/shows/${showId}/islands`);
  revalidatePath(`/dashboard/shows/${showId}/floorplan`);
  revalidatePath(`/dashboard`);
  return { error: null };
}
