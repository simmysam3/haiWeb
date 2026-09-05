import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * v1.85 — parity with the watcher page: the audit definition page shows this
 * audit's Run history and its Configuration as two tabs, selected by `?tab=`.
 * The BFF fake serves a foreign run on the UNFILTERED runs URL, so a page that
 * forgets `?template_id=` renders a row it must not.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () => Promise.resolve(new Map([['host', 'localhost:3001']]) as unknown as Headers),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/account/sonar/audit/definitions/a-1',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));

const template = {
  template_id: 'a-1',
  template_name: 'Weekly EMEA Audit',
  observation_class: 'audit',
  cadence: { kind: 'weekly', day_of_week: 'mon', time_of_day: '06:00' },
  enabled: true,
  retention_days: 90,
  created_at: '2026-05-08T12:00:00.000Z',
  last_run_at: null,
  scope: {
    kind: 'audit',
    authorization_basis: 'bilateral',
    counterparties: ['acme-corp'],
    signal_types: [],
    skus: [],
    depth_limit: 3,
  },
};

function run(id: string, templateId: string, templateName: string) {
  return {
    run_id: id,
    initiator_participant_id: 'p-1',
    triggered_at: '2026-09-01T10:00:00.000Z',
    triggered_by_user_id: null,
    scope_snapshot: { depth_limit: 3, authorization_basis: 'bilateral' },
    status: 'complete',
    completed_at: '2026-09-01T10:05:00.000Z',
    cancelled_at: null,
    depth_limit: 3,
    hop_count: 12,
    gap_count: 0,
    error_message: null,
    run_origin: 'template_scheduled',
    template_id: templateId,
    template_name: templateName,
  };
}
const OWN_RUN = run('r-own-1', 'a-1', 'Weekly EMEA Audit');
const FOREIGN_RUN = run('r-foreign-1', 'a-2', 'Other Audit');
// D-206 — a run whose definition was deleted with runs=archive carries
// archived_at. The runs BFF returns it only when the request URL carries
// `archived=true` (Task 2's contract).
const ARCHIVED_RUN = { ...run('r-arch-1', 'a-1', 'Weekly EMEA Audit'), archived_at: '2026-08-25T00:00:00.000Z' };

function runsFor(url: string) {
  if (url.includes('archived=true')) {
    return url.includes('template_id=a-1') ? [ARCHIVED_RUN] : [];
  }
  return url.includes('template_id=a-1') ? [OWN_RUN] : [OWN_RUN, FOREIGN_RUN];
}

beforeEach(() => {
  fetchBffJson.mockReset();
  fetchBffJson.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/account/sonar/audit/definitions/a-1')) {
      return { kind: 'ok', data: { template } };
    }
    if (path.startsWith('/api/account/sonar/audit/runs')) {
      return { kind: 'ok', data: { runs: runsFor(path), auditor_country: 'GB' } };
    }
    throw new Error(`unexpected BFF path ${path}`);
  });
  // Client-side SWR polling inside the history table — same filtering rule.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      status: 200,
      json: async () => ({ runs: runsFor(String(input)), auditor_country: 'GB' }),
    }) as Response),
  );
});

async function renderPage(tab?: string, runs?: string) {
  const Page = (await import('../page')).default;
  const searchParams: Record<string, string> = {};
  if (tab) searchParams.tab = tab;
  if (runs) searchParams.runs = runs;
  const el = await Page({
    params: Promise.resolve({ template_id: 'a-1' }),
    searchParams: Promise.resolve(searchParams),
  });
  render(el as React.ReactElement);
}

describe('AuditDefinitionDetailPage tabs', () => {
  it('opens on Run history by default and lists only this audit\'s runs', async () => {
    await renderPage();
    expect(screen.getByRole('tablist', { name: 'Audit sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Run history' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Weekly EMEA Audit — Run/ })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Other Audit — Run/ })).not.toBeInTheDocument();
  });

  it('opens on Configuration for ?tab=configuration, with the editor visible', async () => {
    await renderPage('configuration');
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Run history', hidden: true })).not.toBeVisible();
  });

  it('keeps the way back to the Audits list', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: '← Audits' })).toHaveAttribute('href', '/account/sonar/audit');
  });
});

describe('AuditDefinitionDetailPage — no Archived toggle (D-206 scope change)', () => {
  it.each([
    ['no runs param', undefined],
    ['?runs=archived (now ignored)', 'archived'],
  ])('%s: fetches the runs list exactly once, scoped by template_id and without archived, and shows no Runs toggle', async (_label, runs) => {
    await renderPage(undefined, runs);

    const runsCalls = fetchBffJson.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/audit/runs'));
    expect(runsCalls).toEqual(['/api/account/sonar/audit/runs?template_id=a-1']);

    expect(screen.queryByRole('radiogroup', { name: 'Runs' })).not.toBeInTheDocument();
  });
});

describe('AuditDefinitionDetailPage — History step reads the lifecycle events (QUA-web-api-1-14)', () => {
  const EVENT = {
    event_id: 'e-1',
    template_id: 'a-1',
    event_kind: 'suspended',
    actor_user_id: null,
    at: '2026-08-30T10:00:00.000Z',
  };

  it('passes the events lane to the History step instead of an always-empty list', async () => {
    fetchBffJson.mockImplementation(async (path: string) => {
      if (path === '/api/account/sonar/audit/definitions/a-1/events') return { kind: 'ok', data: { events: [EVENT] } };
      if (path.startsWith('/api/account/sonar/audit/definitions/a-1')) return { kind: 'ok', data: { template } };
      if (path.startsWith('/api/account/sonar/audit/runs')) return { kind: 'ok', data: { runs: runsFor(path), auditor_country: 'GB' } };
      throw new Error(`unexpected BFF path ${path}`);
    });
    await renderPage('configuration');

    expect(screen.getByText(/Authorized by/i)).toBeInTheDocument();
    expect(screen.queryByText(/No lifecycle events recorded yet/i)).not.toBeInTheDocument();
  });

  // Pin: the null branch landed with the events fetch; a lane that did not
  // answer must never read as "no events recorded".
  it('says History could not be loaded, not "no events", when the events lane fails', async () => {
    fetchBffJson.mockImplementation(async (path: string) => {
      if (path === '/api/account/sonar/audit/definitions/a-1/events') return { kind: 'error', status: 500, message: 'down' };
      if (path.startsWith('/api/account/sonar/audit/definitions/a-1')) return { kind: 'ok', data: { template } };
      if (path.startsWith('/api/account/sonar/audit/runs')) return { kind: 'ok', data: { runs: runsFor(path), auditor_country: 'GB' } };
      throw new Error(`unexpected BFF path ${path}`);
    });
    await renderPage('configuration');

    expect(screen.getByText(/History could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/No lifecycle events recorded yet/i)).not.toBeInTheDocument();
  });
});
