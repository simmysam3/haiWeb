import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { RunTemplateScope } from '@haiwave/protocol';
import { AuditScopePicker } from '../audit-scope-picker';

afterEach(() => vi.unstubAllGlobals());

type AuditScope = Extract<RunTemplateScope, { kind: 'audit' }>;
const CP = 'cccccccc-0000-0000-0000-000000000001';

const bilateralEmpty = {
  kind: 'audit',
  authorization_basis: 'bilateral',
  counterparties: [],
  signal_types: [],
  skus: [],
  depth_limit: 1,
  hop_budget: 3,
} as AuditScope;

function stubAuditFetch() {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname.endsWith('/audit/wizard-options')) {
        return json({ counterparties: [{ counterparty_id: CP, counterparty_legal_name: 'Acme', product_ids: ['PN-88A'] }] });
      }
      if (url.pathname.endsWith('/catalog/classes')) return json({ classes: [] });
      if (url.pathname.endsWith('/catalog/products')) {
        return json({
          products: [
            { external_product_id: 'PN-88A', product_name: 'Widget A', primary_class_slug: null },
            { external_product_id: 'PN-99B', product_name: 'Widget B', primary_class_slug: null },
          ],
          total: 2,
        });
      }
      if (url.pathname === '/api/account/profile') return json({ legal_name: 'Me Inc' });
      if (url.pathname === '/api/account/directory') return json([]);
      throw new Error(`unexpected fetch ${url.pathname}`);
    }),
  );
}

function fileWith(rows: unknown[][]): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Products');
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'scope.xlsx');
}

describe('AuditScopePicker — import from spreadsheet (bilateral branch)', () => {
  it('checks the accepted match, reports the unaccepted one, and emits the audit scope', async () => {
    stubAuditFetch();
    const onChange = vi.fn();
    render(<AuditScopePicker value={bilateralEmpty} onChange={onChange} />);

    const input = (await screen.findByLabelText(/choose a spreadsheet/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fileWith([['Vendor', 'Part Number'], ['Acme', 'PN-88A'], ['Acme', 'PN-99B']])] } });
    const select = (await screen.findByLabelText('Import products for')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: CP } });

    expect(await screen.findByText('1 of 2 SKUs for Acme matched and were checked below.')).toBeInTheDocument();
    expect(screen.getByText('In the catalog but not in an accepted audit scope: PN-99B.')).toBeInTheDocument();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AuditScope & { skus: string[]; counterparties: string[] };
    expect(last.skus).toEqual(['PN-88A']);
    expect(last.counterparties).toEqual([CP]);
    expect(last.authorization_basis).toBe('bilateral');
  });

  it('offers no import panel on the key-scoped branch', () => {
    stubAuditFetch();
    render(
      <AuditScopePicker
        value={{ kind: 'audit', authorization_basis: 'key_scoped', provenance_key_id: '', depth_limit: 1, hop_budget: 3 } as AuditScope}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/choose a spreadsheet/i)).not.toBeInTheDocument();
  });
});
