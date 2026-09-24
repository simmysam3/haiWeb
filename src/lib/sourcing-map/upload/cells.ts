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

/** Excel's day zero for 1900-system serials (it counts the phantom 1900-02-29, so day 0 is 1899-12-30). */
const EXCEL_DAY_ZERO = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

function isoDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * A due date from displayed text (Review Focus 4): ISO "2027-03-15", US
 * "3/15/2027" or "3/15/27", or an Excel serial (a date cell without a date
 * format shows as "46402"). Serials outside 20000–80000 (1954–2119) are refused.
 */
export function parseSheetDate(text: string): string | null {
  const t = text.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (m) return isoDate(m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[1]), Number(m[2]));
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const serial = Math.floor(Number(t));
    if (serial >= 20000 && serial <= 80000) return new Date(EXCEL_DAY_ZERO + serial * DAY_MS).toISOString().slice(0, 10);
  }
  return null;
}
