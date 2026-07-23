import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuardRulesMatrix } from '../_components/guard-rules-matrix';
import type { ResolvedQueryGuardRule } from '@haiwave/protocol';

const TRUST_CLASSES = ['unknown', 'behavioral_only', 'trading_pair', 'premier_partner'] as const;
const RULE_TYPES = ['sku_repeat', 'sku_breadth', 'ad_hoc_cap', 'excess_volume'] as const;

function defaultMatrix(): ResolvedQueryGuardRule[] {
  return TRUST_CLASSES.flatMap((tc) =>
    RULE_TYPES.map((rt) => ({
      rule_type: rt, trust_class: tc,
      window: rt === 'excess_volume' ? null : 'day',
      threshold: rt === 'excess_volume' ? 200 : 10,
      origin_filter: rt === 'ad_hoc_cap' ? 'ad_hoc' : 'any',
      actions: [{ type: 'alert', email: null }],
      enabled: true, source: 'default' as const, rule_id: null,
    })),
  );
}

describe('GuardRulesMatrix', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'r-new', scope: 'trust_class', trust_class: 'unknown', rule_type: 'sku_repeat', window: 'day', threshold: 3, origin_filter: 'any', actions: [{ type: 'alert', email: null }], enabled: true, created_at: '2026-07-22T00:00:00Z', updated_at: '2026-07-22T00:00:00Z', updated_by: 'u' }),
    } as Response);
  });
  afterEach(() => fetchSpy.mockRestore());

  it('renders a cell per (rule_type, class column) with Default source tags', () => {
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    // 4 rule types × (1 global + 4 classes) = 20 interactive cells
    expect(screen.getAllByRole('gridcell')).toHaveLength(20);
    expect(screen.getAllByText(/default/i).length).toBeGreaterThanOrEqual(16);
  });

  it('cell click opens the drawer; save PUTs a class-scoped upsert', async () => {
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    fireEvent.click(screen.getByLabelText(/sku_repeat rule for unknown/i));
    const threshold = await screen.findByLabelText(/threshold/i);
    fireEvent.change(threshold, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/account/query-guard/rules');
    expect((init as RequestInit).method).toBe('PUT');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ scope: 'trust_class', trust_class: 'unknown', rule_type: 'sku_repeat', threshold: 3 });
  });

  it('excess_volume row shows the agent-version note and no window select', async () => {
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    expect(screen.getByText(/requires counterparty agent/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/excess_volume rule for trading_pair/i));
    await screen.findByLabelText(/threshold/i);
    expect(screen.queryByLabelText(/window/i)).not.toBeInTheDocument();
  });
});
