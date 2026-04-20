import { withHaiCore } from "@/lib/with-hai-core";

export const GET = withHaiCore(
  ({ client, session }) => client.getWallet(session.participant.id),
  { fallback: null },
);

export const POST = withHaiCore(async ({ client, session, request }) => {
  const body = await request.json();
  return client.registerWallet({
    participant_id: session.participant.id,
    ...body,
  });
});
