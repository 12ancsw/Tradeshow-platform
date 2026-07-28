"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TermFormState = {
  error: string | null;
};

type ParsedTerm =
  | { error: string }
  | {
      error: null;
      type: string;
      content: string;
    };

function parseTermInput(formData: FormData): ParsedTerm {
  const type = String(formData.get("type") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!type) {
    return { error: "Type is required." };
  }

  if (!content) {
    return { error: "Content is required." };
  }

  return { error: null, type, content };
}

export async function createTerm(
  showId: string,
  _prevState: TermFormState,
  formData: FormData,
): Promise<TermFormState> {
  const parsed = parseTermInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("terms_and_conditions").insert({
    show_id: showId,
    type: parsed.type,
    content: parsed.content,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/terms`);
  return { error: null };
}

export async function updateTerm(
  termId: string,
  showId: string,
  _prevState: TermFormState,
  formData: FormData,
): Promise<TermFormState> {
  const parsed = parseTermInput(formData);

  if (parsed.error !== null) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("terms_and_conditions")
    .update({ type: parsed.type, content: parsed.content })
    .eq("id", termId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/terms`);
  return { error: null };
}

export async function deleteTerm(termId: string, showId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("terms_and_conditions").delete().eq("id", termId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/terms`);
  return { error: null };
}

export async function setTermPublished(
  termId: string,
  showId: string,
  publish: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("terms_and_conditions")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", termId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/shows/${showId}/terms`);
  return { error: null };
}
