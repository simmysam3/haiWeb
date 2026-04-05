import { withHaiCore } from "@/lib/with-hai-core";

export const GET = withHaiCore(
  ({ client, session }) => client.getSpendingPolicy(session.participant.id),
  { fallback: null },
);

export const POST = withHaiCore(async ({ client, session, request }) => {
  const body = await request.json();
  return client.updateSpendingPolicy({
    participant_id: session.participant.id,
    ...body,
  });
});
