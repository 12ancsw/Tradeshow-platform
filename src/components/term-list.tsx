"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { updateTerm, deleteTerm, setTermPublished, type TermFormState } from "@/lib/actions/terms";

type Term = {
  id: string;
  type: string;
  content: string;
  published_at: string | null;
};

const initialState: TermFormState = { error: null };
const PREVIEW_LENGTH = 160;

function EditTermForm({
  term,
  showId,
  onDone,
}: {
  term: Term;
  showId: string;
  onDone: () => void;
}) {
  const updateForTerm = updateTerm.bind(null, term.id, showId);
  const [state, formAction, pending] = useActionState(updateForTerm, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`type-${term.id}`} className="text-sm font-medium">
          Type
        </label>
        <input
          id={`type-${term.id}`}
          name="type"
          type="text"
          required
          defaultValue={term.type}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`content-${term.id}`} className="text-sm font-medium">
          Content
        </label>
        <textarea
          id={`content-${term.id}`}
          name="content"
          required
          rows={6}
          defaultValue={term.content}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base font-medium dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteTermConfirm({
  term,
  showId,
  onCancel,
}: {
  term: Term;
  showId: string;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteTerm(term.id, showId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{`Delete "${term.type}"? This can't be undone.`}</p>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmDelete}
          disabled={isPending}
          className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base font-medium dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PublishToggle({ term, showId }: { term: Term; showId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isPublished = term.published_at !== null;

  function toggle() {
    startTransition(async () => {
      const result = await setTermPublished(term.id, showId, !isPublished);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60 ${
          isPublished
            ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
            : "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        }`}
      >
        {isPending ? "Saving…" : isPublished ? "Published — tap to unpublish" : "Draft — tap to publish"}
      </button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

export function TermList({ terms, showId }: { terms: Term[]; showId: string }) {
  const [mode, setMode] = useState<{ id: string; type: "edit" | "delete" } | null>(null);

  if (terms.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No terms & conditions yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {terms.map((term) => (
        <li
          key={term.id}
          className="flex flex-col gap-2 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          {mode?.id === term.id && mode.type === "edit" ? (
            <EditTermForm term={term} showId={showId} onDone={() => setMode(null)} />
          ) : mode?.id === term.id && mode.type === "delete" ? (
            <DeleteTermConfirm term={term} showId={showId} onCancel={() => setMode(null)} />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{term.type}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {term.content.length > PREVIEW_LENGTH
                      ? `${term.content.slice(0, PREVIEW_LENGTH)}…`
                      : term.content}
                  </span>
                  {term.published_at ? (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {`Published ${new Date(term.published_at).toLocaleDateString()}`}
                    </span>
                  ) : null}
                </span>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode({ id: term.id, type: "edit" })}
                    className="text-sm text-zinc-500 underline dark:text-zinc-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode({ id: term.id, type: "delete" })}
                    className="text-sm text-red-600 underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <PublishToggle term={term} showId={showId} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
