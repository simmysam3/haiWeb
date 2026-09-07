import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { EVENT_KIND_PILLS } from '../_lib/event-kind-pills';

/**
 * SEC-web-sonar-3-03 (owner ruling R-3, 2026-09-05) — the Event Backlog has
 * the same allowlist shape as the Watcher Backlog: an all-unknown `?kind=`
 * used to forward NO kind, which haiCore reads as "no filter" and answers
 * with the whole non-gap feed, lead-time rows included on this audit-only
 * surface. The filter must fail closed to the full audit pill set.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));
vi.mock('../../_lib/has-audit-scopes', () => ({ hasAuditScopes: () => Promise.resolve(true) }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () => Promise.resolve(new Map() as unknown as Headers),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/account/sonar/audit/events',
  useSearchParams: () => new URLSearchParams(),
}));

import ChangesPage from '../page';

function wireKinds(): string[] {
  const [path] = fetchBffJson.mock.calls[0] as [string];
  return new URL(path, 'http://bff').searchParams.getAll('kind');
}

describe('Event Backlog — the ?kind= filter fails closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchBffJson.mockResolvedValue({ kind: 'ok', data: { changes: [], total: 0 } });
  });

  it('forwards the full audit pill set when the only requested kind is unknown to this surface', async () => {
    // a watcher-side kind — a stale link from the Watcher Backlog
    render(await ChangesPage({ searchParams: Promise.resolve({ kind: 'lead_time_degraded' }) }));
    expect(wireKinds()).toEqual([...EVENT_KIND_PILLS]);
  });
});
