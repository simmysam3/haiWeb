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

  it('passes over a sheet with no qualifying header and never lets Company Key or Product Name steal the column', async () => {
    const bytes = workbook({
      README: [
        ['Airbus / Pratt & Whitney demo — product flat file'],
        ['Sheet', 'Purpose'],
        ['Products', 'one row per product'],
      ],
      Products: [
        ['Company Key', 'Company Name', 'Product Name', 'Product ID'],
        ['pw', 'Pratt & Whitney (Demo)', 'EEC', '5328285'],
      ],
    });
    const out = await parseWorkbook(bytes);
    expect(out.ok && out.document.sheet).toBe('Products');
    expect(out.ok && out.document.columns).toEqual({ company: 'Company Name', sku: 'Product ID' });
    expect(out.ok && out.document.rows[0]).toEqual({ company: 'Pratt & Whitney (Demo)', sku: '5328285', row: 2 });
  });

  it('accepts Supplier + Part Number as the company and SKU columns', async () => {
    const bytes = workbook({
      Sheet1: [
        ['Supplier', 'Part Number', 'Qty'],
        ['Acme Metals', 'AM-100', 4],
      ],
    });
    const out = await parseWorkbook(bytes);
    expect(out.ok && out.document.columns).toEqual({ company: 'Supplier', sku: 'Part Number' });
    expect(out.ok && out.document.rows).toEqual([{ company: 'Acme Metals', sku: 'AM-100', row: 2 }]);
  });
});

describe('parseWorkbook — cell text', () => {
  it('reads numeric SKUs as their displayed text, keeping leading zeros', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Company', 'SKU'],
      ['Acme', 5328285],
      ['Acme', 7],
    ]);
    // Format the second data cell as 000 so it displays as 007.
    const cell = ws['B3'] as XLSX.CellObject;
    cell.z = '000';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const out = await parseWorkbook(bytes);
    expect(out.ok && out.document.rows.map((r) => r.sku)).toEqual(['5328285', '007']);
  });
});

describe('parseWorkbook — rows', () => {
  it('counts rows lacking a company or a SKU as skipped and keeps a duplicate pair once', async () => {
    const bytes = workbook({
      S: [
        ['Company', 'SKU'],
        ['Acme', 'A-1'],
        ['', 'A-2'],
        ['Acme', ''],
        ['  acme ', 'A-1'],
        ['Acme', 'A-3'],
      ],
    });
    const out = await parseWorkbook(bytes);
    expect(out.ok && out.document.rows).toEqual([
      { company: 'Acme', sku: 'A-1', row: 2 },
      { company: 'Acme', sku: 'A-3', row: 6 },
    ]);
    expect(out.ok && out.document.skipped).toBe(2);
    expect(out.ok && out.document.totalDataRows).toBe(5);
  });
});

describe('parseWorkbook — refusals name the ceiling', () => {
  it('refuses a file over the byte ceiling before reading it', async () => {
    const out = await parseWorkbook(new ArrayBuffer(MAX_IMPORT_BYTES + 1), { fileName: 'big.xlsx' });
    expect(out).toEqual({
      ok: false,
      reason: 'too_large',
      detail: 'big.xlsx is 10.0 MB; the limit is 10 MB.',
    });
  });

  it('refuses a sheet with more data rows than the ceiling, naming the sheet', async () => {
    const rows: unknown[][] = [['Company', 'SKU']];
    for (let i = 0; i < 6; i++) rows.push(['Acme', `A-${i}`]);
    const out = await parseWorkbook(workbook({ Products: rows }), { maxRows: 5 });
    expect(out).toEqual({
      ok: false,
      reason: 'too_many_rows',
      detail: 'Products has 6 rows; the limit is 5.',
    });
  });

  it('refuses when no sheet has both columns, saying what it looked for', async () => {
    const out = await parseWorkbook(workbook({ S: [['Name', 'Price'], ['x', 1]] }));
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('no_qualifying_sheet');
    expect(!out.ok && out.detail).toMatch(/Company Name \/ Supplier \/ Vendor/);
    expect(!out.ok && out.detail).toMatch(/Product ID \/ SKU \/ Part Number/);
  });

  it('refuses bytes that are not a spreadsheet', async () => {
    const out = await parseWorkbook(new TextEncoder().encode('%PDF-1.4 not a sheet').buffer as ArrayBuffer, {
      fileName: 'x.pdf',
    });
    expect(out.ok).toBe(false);
    // SheetJS parses unknown bytes as a one-cell text sheet instead of throwing, so this
    // falls through to `no_qualifying_sheet` rather than `unreadable` — either is a refusal.
    expect(['unreadable', 'no_qualifying_sheet']).toContain(!out.ok && out.reason);
  });

  it('enforces the default row ceiling at 5,001 rows', async () => {
    const rows: unknown[][] = [['Company', 'SKU']];
    for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) rows.push(['Acme', `A-${i}`]);
    const out = await parseWorkbook(workbook({ Products: rows }));
    expect(!out.ok && out.reason).toBe('too_many_rows');
    expect(!out.ok && out.detail).toBe('Products has 5,001 rows; the limit is 5,000.');
  });
});

describe('parseWorkbook — csv', () => {
  it('reads a .csv through the same path', async () => {
    const csv = 'Vendor,Item Number\nAcme,A-1\nBolt Co,B-2\n';
    const out = await parseWorkbook(new TextEncoder().encode(csv).buffer as ArrayBuffer, { fileName: 'list.csv' });
    expect(out.ok && out.document.rows).toEqual([
      { company: 'Acme', sku: 'A-1', row: 2 },
      { company: 'Bolt Co', sku: 'B-2', row: 3 },
    ]);
  });
});
