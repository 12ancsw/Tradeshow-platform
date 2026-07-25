"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PaymentProofFormState = {
  error: string | null;
};

export async function submitPaymentProof(
  applicationId: string,
  showId: string,
  _prevState: PaymentProofFormState,
  formData: FormData,
): Promise<PaymentProofFormState> {
  const file = formData.get("proof");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a payment proof file to upload." };
  }

  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return { error: "Proof must be an image or PDF." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${showId}/${applicationId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error } = await supabase.rpc("submit_payment_proof", {
    p_application_id: applicationId,
    p_proof_path: path,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard`);
  revalidatePath(`/dashboard/shows/${showId}/applications`);
  return { error: null };
}
