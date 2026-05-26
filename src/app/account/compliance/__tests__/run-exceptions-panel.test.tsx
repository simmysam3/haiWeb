import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { AuditException } from '@haiwave/protocol';
import { RunExceptionsPanel, groupByVendor } from '../run-exceptions-panel';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

function exception(over: Partial<AuditException>): AuditException {
  return {
    run_id: 'r1',
    vendor_id: 'v1',
    vendor_legal_name: 'Acme',
    product_id: 'SKU-1',
    triggered_at: '2026-05-25T00:00:00.000Z',
    compliance_status: 'non_compliant',
    gap_count: 1,
    gap_kinds: ['origin'],
    ...over,
  } as AuditException;
}

beforeEach(() => {
  pushMock.mockReset();
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ exceptions: testExceptions, window_days: 7 }),
  })) as unknown as typeof globalThis.fetch;
});

let testExceptions: AuditException[] = [];

describe('groupByVendor', () => {
  it('returns [] for empty input', () => {
    expect(groupByVendor([])).toEqual([]);
  });

  it('groups three issues from the same vendor into one group of 3', () => {
    const a = exception({ vendor_id: 'v1', product_id: 'SKU-1', run_id: 'r1' });
    const b = exception({ vendor_id: 'v1', product_id: 'SKU-2', run_id: 'r2' });
    const c = exception({ vendor_id: 'v1', product_id: 'SKU-3', run_id: 'r3' });
    const groups = groupByVendor([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0].vendorId).toBe('v1');
    expect(groups[0].issues).toHaveLength(3);
  });

  it('sorts groups by issue count desc, then vendor name asc on tie', () => {
    const v1a = exception({ vendor_id: 'v1', vendor_legal_name: 'Acme', product_id: 'SKU-1', run_id: 'r1' });
    const v2a = exception({ vendor_id: 'v2', vendor_legal_name: 'BravoCo', product_id: 'SKU-2', run_id: 'r2' });
    const v2b = exception({ vendor_id: 'v2', vendor_legal_name: 'BravoCo', product_id: 'SKU-3', run_id: 'r3' });
    const v2c = exception({ vendor_id: 'v2', vendor_legal_name: 'BravoCo', product_id: 'SKU-4', run_id: 'r4' });
    const v3a = exception({ vendor_id: 'v3', vendor_legal_name: 'CharlieLLC', product_id: 'SKU-5', run_id: 'r5' });
    // v2 has 3, v1 has 1, v3 has 1; tiebreaker between v1 and v3 → alphabetical
    const groups = groupByVendor([v1a, v2a, v2b, v2c, v3a]);
    expect(groups.map((g) => g.vendorId)).toEqual(['v2', 'v1', 'v3']);
  });

  it('falls back to vendor_id when vendor_legal_name is null', () => {
    const ex = exception({ vendor_id: 'v1', vendor_legal_name: null as unknown as string });
    const groups = groupByVendor([ex]);
    expect(groups[0].vendorName).toBe('v1');
  });
});

describe('RunExceptionsPanel', () => {
  it('renders vendors collapsed by default with count badges; product rows hidden', async () => {
    testExceptions = [
      exception({ vendor_id: 'v1', vendor_legal_name: 'Acme', product_id: 'SKU-1', run_id: 'r1' }),
      exception({ vendor_id: 'v1', vendor_legal_name: 'Acme', product_id: 'SKU-2', run_id: 'r2' }),
      exception({ vendor_id: 'v2', vendor_legal_name: 'BravoCo', product_id: 'SKU-3', run_id: 'r3' }),
    ];
    render(<RunExceptionsPanel />);
    // Wait for fetch + render. The component sets loading=false after fetch resolves.
    await screen.findByText('Acme');
    expect(screen.getByText('BravoCo')).toBeInTheDocument();
    // Issue-count badges (just numbers, but unambiguous in this layout)
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    // Product rows not yet rendered (groups collapsed)
    expect(screen.queryByText('SKU-1')).not.toBeInTheDocument();
    expect(screen.queryByText('SKU-3')).not.toBeInTheDocument();
  });

  it('expands a group when its chevron is clicked', async () => {
    testExceptions = [
      exception({ vendor_id: 'v1', vendor_legal_name: 'Acme', product_id: 'SKU-1', run_id: 'r1' }),
    ];
    render(<RunExceptionsPanel />);
    await screen.findByText('Acme');
    const expandBtn = screen.getByRole('button', { name: /Expand Acme/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText('SKU-1')).toBeInTheDocument();
  });

  it('navigates to the audit run when an expanded product row is clicked', async () => {
    testExceptions = [
      exception({ vendor_id: 'v1', vendor_legal_name: 'Acme', product_id: 'SKU-1', run_id: 'r-target' }),
    ];
    render(<RunExceptionsPanel />);
    await screen.findByText('Acme');
    fireEvent.click(screen.getByRole('button', { name: /Expand Acme/i }));
    const row = screen.getByText('SKU-1').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row as HTMLElement);
    expect(pushMock).toHaveBeenCalledWith('/account/sonar/audit/r-target');
  });

  it('renders the empty state when there are zero exceptions', async () => {
    testExceptions = [];
    render(<RunExceptionsPanel />);
    expect(await screen.findByText(/No exceptions in the last/i)).toBeInTheDocument();
  });
});
