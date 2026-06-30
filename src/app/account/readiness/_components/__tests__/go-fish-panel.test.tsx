'use client';

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi, beforeEach } from 'vitest';
import { GoFishPanel } from '../go-fish-panel';
import type { BacklogItem } from '@haiwave/protocol';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const OPEN_ITEM: BacklogItem = {
  backlog_item_id: 'b1',
  state: 'open',
  created_at: '2026-06-29T00:00:00Z',
  updated_at: '2026-06-29T01:00:00Z',
  audit_ref: null,
  event: {
    event_type: 'quantity_short',
    component: 'leather',
    color_code: 'TOLU-33',
    length_cm: null,
    observed: { amount: 1250, unit: 'sq_ft' },
    needed: { amount: 1500, unit: 'sq_ft' },
    severity: 'warning',
    supplier_ref: '2f4dcc8b-1234-5678-90ab-cdef01234567',
    sku_ref: 'VOMERO-IRONSTONE',
    audit_ref: null,
  },
};

/** GoFish response with one trading-pair result → shows "Initiate" button. */
const GOFISH_RESULTS = {
  query_id: 'fixed-uuid',
  query_class_ids: [],
  total_responding_vendors: 1,
  total_offerings: 1,
  resolved_at: '2026-06-29T00:00:01Z',
  results: [
    {
      rank: 1,
      participant_id: 'p1',
      participant_name: 'León Tannery',
      relationship_state: 'trading_pair' as const,
      offering: { quantity_available: 5000, lead_time_days: 14 },
      ranking_factors: {
        price_rank: 1,
        availability_rank: 1,
        shelf_age_rank: 1,
        behavioral_rank: 1,
        provenance_depth_rank: 1,
      },
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

it('open item: Initiate posts acknowledge then resolved, then calls onResolved', async () => {
  const onResolved = vi.fn();
  const fetchSpy = vi.spyOn(global, 'fetch')
    // 1. POST /gofish — initiate the search
    .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    // 2. GET /gofish/:id — poll returns resolved results immediately
    .mockResolvedValueOnce(new Response(JSON.stringify(GOFISH_RESULTS), { status: 200 }))
    // 3. POST transition → acknowledged
    .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    // 4. POST transition → resolved
    .mockResolvedValueOnce(new Response('{}', { status: 200 }));

  render(<GoFishPanel item={OPEN_ITEM} onResolved={onResolved} />);

  await userEvent.click(screen.getByRole('button', { name: /find alternative source/i }));

  // Wait for search results with an Initiate button to appear
  await waitFor(() => expect(screen.getByRole('button', { name: /initiate/i })).toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: /initiate/i }));

  // Total: 2 gofish calls + 2 transition calls
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(4));

  // Third call must be acknowledge (open → acknowledged is the legal first step)
  expect(fetchSpy).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('/api/account/readiness/backlog/b1/transition'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ to_state: 'acknowledged' }),
    }),
  );

  // Fourth call must be resolved (acknowledged → resolved)
  expect(fetchSpy).toHaveBeenNthCalledWith(
    4,
    expect.stringContaining('/api/account/readiness/backlog/b1/transition'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ to_state: 'resolved' }),
    }),
  );

  expect(onResolved).toHaveBeenCalledOnce();
});

it('acknowledged item: Initiate posts only resolved, then calls onResolved', async () => {
  const onResolved = vi.fn();
  const item: BacklogItem = { ...OPEN_ITEM, state: 'acknowledged' };

  const fetchSpy = vi.spyOn(global, 'fetch')
    .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(GOFISH_RESULTS), { status: 200 }))
    .mockResolvedValueOnce(new Response('{}', { status: 200 })); // only one transition

  render(<GoFishPanel item={item} onResolved={onResolved} />);

  await userEvent.click(screen.getByRole('button', { name: /find alternative source/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /initiate/i })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /initiate/i }));

  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));

  // Only one transition call, directly to resolved
  expect(fetchSpy).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('/api/account/readiness/backlog/b1/transition'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ to_state: 'resolved' }),
    }),
  );

  expect(onResolved).toHaveBeenCalledOnce();
});
