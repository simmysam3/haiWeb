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

describe('TrustPosturePage', () => {
  it('renders postures from BFF when fetch succeeds', async () => {
    fetchMock.mockResolvedValueOnce({
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
    } as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    // Header always renders
    expect(screen.getByRole('heading', { name: /trust posture/i })).toBeInTheDocument();
    // No error banner on success
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error banner and synthesised default grid when fetch returns non-200', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/unable to load trust posture/i);
    expect(alert.textContent).toMatch(/503/);
    // Grid still rendered (12 default cells) so the page is usable
    expect(screen.getAllByRole('gridcell').length).toBe(12);
  });

  it('shows an error banner when fetch itself rejects (network error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/unable to reach the trust posture service/i);
    // Grid still rendered with spec defaults
    expect(screen.getAllByRole('gridcell').length).toBe(12);
  });

  it('synthesised default grid uses permissive for phantom_demand (spec §6.2)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    // 4 phantom_demand cells should all show "permissive" — not "manual" as
    // the prior silent-fallback path would have produced.
    const permissiveChips = screen.getAllByText('permissive');
    expect(permissiveChips.length).toBeGreaterThanOrEqual(4);
  });
});
