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

/** A share in percent. "60", "60%" and "0.6" all mean 60; a bare value ≤ 1 is a fraction. */
export function parseShare(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const pct = t.endsWith('%');
  const body = pct ? t.slice(0, -1) : t;
  const n = parseQty(body, body.includes(',') && !body.includes('.'));
  if (n === null || n <= 0) return null;
  const v = pct || n > 1 ? n : n * 100;
  return v > 100 ? null : Math.round(v * 100) / 100;
}
