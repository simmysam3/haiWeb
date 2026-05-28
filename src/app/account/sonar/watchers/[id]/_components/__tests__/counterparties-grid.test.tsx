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
    external_product_id: null,
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

  it('reveals product sub-list and signal panels when vendor + product are expanded', async () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
            external_product_id: null,
          }),
        ]}
      />,
    );
    // Expand the vendor row → reveals the product sub-list. Because the result
    // carries external_product_id=null, the sub-item is the canonical
    // vendor-aggregate placeholder. Products are open by default once the
    // vendor expands, so the signal panels show immediately — no second click.
    await userEvent.click(screen.getByRole('button', { name: /Apex/i }));
    const productButton = await screen.findByRole('button', {
      name: /Vendor-aggregate/i,
    });
    expect(screen.getByText(/sample/i)).toBeInTheDocument();
    // Clicking the product now collapses it (default-open → hidden).
    await userEvent.click(productButton);
    expect(screen.queryByText(/sample/i)).toBeNull();
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

  it('renders one product sub-row per external_product_id within a vendor (Plan 3 E3)', async () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
            external_product_id: 'SKU-A',
            signal_type: 'published_lead_time',
            payload: { kind: 'direct', days: 10, observed_at: '2026-05-27T10:00:00Z' },
          }),
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
            external_product_id: 'SKU-B',
            signal_type: 'published_lead_time',
            payload: { kind: 'direct', days: 14, observed_at: '2026-05-27T10:00:00Z' },
          }),
        ]}
        productNameByExtId={{ 'SKU-A': 'Widget A', 'SKU-B': 'Widget B' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Apex/i }));
    // Both products surface inside the vendor row, named via the map prop.
    expect(
      await screen.findByRole('button', { name: /Widget A/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Widget B/i })).toBeInTheDocument();
    // Products are open by default once the vendor expands, so the
    // LeadTimeTriplet (Published panel shows days) is visible without an extra
    // click.
    expect(screen.getByText('10d')).toBeInTheDocument();
  });
});
