import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { EVENT_KIND_PILLS } from '../_lib/event-kind-pills';

/**
 * SEC-web-sonar-3-03 (haiWeb full review 2026-09-04, owner ruling R-3
 * 2026-09-05): the page turns `?kind=` into the wire filter through its pill
 * allowlist. When every requested kind is unknown to this surface (an
 * audit-side kind, a typo, a stale link) the filter used to collapse to
 * NOTHING, haiCore read "no kind" as its default and answered with the whole
 * non-gap feed — every audit-side kind on a watcher-only surface. The filter
 * must fail closed: an empty result falls back to the full pill set.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () => Promise.resolve(new Map() as unknown as Headers),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/account/sonar/posture/changes',
  useSearchParams: () => new URLSearchParams(),
}));

import ChangesPage from '../page';

function wireKinds(): string[] {
  const [path] = fetchBffJson.mock.calls[0] as [string];
  return new URL(path, 'http://bff').searchParams.getAll('kind');
}

describe('Watcher Backlog — the ?kind= filter fails closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchBffJson.mockResolvedValue({ kind: 'ok', data: { changes: [], total: 0 } });
  });

  it('forwards the full watcher pill set when the only requested kind is unknown to this surface', async () => {
    // an audit-side kind — a stale link from the Event Backlog
    render(await ChangesPage({ searchParams: Promise.resolve({ kind: 'origin_shifted_country' }) }));
    expect(wireKinds()).toEqual([...EVENT_KIND_PILLS]);
  });
});
