import { describe, expect, it, vi } from 'vitest';
import type { ParsedDocument } from '../parse-workbook';
import { classifyCompanies, groupByCompany } from '../classify-companies';

function doc(pairs: Array<[string, string]>): ParsedDocument {
  return {
    sheet: 'Products',
    columns: { company: 'Company Name', sku: 'Product ID' },
    rows: pairs.map(([company, sku], i) => ({ company, sku, row: i + 2 })),
    skipped: 0,
    totalDataRows: pairs.length,
  };
}

const PW = { counterparty_id: 'cp-pw', counterparty_legal_name: 'Pratt & Whitney (Demo)' };

describe('groupByCompany', () => {
  it('groups SKUs under the first spelling of each normalized company name, in file order', () => {
    expect(
      groupByCompany(doc([['Acme', 'A-1'], ['  ACME', 'A-2'], ['Bolt Co', 'B-1'], ['Acme', 'A-1']])),
    ).toEqual([
      { name: 'Acme', skus: ['A-1', 'A-2'] },
      { name: 'Bolt Co', skus: ['B-1'] },
    ]);
  });
});

describe('classifyCompanies', () => {
  it('marks a universe counterparty pickable without a lookup, and an unknown name not on the network', async () => {
    const lookup = vi.fn(async () => []);
    const out = await classifyCompanies(doc([['Pratt & Whitney (Demo)', '5328285'], ['Meridian Aerospace Fasteners', 'MAF-1']]), {
      universe: [PW],
      selfNames: [],
      lookup,
    });
    expect(out).toEqual([
      { name: 'Pratt & Whitney (Demo)', membership: 'pickable', counterpartyId: 'cp-pw', skus: ['5328285'] },
      { name: 'Meridian Aerospace Fasteners', membership: 'not_on_network', skus: ['MAF-1'] },
    ]);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('Meridian Aerospace Fasteners');
  });
});
