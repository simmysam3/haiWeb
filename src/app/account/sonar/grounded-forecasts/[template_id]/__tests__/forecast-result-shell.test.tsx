import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { GroundedForecastResult } from '@haiwave/protocol';
import {
  ForecastResultShell,
  type ForecastResultEnvelope,
} from '../_components/forecast-result-shell';
import { renderCommitmentSchedule } from '../../_lib/render-commitment-schedule';

// The protocol package's fixture result — one pacer, clean evidence.
const RESULT: GroundedForecastResult = {
  generated_at: '2026-07-30T00:00:00.000Z',
  product_name: 'a2000',
  profile: { monthly_qty: 100000, start_month: '2027-01', end_month: '2027-02' },
  assembly_days: 21,
  earliest_achievable: '2026-11-20',
  classes: [
    {
      product_class_id: 'cpt_sole_compound',
      component_sku: 'SOLE-XR9',
      qty_per_unit: 2,
      lead_basis: 'max_of_both',
      lead_days: 94,
      quoted_days: 90,
      observed: { sample_count: 11, min_days: 88, max_days: 102, median_days: 94 },
      confidence: 'high',
      quote_obtained: true,
      pacer: true,
    },
  ],
  schedule: [
    {
      month: '2027-01',
      product_class_id: 'cpt_sole_compound',
      last_commit_date: '2026-09-14',
      quantity: 200000,
      past_due: false,
    },
  ],
  pacer_ranking: ['cpt_sole_compound'],
  flags: { past_due_months: [], observed_only_classes: [] },
};

// A result whose pacer months are already past their commitment dates, plus a
// non-pacing class whose month rows sit behind the collapsed accordion row.
const PAST_DUE_RESULT: GroundedForecastResult = {
  generated_at: '2026-07-30T00:00:00.000Z',
  product_name: 'g-force',
  profile: { monthly_qty: 5000, start_month: '2026-09', end_month: '2026-10' },
  assembly_days: 10,
  earliest_achievable: '2027-02-16',
  classes: [
    {
      product_class_id: 'cpt_carbon_plate',
      component_sku: 'CP-77',
      qty_per_unit: 1,
      lead_basis: 'observed',
      lead_days: 190,
      quoted_days: null,
      observed: { sample_count: 2, min_days: 180, max_days: 200, median_days: 190 },
      confidence: 'low',
      quote_obtained: false,
      pacer: true,
    },
    {
      product_class_id: 'cpt_lace',
      component_sku: 'LACE-9',
      qty_per_unit: 4,
      lead_basis: 'max_of_both',
      lead_days: 12,
      quoted_days: 12,
      observed: { sample_count: 5, min_days: 9, max_days: 14, median_days: 11 },
      confidence: 'med',
      quote_obtained: true,
      pacer: false,
    },
  ],
  schedule: [
    {
      month: '2026-09',
      product_class_id: 'cpt_carbon_plate',
      last_commit_date: '2026-03-14',
      quantity: 5000,
      past_due: true,
    },
    {
      month: '2026-09',
      product_class_id: 'cpt_lace',
      last_commit_date: '2026-09-08',
      quantity: 20000,
      past_due: false,
    },
    {
      month: '2026-10',
      product_class_id: 'cpt_carbon_plate',
      last_commit_date: '2026-04-14',
      quantity: 5000,
      past_due: true,
    },
  ],
  pacer_ranking: ['cpt_carbon_plate', 'cpt_lace'],
  flags: {
    past_due_months: ['2026-09', '2026-10'],
    observed_only_classes: ['cpt_carbon_plate'],
  },
};

const ENVELOPE: ForecastResultEnvelope = {
  result: RESULT,
  run_id: 'run-1',
  last_run_at: '2026-07-30T12:00:00.000Z',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderShell(props: {
  templateId: string;
  lastRunId: string | null;
  initialResult: ForecastResultEnvelope | null;
}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ForecastResultShell {...props} />
    </SWRConfig>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<ForecastResultShell>', () => {
  it('copies the rendered commitment schedule to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    // The stored result already covers the template's latest run — no fetches.
    vi.stubGlobal('fetch', vi.fn());

    renderShell({ templateId: 'tpl-a2000', lastRunId: 'run-1', initialResult: ENVELOPE });

    fireEvent.click(screen.getByRole('button', { name: /copy commitment schedule/i }));

    const expected = renderCommitmentSchedule(RESULT, new Date().toISOString().slice(0, 10));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected));
    // The button confirms with a swapped label, then resets (HashCopy idiom).
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('flags past-due months with the warning pill in the working grid', () => {
    vi.stubGlobal('fetch', vi.fn());

    renderShell({
      templateId: 'tpl-gforce',
      lastRunId: 'run-9',
      initialResult: { result: PAST_DUE_RESULT, run_id: 'run-9', last_run_at: '2026-07-30T12:00:00.000Z' },
    });

    // Pacer rows open by default — both past-due cells show the pill.
    expect(screen.getAllByText('Past due')).toHaveLength(2);

    // The non-pacer row starts collapsed; expanding reveals its month rows.
    expect(screen.queryByText('2026-09-08')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /expand cpt_lace/i }));
    expect(screen.getByText('2026-09-08')).toBeInTheDocument();
  });

  it('shows the running state and polls the cheap status route while a run is active', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      jsonResponse({ status: 'running', cancel_requested_at: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderShell({ templateId: 'tpl-a2000', lastRunId: 'run-2', initialResult: null });

    expect(screen.getByText(/run in progress/i)).toBeInTheDocument();

    const statusCalls = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/account/sonar/grounded-forecasts/runs/run-2/status'),
      ).length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const initial = statusCalls();
    expect(initial).toBeGreaterThanOrEqual(1);

    // Two poll intervals (1.5s each) → strictly more status calls.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(statusCalls()).toBeGreaterThan(initial);
    // Still running — the heavy result is never fetched.
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/result')),
    ).toBe(false);
  });

  it('fetches the heavy result once the run reports complete', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/status')) {
        return jsonResponse({ status: 'complete', cancel_requested_at: null });
      }
      if (url.includes('/result')) {
        return jsonResponse({ ...ENVELOPE, run_id: 'run-2' });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderShell({ templateId: 'tpl-a2000', lastRunId: 'run-2', initialResult: null });

    expect(
      await screen.findByRole('button', { name: /copy commitment schedule/i }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/api/account/sonar/grounded-forecasts/tpl-a2000/result'),
      ),
    ).toBe(true);
  });

  it('renders the never-run empty state when there is no run and no result', () => {
    vi.stubGlobal('fetch', vi.fn());

    renderShell({ templateId: 'tpl-x', lastRunId: null, initialResult: null });

    expect(screen.getByText(/has not been run yet/i)).toBeInTheDocument();
  });
});
