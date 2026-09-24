import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readWorkbookSheets, detectHeaderRow, tooLargeDetail, tooManyRowsDetail } from '../parse-workbook';

const NL = String.fromCharCode(10);
const BOM = String.fromCharCode(0xfeff);

function xlsx(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
function csv(text: string): ArrayBuffer {
  const u = new TextEncoder().encode(text);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

describe('readWorkbookSheets (Sourcing Map upload, spec §7.3)', () => {
  it('returns every sheet as displayed text with 1-based sheet rows, blank rows dropped', async () => {
    const out = await readWorkbookSheets(
      xlsx({ Notes: [['Readme']], BOM: [['Description', 'Usage'], [], ['Upper leather', 0.25]] }),
      { fileName: 'bom.xlsx' },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.sheets.map((s) => s.name)).toEqual(['Notes', 'BOM']);
    expect(out.sheets[1]!.rows).toEqual([
      { row: 1, cells: ['Description', 'Usage'] },
      { row: 3, cells: ['Upper leather', '0.25'] },
    ]);
    expect(out.decimalComma).toBe(false);
  });

  it('detects the header as the first row with two or more filled cells (the parseWorkbook rule)', () => {
    const sheet = {
      name: 'BOM',
      rows: [
        { row: 1, cells: ['Acme BOM export', '', ''] },
        { row: 2, cells: ['Description', 'Usage', 'UOM'] },
        { row: 3, cells: ['Upper leather', '0.25', 'sq ft'] },
      ],
    };
    expect(detectHeaderRow(sheet)).toBe(1);
    expect(detectHeaderRow({ name: 'x', rows: [{ row: 1, cells: ['only'] }] })).toBe(0);
  });

});
