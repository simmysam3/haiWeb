import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from '../parse-workbook';

/** Build an .xlsx in memory from named sheets of row arrays. */
function workbook(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

describe('parseWorkbook — sheet and column detection', () => {
  it('reads company/SKU pairs from the first sheet whose header has both columns', async () => {
    const bytes = workbook({
      Products: [
        ['Company Key', 'Company Name', 'Product ID', 'Product Name'],
        ['pw', 'Pratt & Whitney (Demo)', '5328285', 'EEC'],
        ['pw', 'Pratt & Whitney (Demo)', '5331092', 'EEC 6.2'],
        ['thales', 'Thales Avionics (Demo)', 'TA-EIU-RACK-01', 'Rack'],
      ],
    });
    const out = await parseWorkbook(bytes);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.document.sheet).toBe('Products');
    expect(out.document.columns).toEqual({ company: 'Company Name', sku: 'Product ID' });
    expect(out.document.rows).toEqual([
      { company: 'Pratt & Whitney (Demo)', sku: '5328285', row: 2 },
      { company: 'Pratt & Whitney (Demo)', sku: '5331092', row: 3 },
      { company: 'Thales Avionics (Demo)', sku: 'TA-EIU-RACK-01', row: 4 },
    ]);
    expect(out.document.skipped).toBe(0);
    expect(out.document.totalDataRows).toBe(3);
  });
});
