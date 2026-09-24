/** Cell parsers for the Sourcing Map upload wizard (spec §7.3). All take displayed text. */

/**
 * A number from displayed text. A semicolon CSV (decimalComma) writes
 * "1.234,5"; everything else writes "1,234.5". A lone "0.25" reads as 0.25
 * in both. Whitespace (including a non-breaking space) is ignored.
 */
export function parseQty(text: string, decimalComma: boolean): number | null {
  let t = text.replace(/\s+/g, '');
  if (t === '') return null;
  t = decimalComma && t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
