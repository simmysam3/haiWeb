import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/settings/trust-posture — return the caller's full
 * 4 trust-classes × 3 modalities posture grid (12 rows). v1.30 PR-3 BFF
 * passthrough; haiCore enforces self-scope (participantId in the path
 * must match the JWT subject).
 */
export const GET = withHaiCore(async ({ client, session }) => {
  return NextResponse.json(
    await client.getModalityPosture(session.participant.id),
  );
});
