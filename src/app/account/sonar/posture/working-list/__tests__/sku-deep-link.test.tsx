import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FetchResult } from '@/lib/server-fetch';
import type { WorkingListResponse, WorkingListItem } from '@haiwave/protocol';
import { filterBySku } from '../page';

/**
 * v1.37 follow-up #2 — SKU global-search deep-link.
 * Verifies that visiting /account/sonar/posture/working-list?sku=<id> filters
 * the rendered list to items whose subject embeds the SKU identifier and that
 * the dismissible SKU chip is surfaced in the filter row.
 *
 * Filter happens client-side in HaiWeb because the haiCore feed has no
 * product_id parameter and WorkingListItem has no dedicated product_id field.
 * Subject is the only carrier — embeds `auditRunResults.productId` for gap
 * items and `sku_obligations.sku_label` for nominations/obligations.
 */

function item(over: { canonical_key: string; subject: string } & Partial<WorkingListItem>): WorkingListItem {
  const { canonical_key, subject, ...rest } = over;
  return {
    canonical_key: canonical_key.padEnd(64, '0'),
    category: 'gap',
    subject,
    reason: 'r',
    item_event_time: '2026-05-20T00:00:00.000Z',
    partner_id: null,
    partner_legal_name: null,
    action_href: '/x',
    state: 'open',
    snooze_until: null,
    dismiss_reason: null,
    last_transitioned_at: null,
    dismissed_by_user: null,
    ...rest,
  };
}

function okResult(items: WorkingListItem[]): FetchResult<WorkingListResponse> {
  return { kind: 'ok', data: { items, total: items.length } };
}

describe('filterBySku (sku deep-link plumbing)', () => {
  it('passes through when sku param is empty', () => {
    const r = okResult([item({ canonical_key: 'a', subject: 'foo' })]);
    expect(filterBySku(r, '')).toBe(r);
  });

  it('passes through when sku is whitespace-only', () => {
    const r = okResult([item({ canonical_key: 'a', subject: 'foo' })]);
    expect(filterBySku(r, '   ')).toBe(r);
  });

  it('filters to items whose subject contains the sku (case-insensitive)', () => {
    const r = okResult([
      item({ canonical_key: 'a', subject: 'v1 · PROD-42 — origin_missing gap' }),
      item({ canonical_key: 'b', subject: 'v2 · PROD-99 — origin_missing gap' }),
      item({ canonical_key: 'c', subject: 'Nomination · PROD-42 → resp1' }),
    ]);
    const out = filterBySku(r, 'prod-42');
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect(out.data.items.map((i) => i.canonical_key.replace(/0+$/, ''))).toEqual(['a', 'c']);
    expect(out.data.total).toBe(2);
  });

  it('returns zero items + total=0 when nothing matches', () => {
    const r = okResult([item({ canonical_key: 'a', subject: 'PROD-1' })]);
    const out = filterBySku(r, 'PROD-9');
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect(out.data.items).toHaveLength(0);
    expect(out.data.total).toBe(0);
  });

  it('does not prefix-match adjacent SKU codes (PROD-1 must not match PROD-10)', () => {
    const r = okResult([
      item({ canonical_key: 'a', subject: 'v1 · PROD-1 — origin_missing gap' }),
      item({ canonical_key: 'b', subject: 'v1 · PROD-10 — origin_missing gap' }),
      item({ canonical_key: 'c', subject: 'v1 · PROD-12 — origin_missing gap' }),
      item({ canonical_key: 'd', subject: 'Nomination · PROD-1 → resp1' }),
    ]);
    const out = filterBySku(r, 'PROD-1');
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect(out.data.items.map((i) => i.canonical_key.replace(/0+$/, ''))).toEqual(['a', 'd']);
    expect(out.data.total).toBe(2);
  });

  it('passes through error results untouched', () => {
    const err: FetchResult<WorkingListResponse> = { kind: 'error', status: 503, message: 'down' };
    expect(filterBySku(err, 'PROD-1')).toBe(err);
  });
});

// ---------------------------------------------------------------------------
// FilterPills SKU chip
// ---------------------------------------------------------------------------

const pushMock = vi.fn();
let currentSearch = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/account/sonar/posture/working-list',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { FilterPills } from '../filter-pills';

describe('FilterPills SKU chip', () => {
  it('does not render the SKU chip when ?sku= is absent', () => {
    currentSearch = '';
    render(<FilterPills />);
    expect(screen.queryByText(/Filtered to SKU/i)).not.toBeInTheDocument();
  });

  it('renders a dismissible SKU chip when ?sku= is in the URL', () => {
    currentSearch = 'sku=PROD-42';
    render(<FilterPills />);
    expect(screen.getByText(/Filtered to SKU/i)).toBeInTheDocument();
    expect(screen.getByText('PROD-42')).toBeInTheDocument();
  });

  it('clearing the SKU chip routes to the pathname with sku removed', () => {
    currentSearch = 'sku=PROD-42&categories=gap';
    pushMock.mockReset();
    render(<FilterPills />);
    fireEvent.click(screen.getByRole('button', { name: /clear sku filter/i }));
    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushed = pushMock.mock.calls[0][0] as string;
    expect(pushed).not.toContain('sku=');
    expect(pushed).toContain('categories=gap');
  });

  it('clearing the only param routes to the bare pathname (no trailing ?)', () => {
    currentSearch = 'sku=PROD-42';
    pushMock.mockReset();
    render(<FilterPills />);
    fireEvent.click(screen.getByRole('button', { name: /clear sku filter/i }));
    expect(pushMock).toHaveBeenCalledWith('/account/sonar/posture/working-list');
  });
});
