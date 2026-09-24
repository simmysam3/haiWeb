import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readWorkbookSheets, detectHeaderRow, MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS, tooLargeDetail, tooManyRowsDetail } from '../parse-workbook';

const NL = String.fromCharCode(10);
const BOM = String.fromCharCode(0xfeff);

function xlsx(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
/**
 * A workbook whose sheet declares `ref` as its range (the file's <dimension>), whatever cells it really holds: `rows`
 * from A1, plus `cells` placed by address.
 */
function declared(rows: unknown[][], ref: string, cells: Record<string, XLSX.CellObject> = {}): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  Object.assign(ws, cells);
  ws['!ref'] = ref;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOM');
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

  it('reads an Excel "CSV UTF-8" (byte-order mark, semicolons, decimal commas) exactly like the comma file', async () => {
    const comma = await readWorkbookSheets(csv(['Component,Qty per unit,UOM', 'Upper leather,0.25,sq ft'].join(NL)), { fileName: 'bom.csv' });
    const euro = await readWorkbookSheets(csv(BOM + ['Component;Qty per unit;UOM', 'Upper leather;0,25;sq ft'].join(NL)), { fileName: 'bom.csv' });
    expect(comma.ok && euro.ok).toBe(true);
    if (!comma.ok || !euro.ok) return;
    expect(euro.sheets[0]!.rows[0]!.cells).toEqual(['Component', 'Qty per unit', 'UOM']);
    expect(euro.sheets[0]!.rows[0]!.cells).toEqual(comma.sheets[0]!.rows[0]!.cells);
    expect(euro.sheets[0]!.rows[1]!.cells).toEqual(['Upper leather', '0,25', 'sq ft']);
    expect(euro.decimalComma).toBe(true);
    expect(comma.decimalComma).toBe(false);
  });

  it('refuses an over-size file and an over-long sheet with parse-workbook’s own sentences, counting data rows under the header', async () => {
    const big = xlsx({ BOM: [['Description', 'Usage'], ['a', 1]] });
    const tooBig = await readWorkbookSheets(big, { fileName: 'big.xlsx', maxBytes: 10 });
    expect(tooBig).toEqual({ ok: false, reason: 'too_large', detail: tooLargeDetail('big.xlsx', big.byteLength, 10) });
    const long = await readWorkbookSheets(xlsx({ BOM: [['Description', 'Usage'], ['a', 1], ['b', 2], ['c', 3]] }), { fileName: 'long.xlsx', maxRows: 2 });
    expect(long).toEqual({ ok: false, reason: 'too_many_rows', detail: tooManyRowsDetail('BOM', 3, 2) });
    expect(tooManyRowsDetail('BOM', 3, 2)).toBe('BOM has 3 rows; the limit is 2.');
    // A title row above the header is not data (D15): two data rows fit a ceiling of 2.
    const titled = await readWorkbookSheets(xlsx({ BOM: [['Acme BOM export'], ['Description', 'Usage'], ['a', 1], ['b', 2]] }), { fileName: 't.xlsx', maxRows: 2 });
    expect(titled.ok).toBe(true);
  });


  it('refuses a small workbook that declares a huge sheet from its declared size, never expanding it first (security L1)', async () => {
    // Two real rows under a declared 200,000 x 26 range: expanded, it is 200,000 rows before the blank-row filter.
    const crafted = declared([['Description', 'Usage'], ['Upper leather', 0.25]], 'A1:Z200000');
    expect(crafted.byteLength).toBeLessThan(20_000);
    const out = await readWorkbookSheets(crafted, { fileName: 'crafted.xlsx' });
    expect(out).toEqual({ ok: false, reason: 'too_many_rows', detail: tooManyRowsDetail('BOM', 200_000, MAX_IMPORT_ROWS) });
  });

  it('refuses a CSV longer than the rows it reads and names its real length, never keeping only its first rows (security L1)', async () => {
    // Data rows sit past a run of blank lines: a reader that stopped early and kept going would drop them silently.
    const lines = ['Description,Usage', 'a,1', 'b,2', ...Array.from({ length: 14 }, () => ''), 'c,3', 'd,4', 'e,5'];
    const out = await readWorkbookSheets(csv(lines.join(NL)), { fileName: 'long.csv', maxRows: 4 });
    expect(out).toEqual({ ok: false, reason: 'too_many_rows', detail: tooManyRowsDetail('Sheet1', lines.length, 4) });
  });

  it('reads at most the column ceiling of a sheet whose data runs far wider, keeping the data inside it (security L1)', async () => {
    // Real values in the ceiling's last column (IV, the 256th) and in the sheet's last (XFD, the 16,384th): read in
    // full, every row would carry 16,384 cells.
    const wide = declared([['Description', 'Usage'], ['Upper leather', 0.25]], 'A1:XFD2', {
      IV1: { t: 's', v: 'Last read' },
      XFD1: { t: 's', v: 'Past the ceiling' },
    });
    const out = await readWorkbookSheets(wide, { fileName: 'wide.xlsx' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const [header, data] = out.sheets[0]!.rows;
    expect(header!.cells).toHaveLength(MAX_IMPORT_COLUMNS);
    expect(header!.cells[MAX_IMPORT_COLUMNS - 1]).toBe('Last read');
    expect(out.sheets[0]!.rows.flatMap((r) => r.cells)).not.toContain('Past the ceiling');
    expect(header!.cells.slice(0, 2)).toEqual(['Description', 'Usage']);
    expect(data!.cells.slice(0, 2)).toEqual(['Upper leather', '0.25']);
  });
});

