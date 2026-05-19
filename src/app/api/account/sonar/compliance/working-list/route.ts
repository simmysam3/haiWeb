import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { WorkingListCategory } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/compliance/working-list
 *
 * BFF passthrough to haiCore GET /sonar/compliance/working-list.
 * Supports query params: categories (comma-separated), partner_id, status, sort, page, page_size.
 * Spec v1.34 Phase 5.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const categories = (sp.get('categories') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean) as WorkingListCategory[];
  const status = sp.get('status');
  const sort = sp.get('sort');
  return NextResponse.json(await client.listWorkingList({
    categories: categories.length ? categories : undefined,
    partner_id: sp.get('partner_id') ?? undefined,
    status: status === 'open' || status === 'snoozed' || status === 'dismissed' ? status : undefined,
    sort: sort === 'oldest_unresolved' ? 'oldest_unresolved' : sort === 'recency' ? 'recency' : undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    page_size: sp.get('page_size') ? Number(sp.get('page_size')) : undefined,
  }));
});
