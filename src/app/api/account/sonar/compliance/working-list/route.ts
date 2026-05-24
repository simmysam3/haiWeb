import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { WorkingListCategory } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/compliance/working-list
 *
 * BFF passthrough to haiCore GET /sonar/compliance/working-list.
 * Supports query params: categories (comma-separated), partner_id, status,
 * sort, page, page_size, max_age_days. Spec v1.34 Phase 5 + v.1.41
 * Backlog IA ("New (Nd)" filter on the Gaps surface).
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const categories = (sp.get('categories') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean) as WorkingListCategory[];
  const status = sp.get('status');
  const sort = sp.get('sort');
  const rawMaxAge = sp.get('max_age_days');
  const maxAge = rawMaxAge !== null ? Number(rawMaxAge) : undefined;
  return NextResponse.json(await client.listWorkingList({
    categories: categories.length ? categories : undefined,
    partner_id: sp.get('partner_id') ?? undefined,
    status: status === 'open' || status === 'snoozed' || status === 'dismissed' ? status : undefined,
    sort: sort === 'oldest_unresolved' ? 'oldest_unresolved' : sort === 'recency' ? 'recency' : undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    page_size: sp.get('page_size') ? Number(sp.get('page_size')) : undefined,
    // Forwarded as-is; haiCore clamps [1, 90] and ignores garbage.
    max_age_days: typeof maxAge === 'number' && Number.isFinite(maxAge) ? maxAge : undefined,
  }));
});
