import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { ComplianceChangeKind } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/compliance/changes
 *
 * BFF passthrough to haiCore GET /sonar/compliance/changes.
 * Supports query params: kind (repeatable), partner, from, to.
 * Spec v1.34 Phase 4.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const kind = sp.getAll('kind') as ComplianceChangeKind[];
  return NextResponse.json(await client.listComplianceChanges({
    kind: kind.length ? kind : undefined,
    partner: sp.get('partner') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
  }));
});
