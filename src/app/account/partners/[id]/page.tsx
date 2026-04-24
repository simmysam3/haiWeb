import { redirect } from "next/navigation";

export default async function PartnerDetailLanding({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/account/partners/${id}/catalog`);
}
