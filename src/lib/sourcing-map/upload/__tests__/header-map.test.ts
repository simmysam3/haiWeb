import { describe, it, expect, vi, afterEach } from 'vitest';
import { autoMap, headerSignature, rememberMapping, recallMapping } from '../header-map';
import { MENS_US_7_13 } from '../../__fixtures__/vomero';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('upload header mapping', () => {
  it('pre-maps BOM headers from their synonyms and size columns to per-size quantity', () => {
    const headers = ['Description', 'Usage', 'UOM', 'Vendor', "Mat'l #", '7', '9.0', '13', 'Notes'];
    expect(autoMap('bom', headers, MENS_US_7_13)).toEqual([
      'component', 'qty_per_unit', 'uom', 'supplier', 'part_ref', 'variant_qty', 'variant_qty', 'variant_qty', 'ignore',
    ]);
  });
});
