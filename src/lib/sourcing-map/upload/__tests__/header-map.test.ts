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

  it('pre-maps demand headers, and takes each named target once (a second Qty column is ignored)', () => {
    expect(autoMap('demand', ['Style', 'Due Date', 'Size', 'Pairs'], MENS_US_7_13)).toEqual(['product', 'due_date', 'variant', 'quantity']);
    expect(autoMap('bom', ['Component', 'Qty', 'Qty'], MENS_US_7_13)).toEqual(['component', 'qty_per_unit', 'ignore']);
  });

  it('remembers a mapping by header signature and survives throwing storage', () => {
    const headers = ['Description ', 'USAGE*', 'UOM'];
    expect(headerSignature(headers)).toBe(headerSignature(['description', 'usage', 'uom']));
    expect(recallMapping('bom', headers)).toBeNull();
    rememberMapping('bom', headers, ['component', 'qty_per_unit', 'ignore']);
    expect(recallMapping('bom', ['description', 'Usage', 'uom'])).toEqual(['component', 'qty_per_unit', 'ignore']);
    expect(recallMapping('demand', headers)).toBeNull();
    window.localStorage.setItem(`sm.upload-map.v1.bom.${headerSignature(['a', 'b'])}`, JSON.stringify(['nonsense', 'ignore']));
    expect(recallMapping('bom', ['a', 'b'])).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(recallMapping('bom', headers)).toBeNull();
    expect(() => rememberMapping('bom', headers, ['component', 'qty_per_unit', 'ignore'])).not.toThrow();
  });
});
