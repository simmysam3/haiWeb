import { withHaiCore } from "@/lib/with-hai-core";

export const GET = withHaiCore(
  ({ client, session }) => client.getWallet(session.participant.id),
  { fallback: null },
);

export const POST = withHaiCore(async ({ client, session, request }) => {
  const body = await request.json();
  // The verified session is the subject of the write; a body naming another
  // participant must not win (D-210's rule, applied at the BFF).
  return client.registerWallet({
    ...body,
    participant_id: session.participant.id,
  });
}, { role: 'account_admin' });
