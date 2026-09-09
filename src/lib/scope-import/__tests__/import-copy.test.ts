import { describe, expect, it } from 'vitest';
import {
  parsedSummary,
  membershipLine,
  companyOptionLabel,
  matchSummary,
  notInCatalogLine,
  notAcceptedLine,
  catalogFailureLine,
} from '../import-copy';

describe('import copy', () => {
  it('summarises the parse with singular/plural agreement and an optional skipped clause', () => {
    expect(parsedSummary('bom.xlsx', 34, 10, 0)).toBe('bom.xlsx: 34 products across 10 companies.');
    expect(parsedSummary('bom.xlsx', 1, 1, 3)).toBe('bom.xlsx: 1 product across 1 company. 3 rows skipped (no company or no SKU).');
    expect(parsedSummary('bom.xlsx', 2, 1, 1)).toBe('bom.xlsx: 2 products across 1 company. 1 row skipped (no company or no SKU).');
  });

  it('renders each membership line as label + comma-delimited names, or nothing when empty', () => {
    expect(membershipLine('not_on_network', ['Meridian Aerospace Fasteners', 'Nordkapp Sensor Systems'])).toBe(
      'Not on the HAIWAVE network: Meridian Aerospace Fasteners, Nordkapp Sensor Systems.',
    );
    expect(membershipLine('on_network_unconnected', ['Texas Instruments'])).toBe(
      'On the network but not yet connected: Texas Instruments.',
    );
    expect(membershipLine('unverified', ['Gore'])).toBe('Could not be verified: Gore.');
    expect(membershipLine('not_on_network', [])).toBeNull();
  });

  it('labels a company option with its SKU count', () => {
    expect(companyOptionLabel('Pratt & Whitney (Demo)', 5)).toBe('Pratt & Whitney (Demo) (5 SKUs in file)');
    expect(companyOptionLabel('Acme', 1)).toBe('Acme (1 SKU in file)');
  });

  it('summarises a match and lists misses', () => {
    expect(matchSummary('Pratt & Whitney (Demo)', 5, 5)).toBe(
      '5 of 5 SKUs for Pratt & Whitney (Demo) matched and were checked below.',
    );
    expect(matchSummary('Acme', 0, 1)).toBe('0 of 1 SKU for Acme matched and were checked below.');
    expect(notInCatalogLine('Acme', ['ABC-1', 'ABC-2'])).toBe("Not in Acme's catalog: ABC-1, ABC-2.");
    expect(notInCatalogLine('Acme', [])).toBeNull();
    expect(notAcceptedLine(['Z-9'])).toBe('In the catalog but not in an accepted audit scope: Z-9.');
    expect(notAcceptedLine([])).toBeNull();
    expect(catalogFailureLine('Acme')).toBe("Could not load Acme's catalog. Nothing was checked.");
  });
});
