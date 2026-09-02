import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * v1.85 — the watcher definition page reads `?tab=` and opens on that tab.
 * Fetch order the page issues: 1. definition detail, 2. runs list.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () => Promise.resolve(new Map([['host', 'localhost:3001']]) as unknown as Headers),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/account/sonar/watchers/definitions/t-1',
  notFound: vi.fn(),
}));

// The scope picker fetches partner/catalog data on mount; it is not under test.
vi.mock('../../../new/_components/watcher-scope-picker', () => ({
  WatcherScopePicker: () => <div data-testid="watcher-scope-picker" />,
}));

const template = {
  template_id: 't-1',
  template_name: 'Acme lead-time watch',
  observation_class: 'watcher',
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 90,
  created_at: '2026-05-08T12:00:00.000Z',
  last_run_at: null,
  scope: {
    kind: 'watcher',
    authorization_basis: 'bilateral',
    counterparties: ['acme-corp'],
    signal_types: ['lead_time_distribution'],
    skus: [],
    depth_limit: 1,
  },
};

beforeEach(() => {
  fetchBffJson.mockReset();
  fetchBffJson
    .mockResolvedValueOnce({ kind: 'ok', data: { template } })
    .mockResolvedValueOnce({ kind: 'ok', data: { runs: [] } });
  // Client-side SWR polling inside the history table.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ runs: [] }) }) as Response),
  );
});

async function renderPage(tab?: string) {
  const Page = (await import('../page')).default;
  const el = await Page({
    params: Promise.resolve({ template_id: 't-1' }),
    searchParams: Promise.resolve(tab ? { tab } : {}),
  });
  render(el as React.ReactElement);
}

describe('WatcherDefinitionPage tabs', () => {
  it('opens on Run history when the URL carries no tab', async () => {
    await renderPage();
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Run history' })).toBeVisible();
  });

  it('opens on Configuration for ?tab=configuration, with the editor visible', async () => {
    await renderPage('configuration');
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeVisible();
    // The runs panel is `hidden`, so ask for hidden nodes explicitly.
    expect(screen.getByRole('heading', { name: 'Run history', hidden: true })).not.toBeVisible();
  });

  it('falls back to Run history for an unknown tab value', async () => {
    await renderPage('bogus');
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
  });
});
