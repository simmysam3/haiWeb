import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => '' }),
  headers: async () => ({ get: () => 'localhost:3001' }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const POSTURE_URL = '/api/account/settings/trust-posture';
const SETTING_URL = '/api/account/settings/sourcing-map-setting';

/** Answers by URL: the posture grid and the Sourcing Map setting are fetched in parallel. */
function routeFetch(posture: () => Promise<Response>, setting?: () => Promise<Response>) {
  fetchMock.mockImplementation(async (url: unknown) => {
    const u = String(url);
    if (u.endsWith(POSTURE_URL)) return posture();
    if (u.endsWith(SETTING_URL)) {
      return (setting ?? (async () => ({ ok: true, json: async () => ({ answer_for_myself_only: false }) }) as Response))();
    }
    throw new Error(`unexpected fetch ${u}`);
  });
}

describe('TrustPosturePage', () => {
  it('renders postures from BFF when fetch succeeds', async () => {
    routeFetch(async () => ({
      ok: true,
      json: async () => ({
        postures: [
          {
            participant_id: '00000000-0000-0000-0000-000000000001',
            trust_class: 'trading_pair',
            modality: 'audit',
            posture: 'permissive',
            signal_type_overrides: null,
            effective_from: '2026-05-10T00:00:00.000Z',
            configured_by: '00000000-0000-0000-0000-000000000002',
          },
        ],
      }),
    }) as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    // Header always renders
    expect(screen.getByRole('heading', { name: /trust posture/i })).toBeInTheDocument();
    // No error banner on success
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error banner and synthesised default grid when fetch returns non-200', async () => {
    routeFetch(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => 'Service Unavailable',
    }) as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/unable to load trust posture/i);
    expect(alert.textContent).toMatch(/503/);
    // Grid still rendered (12 default cells) so the page is usable
    expect(screen.getAllByRole('cell').length).toBe(12);
  });

  it('shows an error banner when fetch itself rejects (network error)', async () => {
    routeFetch(async () => {
      throw new Error('network down');
    });
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/unable to reach the trust posture service/i);
    // Grid still rendered with spec defaults
    expect(screen.getAllByRole('cell').length).toBe(12);
  });

  it('synthesised default grid uses permissive for phantom_demand (spec §6.2)', async () => {
    routeFetch(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    // 4 phantom_demand cells should all show "permissive" — not "manual" as
    // the prior silent-fallback path would have produced.
    const permissiveChips = screen.getAllByText('permissive');
    expect(permissiveChips.length).toBeGreaterThanOrEqual(4);
  });

  it('a setting reply without a boolean disables the switch', async () => {
    routeFetch(
      async () => ({ ok: true, json: async () => ({ postures: [] }) }) as Response,
      async () => ({ ok: true, json: async () => ({ postures: [] }) }) as Response,
    );
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('the switch is not inside the grid and follows it in DOM order', async () => {
    routeFetch(async () => ({ ok: true, json: async () => ({ postures: [] }) }) as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    const grid = screen.getByRole('table');
    const box = screen.getByRole('switch');
    expect(grid).not.toContainElement(box);
    expect(grid.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('with both loads failing, the posture banner is the only alert', async () => {
    const failing = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => '' }) as Response;
    routeFetch(failing, failing);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    expect(screen.getByRole('alert').textContent).toMatch(/unable to load trust posture/i);
    expect(screen.getByText("Couldn't load the setting.")).toBeInTheDocument();
  });

  it("reads the setting from its URL: a saved true renders the switch checked and enabled", async () => {
    routeFetch(
      async () => ({ ok: true, json: async () => ({ postures: [] }) }) as Response,
      async () => ({ ok: true, json: async () => ({ answer_for_myself_only: true }) }) as Response,
    );
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    const box = screen.getByRole('switch');
    expect(box).toBeChecked();
    expect(box).toBeEnabled();
  });
});
