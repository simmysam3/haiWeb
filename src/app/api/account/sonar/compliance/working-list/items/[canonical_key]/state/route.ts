import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * PUT /api/account/sonar/compliance/working-list/items/[canonical_key]/state
 *
 * BFF passthrough to haiCore PUT /sonar/compliance/working-list/items/:key/state.
 * Transitions a working list item state (open/snoozed/dismissed).
 * Spec v1.34 Phase 5.
 */
export const PUT = withHaiCore<{ canonical_key: string }>(async ({ client, request, params }) => {
  const body = (await request.json()) as {
    state: 'open' | 'snoozed' | 'dismissed';
    snooze_until?: string;
    dismiss_reason?: string;
  };
  return NextResponse.json(
    await client.transitionWorkingListItem(params.canonical_key, body),
  );
});
