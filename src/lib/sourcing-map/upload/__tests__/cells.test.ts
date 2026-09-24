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

  it('parseSheetDate reads ISO, US and Excel serial dates and refuses the rest (Review Focus 4)', () => {
    expect(parseSheetDate('2027-03-15')).toBe('2027-03-15');
    expect(parseSheetDate('2027-3-5')).toBe('2027-03-05');
    expect(parseSheetDate('3/15/2027')).toBe('2027-03-15');
    expect(parseSheetDate('3/15/27')).toBe('2027-03-15');
    expect(parseSheetDate('46402')).toBe('2027-01-15');
    expect(parseSheetDate('46402.5')).toBe('2027-01-15');
    expect(parseSheetDate('13/15/2027')).toBeNull();
    expect(parseSheetDate('2/30/2027')).toBeNull();
    expect(parseSheetDate('12345')).toBeNull();
    expect(parseSheetDate('soon')).toBeNull();
  });

  it('matchVariantHeader maps sizes written as other numbers and refuses sizes not on the axis (Review Focus 2)', () => {
    expect(matchVariantHeader('9', MENS_US_7_13)).toBe('9');
    expect(matchVariantHeader('9.0', MENS_US_7_13)).toBe('9');
    expect(matchVariantHeader('9,5', MENS_US_7_13)).toBe('9.5');
    expect(matchVariantHeader(' 13 ', MENS_US_7_13)).toBe('13');
    expect(matchVariantHeader('14', MENS_US_7_13)).toBeNull();
    expect(matchVariantHeader('Qty', MENS_US_7_13)).toBeNull();
    expect(matchVariantHeader('US 9', MENS_US_7_13)).toBeNull();
    expect(matchVariantHeader('m', ['S', 'M', 'L'])).toBe('M');
  });
});
