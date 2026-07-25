import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  let connected = false;
  let timestamp: string | null = null;
  let errorMessage: string | null = null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_server_time");

    if (error) throw error;

    connected = true;
    timestamp = data as string;
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unknown error connecting to Supabase.";
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="text-xl font-semibold sm:text-2xl">Tradeshow Platform</h1>

      {connected ? (
        <div className="w-full max-w-sm rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <p className="font-medium text-green-700 dark:text-green-400">
            Connected to Supabase
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {timestamp ? new Date(timestamp).toLocaleString() : null}
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="font-medium text-red-700 dark:text-red-400">
            Failed to connect to Supabase
          </p>
          <p className="mt-1 break-words text-sm text-zinc-500 dark:text-zinc-400">
            {errorMessage}
          </p>
        </div>
      )}
    </main>
  );
}
