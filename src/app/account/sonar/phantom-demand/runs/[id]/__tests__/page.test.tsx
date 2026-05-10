import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page.js';

vi.mock('@/lib/server-haiwave-client', () => ({
  getServerHaiwaveClient: async () => ({
    getPhantomDemandRun: async () => ({
      run_id: 'r1',
      status: 'complete',
      scope_snapshot: {
        kind: 'phantom_demand',
        counterparty: 'cp1',
        skus: ['s1', 's2'],
        hypothetical_quantity: 100,
        hypothetical_timeline: null,
      },
      results: [
        {
          sku_id: 's1',
          payload: {
            kind: 'phantom_demand_response',
            responder_quoted_quantity: 100,
            responder_completeness: 'complete',
            responder_confidence: 'high',
            responder_response_time_ms: 142,
            responder_quoted_timeline: '2026-06-01T00:00:00Z',
            free_text_response: null,
          },
          synthesis_mode: 'direct',
          gap: null,
        },
        {
          sku_id: 's2',
          payload: { kind: 'phantom_demand_response' },
          synthesis_mode: 'redacted_gap',
          gap: { reason: 'responder_probe_limit_exhausted' },
        },
      ],
    }),
  }),
}));

describe('PD run detail page', () => {
  it('renders scope summary, probe rows, gap reasons', async () => {
    render(await Page({ params: { id: 'r1' } } as any));
    // Scope summary
    expect(screen.getByText(/Counterparty/)).toBeInTheDocument();
    // '100' appears in both quantity and quoted quantity
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
    // Probe completeness — 'complete' appears in status pill + table row
    expect(screen.getAllByText('complete').length).toBeGreaterThan(0);
    // Gap reason
    expect(screen.getByText(/responder_probe_limit_exhausted/)).toBeInTheDocument();
  });
});
