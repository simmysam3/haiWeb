import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_WATCHER_DRIFT_THRESHOLDS } from '@haiwave/protocol';
import { WatcherWizard } from '../watcher-wizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  // Default: any URL not explicitly handled returns an empty 200 — keeps the
  // wizard-options fetch fired from <BilateralCounterpartiesSkusFields> from
  // hanging the test. The relevant assertions inspect calls by URL, not order.
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ counterparties: [] }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

describe('<WatcherWizard>', () => {
  it('renders four step cards: Identity, Watcher Scope, Schedule, Lifecycle', () => {
    render(<WatcherWizard />);
    expect(screen.getByRole('heading', { name: /Identity/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Watcher Scope/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lifecycle/i })).toBeInTheDocument();
  });

  it('offers readiness signals and defaults a readiness watcher to include them', () => {
    render(<WatcherWizard />);
    // The readiness signals are selectable options in the scope picker…
    expect(screen.getByText('Order state')).toBeInTheDocument();
    expect(screen.getByText('Soft-quoted')).toBeInTheDocument();
    // …and a fresh watcher defaults its signal_types to include them.
    expect(screen.getByLabelText('ORD')).toBeChecked();
    expect(screen.getByLabelText('SQL')).toBeChecked();
  });

  it('renders a Drift detection step so thresholds can be set up front', () => {
    render(<WatcherWizard />);
    expect(
      screen.getByRole('heading', { name: /Drift detection/i }),
    ).toBeInTheDocument();
  });

  it('disables submit when name is empty', () => {
    render(<WatcherWizard />);
    // Default cadence is manual_only → submit label is "Run now". A bare
    // /(Run now|Schedule)/i regex would also match the StepRail's "Schedule"
    // nav button, so anchor the match exactly.
    const submit = screen.getByRole('button', { name: /^Run now$/i });
    expect(submit).toBeDisabled();
  });

  it('POSTs to /api/account/sonar/watcher/definitions on submit', async () => {
    // Override default: queue specific responses for the two writes the
    // wizard issues (template create, then run dispatch). Any other fetch
    // (e.g. wizard-options on mount) falls through to the default above.
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/sonar/watcher/definitions') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ template: { template_id: 'tpl-1' } }),
        } as Response);
      }
      if (url === '/api/account/sonar/watcher/runs') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ run_id: 'run-1' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ counterparties: [] }),
      } as Response);
    });

    render(<WatcherWizard />);
    await userEvent.type(screen.getByLabelText(/Watcher name/i), 'My Watcher');
    await userEvent.click(screen.getByRole('button', { name: /^Run now$/i }));

    const definitionsCall = fetchMock.mock.calls.find(
      (c) => c[0] === '/api/account/sonar/watcher/definitions',
    );
    expect(definitionsCall).toBeDefined();
    expect(definitionsCall![1]?.method).toBe('POST');
  });

  it('seeds default drift_thresholds into the created template scope', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/sonar/watcher/definitions') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ template: { template_id: 'tpl-1' } }),
        } as Response);
      }
      if (url === '/api/account/sonar/watcher/runs') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ run_id: 'run-1' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ counterparties: [] }),
      } as Response);
    });

    render(<WatcherWizard />);
    await userEvent.type(screen.getByLabelText(/Watcher name/i), 'My Watcher');
    await userEvent.click(screen.getByRole('button', { name: /^Run now$/i }));

    const definitionsCall = fetchMock.mock.calls.find(
      (c) => c[0] === '/api/account/sonar/watcher/definitions',
    );
    expect(definitionsCall).toBeDefined();
    const body = JSON.parse(definitionsCall![1]!.body as string);
    expect(body.scope.drift_thresholds).toEqual(DEFAULT_WATCHER_DRIFT_THRESHOLDS);
  });
});
