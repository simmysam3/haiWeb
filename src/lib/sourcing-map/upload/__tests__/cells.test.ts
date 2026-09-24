import { describe, it, expect } from 'vitest';
import { parseQty, parseShare, parseSheetDate, matchVariantHeader } from '../cells';
import { MENS_US_7_13 } from '../../__fixtures__/vomero';

describe('upload cell parsers', () => {
  it('parseQty reads decimals and thousands in both locales', () => {
    expect(parseQty('0.25', false)).toBe(0.25);
    expect(parseQty(' 12 ', false)).toBe(12);
    expect(parseQty('1,234.5', false)).toBe(1234.5);
    expect(parseQty('0,25', true)).toBe(0.25);
    expect(parseQty('1.234,5', true)).toBe(1234.5);
    expect(parseQty('0.25', true)).toBe(0.25);
    expect(parseQty('two', false)).toBeNull();
    expect(parseQty('', false)).toBeNull();
  });

  it('parseShare reads a percentage or a fraction and refuses anything outside (0, 100]', () => {
    expect(parseShare('60')).toBe(60);
    expect(parseShare('60%')).toBe(60);
    expect(parseShare('0.6')).toBe(60);
    expect(parseShare('1')).toBe(100);
    expect(parseShare('33,33%')).toBe(33.33);
    expect(parseShare('150')).toBeNull();
    expect(parseShare('0')).toBeNull();
    expect(parseShare('x')).toBeNull();
  });
});
