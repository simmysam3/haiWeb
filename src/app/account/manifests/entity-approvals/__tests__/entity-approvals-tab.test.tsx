import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EntityApprovalsTab } from '../entity-approvals-tab';

// The queue + wizard both fetch via useApi; stub it so the tab renders without
// network. The queue returns empty (so "Approve a company" is reachable) and
// the wizard's scorecard returns a minimal proactive scorecard.
const useApi = vi.fn();
vi.mock('@/lib/use-api', () => ({
  useApi: (opts: { url: string }) => useApi(opts),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useApi.mockImplementation((opts: { url: string }) => {
    if (opts.url.includes('/scorecard')) {
      return { data: { tier: 'connection', rows: [], gap_count: 0, counts: {} }, loading: false, error: null, refetch: vi.fn() };
    }
    return { data: [], loading: false, error: null, refetch: vi.fn() };
  });
});

afterEach(() => vi.unstubAllGlobals());

function stubDirectory(rows: { id: string; company_name: string; location: string; industry: string }[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) }));
}

describe('EntityApprovalsTab — proactive approval', () => {
  it('opens a participant-search modal when "Approve a company" is clicked', () => {
    stubDirectory([]);
    render(<EntityApprovalsTab />);
    fireEvent.click(screen.getByRole('button', { name: /approve a company/i }));
    expect(screen.getByPlaceholderText(/search the haiwave directory/i)).toBeInTheDocument();
  });

  it('searches the directory (debounced, ≥2 chars) and lists results', async () => {
    vi.useFakeTimers();
    try {
      stubDirectory([{ id: 'p1', company_name: 'Acme Brass', location: 'OH', industry: 'Foundry' }]);
      render(<EntityApprovalsTab />);
      fireEvent.click(screen.getByRole('button', { name: /approve a company/i }));
      const input = screen.getByPlaceholderText(/search the haiwave directory/i);
      fireEvent.change(input, { target: { value: 'ac' } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(screen.getByText('Acme Brass')).toBeInTheDocument());
  });

  it('picking a participant opens the wizard in proactive mode against the counterparty endpoint', async () => {
    vi.useFakeTimers();
    try {
      stubDirectory([{ id: 'p1', company_name: 'Acme Brass', location: 'OH', industry: 'Foundry' }]);
      render(<EntityApprovalsTab />);
      fireEvent.click(screen.getByRole('button', { name: /approve a company/i }));
      fireEvent.change(screen.getByPlaceholderText(/search the haiwave directory/i), { target: { value: 'acme' } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(screen.getByText('Acme Brass')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /review acme brass/i }));

    // Wizard mounted: proactive subtitle + scorecard fetched via the counterparty endpoint.
    expect(screen.getByText(/proactive approval/i)).toBeInTheDocument();
    const scorecardCall = useApi.mock.calls.map((c) => (c[0] as { url: string }).url).find((u) => u.includes('/scorecard'));
    expect(scorecardCall).toBe('/api/account/entity-approvals/counterparty/p1/scorecard?tier=connection');
    // Approve-only: no revoke radio in proactive mode.
    expect(screen.queryByRole('radio', { name: /revoke/i })).toBeNull();
  });
});
