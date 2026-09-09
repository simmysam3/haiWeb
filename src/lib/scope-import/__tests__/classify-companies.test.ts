import { describe, expect, it, vi } from 'vitest';
import type { ParsedDocument } from '../parse-workbook';
import { classifyCompanies, groupByCompany, MAX_DIRECTORY_LOOKUPS } from '../classify-companies';

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

  it('marks a directory hit with the exact normalized name as on the network but unconnected', async () => {
    const lookup = vi.fn(async () => [{ company_name: 'texas instruments' }, { company_name: 'Texas Instruments Europe' }]);
    const out = await classifyCompanies(doc([['Texas Instruments', 'RM48']]), { universe: [], selfNames: [], lookup });
    expect(out[0]).toMatchObject({ membership: 'on_network_unconnected' });
  });

  it('matches a directory hit on its legal name when the display name is the DBA', async () => {
    const lookup = vi.fn(async () => [{ company_name: 'Acme', legal_name: 'Acme Industrial Ltd' }]);
    const out = await classifyCompanies(doc([['Acme Industrial Ltd', 'A-1']]), { universe: [], selfNames: [], lookup });
    expect(out[0]).toMatchObject({ membership: 'on_network_unconnected' });
  });

  it('matches a directory hit on its DBA when the file spells the trading name', async () => {
    const lookup = vi.fn(async () => [{ company_name: 'Nordkapp Sensor Systems AS', dba_name: 'Nordkapp Sensors' }]);
    const out = await classifyCompanies(doc([['Nordkapp Sensors', 'N-1']]), { universe: [], selfNames: [], lookup });
    expect(out[0]).toMatchObject({ membership: 'on_network_unconnected' });
  });

  it('leaves a similarity hit whose every name differs not on the network', async () => {
    const lookup = vi.fn(async () => [
      { company_name: 'Acme Holdings', legal_name: 'Acme Holdings Inc', dba_name: 'Acme H' },
    ]);
    const out = await classifyCompanies(doc([['Acme Industrial Ltd', 'A-1']]), { universe: [], selfNames: [], lookup });
    expect(out[0]).toMatchObject({ membership: 'not_on_network' });
  });

  it('marks a company unverified when the lookup throws, and still classifies the others', async () => {
    const lookup = vi.fn(async (name: string) => {
      if (name === 'Gore') throw new Error('HTTP 502');
      return [];
    });
    const out = await classifyCompanies(doc([['Gore', 'G-1'], ['Nordkapp', 'N-1']]), { universe: [], selfNames: [], lookup });
    expect(out.map((c) => c.membership)).toEqual(['unverified', 'not_on_network']);
  });

  it('marks the session company itself as self, without a lookup', async () => {
    const lookup = vi.fn(async () => []);
    const out = await classifyCompanies(doc([['Airbus (Demo)', 'SHIPSET']]), {
      universe: [],
      selfNames: ['Airbus S.A.S. (Demo)', 'Airbus (Demo)'],
      lookup,
    });
    expect(out[0]).toMatchObject({ membership: 'self' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('skips the lookup for a one-character name (the directory needs q ≥ 2)', async () => {
    const lookup = vi.fn(async () => []);
    const out = await classifyCompanies(doc([['X', 'X-1']]), { universe: [], selfNames: [], lookup });
    expect(out[0]).toMatchObject({ membership: 'not_on_network' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('stops at the directory lookup ceiling and leaves the rest unverified', async () => {
    const lookup = vi.fn(async () => []);
    const pairs: Array<[string, string]> = Array.from({ length: 101 }, (_, i) => [`Vendor ${i}`, `V-${i}`]);
    const out = await classifyCompanies(doc(pairs), { universe: [], selfNames: [], lookup });

    // The number is a spec commitment (§5.4), so it is pinned literally here.
    expect(MAX_DIRECTORY_LOOKUPS).toBe(100);
    expect(lookup).toHaveBeenCalledTimes(100);
    expect(out).toHaveLength(101);
    expect(out.slice(0, 100).every((c) => c.membership === 'not_on_network')).toBe(true);
    // Never checked, so never claimed: "Could not be verified" is the honest line.
    expect(out[100]).toMatchObject({ name: 'Vendor 100', membership: 'unverified' });
  });

  it('spends the lookup ceiling only on names it actually looks up', async () => {
    const lookup = vi.fn(async () => []);
    const pairs: Array<[string, string]> = [
      ['Pratt & Whitney (Demo)', 'P-1'],
      ['Airbus (Demo)', 'A-1'],
      ['X', 'X-1'],
      ...Array.from({ length: 100 }, (_, i): [string, string] => [`Vendor ${i}`, `V-${i}`]),
    ];
    const out = await classifyCompanies(doc(pairs), {
      universe: [PW],
      selfNames: ['Airbus (Demo)'],
      lookup,
    });

    // Pickable, self and the too-short name burn no slot, so all 100 vendors are checked.
    expect(lookup).toHaveBeenCalledTimes(100);
    expect(out[out.length - 1]).toMatchObject({ name: 'Vendor 99', membership: 'not_on_network' });
  });

  it('never runs more lookups at once than the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const lookup = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return [];
    });
    const pairs: Array<[string, string]> = Array.from({ length: 10 }, (_, i) => [`Vendor ${i}`, `V-${i}`]);
    await classifyCompanies(doc(pairs), { universe: [], selfNames: [], lookup, concurrency: 3 });
    expect(lookup).toHaveBeenCalledTimes(10);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('keeps output in file order even when later lookups resolve before earlier ones', async () => {
    const lookup = vi.fn(async (name: string) => {
      const index = Number(name.split(' ')[1]);
      await new Promise((r) => setTimeout(r, (6 - index) * 4));
      return [];
    });
    const pairs: Array<[string, string]> = Array.from({ length: 6 }, (_, i) => [`Vendor ${i}`, `V-${i}`]);
    const out = await classifyCompanies(doc(pairs), { universe: [], selfNames: [], lookup, concurrency: 2 });
    expect(out.map((c) => c.name)).toEqual(['Vendor 0', 'Vendor 1', 'Vendor 2', 'Vendor 3', 'Vendor 4', 'Vendor 5']);
    expect(out.every((c) => c.membership === 'not_on_network')).toBe(true);
  });
});
