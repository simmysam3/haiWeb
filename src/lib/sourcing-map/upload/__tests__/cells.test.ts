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
});
