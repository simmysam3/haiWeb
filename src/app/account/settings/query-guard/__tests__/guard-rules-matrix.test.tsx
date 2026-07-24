import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuardRulesMatrix } from '../_components/guard-rules-matrix';
import type { QueryGuardRule, ResolvedQueryGuardRule } from '@haiwave/protocol';

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

const savedRule: QueryGuardRule = {
  id: 'r-new', owner_participant_id: 'me', scope: 'trust_class', trust_class: 'unknown',
  rule_type: 'sku_repeat', window: 'day', threshold: 3, origin_filter: 'any',
  actions: [{ type: 'alert', email: null }], enabled: true,
  created_at: '2026-07-22T00:00:00Z', updated_at: '2026-07-22T00:00:00Z', updated_by: 'u',
};

const globalRule: QueryGuardRule = {
  id: 'g1', owner_participant_id: 'me', scope: 'client_global', trust_class: null,
  rule_type: 'sku_repeat', window: 'day', threshold: 7, origin_filter: 'any',
  actions: [{ type: 'alert', email: null }], enabled: true,
  created_at: '2026-07-22T00:00:00Z', updated_at: '2026-07-22T00:00:00Z', updated_by: 'u',
};

function jsonRes(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe('GuardRulesMatrix', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonRes(savedRule));
  });
  afterEach(() => fetchSpy.mockRestore());

  it('renders a cell per (rule_type, class column) with Default source tags', () => {
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    // 4 rule types × (1 global + 4 classes) = 20 interactive cells
    expect(screen.getAllByRole('gridcell')).toHaveLength(20);
    expect(screen.getAllByText('Default')).toHaveLength(20);
    expect(screen.queryByText('Global')).not.toBeInTheDocument();
    expect(screen.queryByText('Class')).not.toBeInTheDocument();
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

  it('save folds the refetched matrix back into the grid', async () => {
    const updated = defaultMatrix().map((r) =>
      r.trust_class === 'unknown' && r.rule_type === 'sku_repeat'
        ? { ...r, threshold: 3, source: 'class' as const, rule_id: 'r-new' }
        : r,
    );
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return jsonRes(savedRule);
      const url = String(input);
      if (url.includes('/rules/resolved')) return jsonRes({ matrix: updated });
      if (url.includes('/rules')) return jsonRes({ rules: [savedRule] });
      return jsonRes({});
    });
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    fireEvent.click(screen.getByLabelText(/sku_repeat rule for unknown/i));
    const threshold = await screen.findByLabelText(/threshold/i);
    fireEvent.change(threshold, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/sku_repeat rule for unknown/i)).toHaveTextContent('3 / day'),
    );
    expect(screen.getByLabelText(/sku_repeat rule for unknown/i)).toHaveTextContent('Class');
  });

  it('global-column save PUTs a client_global upsert with trust_class null', async () => {
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    fireEvent.click(screen.getByLabelText(/sku_repeat rule for all counterparties/i));
    await screen.findByLabelText(/threshold/i);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ scope: 'client_global', trust_class: null, rule_type: 'sku_repeat' });
  });

  it('derives the global column from initialRules and tags it Global', () => {
    render(
      <GuardRulesMatrix
        initialMatrix={defaultMatrix()}
        defaultAlertEmail={null}
        initialRules={[globalRule]}
      />,
    );
    const globalCell = screen.getByLabelText(/sku_repeat rule for all counterparties/i);
    expect(globalCell).toHaveTextContent('7 / day');
    expect(screen.getAllByText('Global')).toHaveLength(1);
  });

  it('tags class overrides Class in the class columns', () => {
    const matrix = defaultMatrix().map((r) =>
      r.trust_class === 'unknown' && r.rule_type === 'sku_repeat'
        ? { ...r, threshold: 3, source: 'class' as const, rule_id: 'r1' }
        : r,
    );
    render(<GuardRulesMatrix initialMatrix={matrix} defaultAlertEmail={null} />);
    expect(screen.getAllByText('Class')).toHaveLength(1);
    expect(screen.getByLabelText(/sku_repeat rule for unknown/i)).toHaveTextContent('3 / day');
  });

  describe('reset to default', () => {
    const overrideMatrix = () =>
      defaultMatrix().map((r) =>
        r.trust_class === 'unknown' && r.rule_type === 'sku_repeat'
          ? { ...r, threshold: 3, source: 'class' as const, rule_id: 'r1' }
          : r,
      );

    it('DELETEs the override row by id and folds the refetched defaults back', async () => {
      fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') return { ok: true, status: 204, json: async () => null, text: async () => '' } as Response;
        const url = String(input);
        if (url.includes('/rules/resolved')) return jsonRes({ matrix: defaultMatrix() });
        if (url.includes('/rules')) return jsonRes({ rules: [] });
        return jsonRes({});
      });
      render(<GuardRulesMatrix initialMatrix={overrideMatrix()} defaultAlertEmail={null} />);
      fireEvent.click(screen.getByLabelText(/sku_repeat rule for unknown/i));
      const reset = await screen.findByRole('button', { name: /reset to default/i });
      fireEvent.click(reset);
      await waitFor(() =>
        expect(screen.getByLabelText(/sku_repeat rule for unknown/i)).toHaveTextContent('10 / day'),
      );
      const del = (fetchSpy.mock.calls as [RequestInfo | URL, RequestInit?][]).find(
        (call) => call[1]?.method === 'DELETE',
      );
      expect(del).toBeDefined();
      expect(String(del![0])).toContain('/api/account/query-guard/rules/r1');
    });

    it('offers no Reset button on a default-sourced cell', async () => {
      render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
      fireEvent.click(screen.getByLabelText(/sku_repeat rule for unknown/i));
      await screen.findByLabelText(/threshold/i);
      expect(screen.queryByRole('button', { name: /reset to default/i })).not.toBeInTheDocument();
    });
  });

  it('excess_volume row shows the agent-version note and no window select', async () => {
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    expect(screen.getByText(/requires counterparty agent/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/excess_volume rule for trading_pair/i));
    await screen.findByLabelText(/threshold/i);
    expect(screen.queryByLabelText(/window/i)).not.toBeInTheDocument();
  });

  it('excess_volume save forces window: null (the drawer default must not leak)', async () => {
    render(<GuardRulesMatrix initialMatrix={defaultMatrix()} defaultAlertEmail={null} />);
    fireEvent.click(screen.getByLabelText(/excess_volume rule for trading_pair/i));
    await screen.findByLabelText(/threshold/i);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ rule_type: 'excess_volume', window: null });
  });

  it('summary names every action of a rule, not just the first', () => {
    const matrix = defaultMatrix().map((r) =>
      r.trust_class === 'unknown' && r.rule_type === 'sku_breadth'
        ? { ...r, actions: [{ type: 'alert' as const, email: null }, { type: 'block' as const }] }
        : r,
    );
    render(<GuardRulesMatrix initialMatrix={matrix} defaultAlertEmail={null} />);
    // An [alert, block] rule summarized as alert-only would understate the
    // enforcement — the block must be visible in the plain-English line.
    expect(screen.getByText(/alert \+ block at 10 distinct SKUs\/day/)).toBeInTheDocument();
  });
});
