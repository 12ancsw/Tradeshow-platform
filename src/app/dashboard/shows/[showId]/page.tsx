import { redirect } from "next/navigation";

export default async function ShowDetailIndexPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  redirect(`/dashboard/shows/${showId}/booth-types`);
}
