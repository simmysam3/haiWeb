import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PhantomDemandResult } from '@/lib/haiwave-api';
import { ProbeResultsTable } from '../probe-results-table';

const base = {
  result_id: 'r',
  run_id: 'run',
  responder_participant_id: 'p',
  response_time_ms: 0,
  created_at: '2026-05-17T00:00:00Z',
};
const ask = { hypothetical_quantity: 200, hypothetical_timeline: null };

describe('ProbeResultsTable', () => {
  it('no-answer row: shows "No answer", "confidence n/a", action, no phantom quote', () => {
    const results: PhantomDemandResult[] = [
      { ...base, sku_id: 'PSP-GPG-COT-LG', synthesis_mode: 'redacted_gap', gap: null, payload: {} },
    ];
    render(<ProbeResultsTable results={results} ask={ask} />);
    expect(screen.getByText('No answer')).toBeInTheDocument();
    expect(screen.getByText('confidence n/a')).toBeInTheDocument();
    expect(screen.getByText(/Not a "no"/)).toBeInTheDocument();
    expect(screen.queryByText('low')).not.toBeInTheDocument();
  });

  it('partial row: shows quoted-of-ask and confidence', () => {
    const results: PhantomDemandResult[] = [
      {
        ...base,
        sku_id: 'APX-BRK-22',
        synthesis_mode: 'direct',
        gap: null,
        payload: { responder_completeness: 'partial', responder_confidence: 'medium', responder_quoted_quantity: 120 },
      },
    ];
    render(<ProbeResultsTable results={results} ask={ask} />);
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('· 120 of 200')).toBeInTheDocument();
    expect(screen.getByText('· confidence medium')).toBeInTheDocument();
  });

  it('full row: shows "Can fulfill"', () => {
    const results: PhantomDemandResult[] = [
      {
        ...base,
        sku_id: 'GLK-HX-09',
        synthesis_mode: 'direct',
        gap: null,
        payload: { responder_completeness: 'complete', responder_confidence: 'high', responder_quoted_quantity: 200 },
      },
    ];
    render(<ProbeResultsTable results={results} ask={ask} />);
    expect(screen.getByText('Can fulfill')).toBeInTheDocument();
  });
});
