import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CounterpartiesGrid } from '../counterparties-grid';
import type { WatcherResult } from '@haiwave/protocol';

function makeResult(
  overrides: Partial<WatcherResult> & { counterparty_name?: string | null } = {},
): WatcherResult {
  return {
    result_id: crypto.randomUUID(),
    run_id: 'run-1',
    counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    signal_type: 'lead_time_distribution',
    synthesis_mode: 'direct',
    payload: {
      kind: 'direct',
      window_days: 90,
      percentiles: { p50: 5, p75: 7, p90: 12, p95: 15, p99: 22 },
      sample_count: 48,
    },
    gap_reason: null,
    observed_at: '2026-05-27T10:00:00Z',
    tier: 1,
    aggregated_under_tier_1: null,
    ...overrides,
  } as WatcherResult & { counterparty_name?: string | null };
}

describe('<CounterpartiesGrid>', () => {
  it('groups results by counterparty and renders summary rows', () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
          }),
          makeResult({
            counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            counterparty_name: 'Brass Co',
            signal_type: 'capacity_utilization_band',
            payload: {
              kind: 'direct',
              band: 'high',
              observed_at: '2026-05-27T10:00:00Z',
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText('Apex')).toBeInTheDocument();
    expect(screen.getByText('Brass Co')).toBeInTheDocument();
  });

  it('aggregates null-identity rows as "Identity withheld"', () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({ counterparty_participant_id: null, tier: 2 }),
          makeResult({ counterparty_participant_id: null, tier: 2 }),
        ]}
      />,
    );
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
  });

  it('reveals signal panels when a counterparty row is expanded', async () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
          }),
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Apex/i }));
    expect(screen.getByText(/sample/i)).toBeInTheDocument();
  });

  it('search input filters counterparties by name', async () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex Metals',
          }),
          makeResult({
            counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            counterparty_name: 'Brass Co',
            signal_type: 'capacity_utilization_band',
            payload: {
              kind: 'direct',
              band: 'high',
              observed_at: '2026-05-27T10:00:00Z',
            },
          }),
        ]}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Apex');
    expect(screen.getByText('Apex Metals')).toBeInTheDocument();
    expect(screen.queryByText('Brass Co')).toBeNull();
  });
});
