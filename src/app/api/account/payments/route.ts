import { withHaiCore } from "@/lib/with-hai-core";

export const GET = withHaiCore(
  async ({ client, session, request }) => {
    const type = request.nextUrl.searchParams.get("type") ?? "history";

    if (type === "manifest") {
      const manifestType = request.nextUrl.searchParams.get("manifest_type") ?? "vendor";
      return client.getPaymentManifest(session.participant.id, manifestType);
    }

    // Default: payment history
    const wallet = (await client.getWallet(session.participant.id)) as Record<string, unknown> | null;
    const address = (wallet?.address as string) ?? "";
    return client.getPaymentHistory(address);
  },
  { fallback: { payments: [], total: 0 } },
);

export const POST = withHaiCore(async ({ client, session, request }) => {
  const body = await request.json();
  // The verified session is the subject of the write; a body naming another
  // participant must not win (D-210's rule, applied at the BFF). The body may
  // still set its own effective_date.
  return client.updatePaymentManifest({
    effective_date: new Date().toISOString(),
    ...body,
    participant_id: session.participant.id,
  });
}, { role: 'account_admin' });
