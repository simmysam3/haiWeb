import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { ComplianceChangeKind } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/compliance/changes
 *
 * BFF passthrough to haiCore GET /sonar/compliance/changes.
 * Supports query params: kind (repeatable), partner, from, to, limit, offset.
 * Spec v1.34 Phase 4; pagination added v.1.41 (PR-C).
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const kind = sp.getAll('kind') as ComplianceChangeKind[];
  const limitRaw = sp.get('limit');
  const offsetRaw = sp.get('offset');
  const limit = limitRaw !== null ? Number(limitRaw) : undefined;
  const offset = offsetRaw !== null ? Number(offsetRaw) : undefined;
  return NextResponse.json(await client.listComplianceChanges({
    kind: kind.length ? kind : undefined,
    partner: sp.get('partner') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    limit: limit !== undefined && Number.isFinite(limit) ? limit : undefined,
    offset: offset !== undefined && Number.isFinite(offset) ? offset : undefined,
  }));
});
