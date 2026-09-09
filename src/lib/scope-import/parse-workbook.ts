/**
 * Scope-from-document parser (HaiWeb v1.90 PR 1, spec §5).
 *
 * Runs in the browser. Turns a spreadsheet into (company, sku) pairs by finding
 * the first sheet whose header row has a company column and a SKU column, by
 * exact normalized synonym. Cells are read as displayed text so numeric SKUs
 * keep their leading zeros. Ceilings are enforced HERE, by name — the
 * framework never decides a limit and nothing is truncated silently.
 *
 * SheetJS is dynamically imported so the console's main bundle stays free of it.
 */

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export interface ImportRow {
  company: string;
  sku: string;
  /** 1-based sheet row, for the user's reference. */
  row: number;
}

export interface ParsedDocument {
  sheet: string;
  columns: { company: string; sku: string };
  rows: ImportRow[];
  skipped: number;
  totalDataRows: number;
}

export type ParseRefusal = 'too_large' | 'too_many_rows' | 'no_qualifying_sheet' | 'unreadable';

export type ParseOutcome =
  | { ok: true; document: ParsedDocument }
  | { ok: false; reason: ParseRefusal; detail: string };

const COMPANY_HEADERS = [
  'company name',
  'company',
  'supplier',
  'supplier name',
  'vendor',
  'vendor name',
  'manufacturer',
  'counterparty',
];
const SKU_HEADERS = [
  'product id',
  'sku',
  'part number',
  'part no',
  'part no.',
  'part #',
  'mpn',
  'item number',
  'item no',
  'product code',
  'vendor sku',
];

export function normalizeCompanyName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function normalizeHeader(s: string): string {
  return s
    .trim()
    .replace(/[*:]+$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function cellText(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function findColumn(headers: string[], synonyms: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (synonyms.includes(normalizeHeader(headers[i]))) return i;
  }
  return -1;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The two refusal sentences the panel also has to say — it checks `File.size`
 * BEFORE reading (a rejected read on an over-ceiling file would otherwise
 * strand it) and catches a failed read itself. Exported so there is exactly
 * one source of each sentence, never a duplicated format string.
 */
export function tooLargeDetail(fileName: string, byteLength: number, maxBytes: number = MAX_IMPORT_BYTES): string {
  return `${fileName} is ${formatMb(byteLength)}; the limit is ${Math.round(maxBytes / (1024 * 1024))} MB.`;
}

export function unreadableDetail(fileName: string): string {
  return `Could not read ${fileName} as a spreadsheet.`;
}

export async function parseWorkbook(
  bytes: ArrayBuffer,
  opts: { fileName?: string; maxBytes?: number; maxRows?: number } = {},
): Promise<ParseOutcome> {
  const fileName = opts.fileName ?? 'the file';
  const maxBytes = opts.maxBytes ?? MAX_IMPORT_BYTES;
  const maxRows = opts.maxRows ?? MAX_IMPORT_ROWS;

  if (bytes.byteLength > maxBytes) {
    return { ok: false, reason: 'too_large', detail: tooLargeDetail(fileName, bytes.byteLength, maxBytes) };
  }

  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try {
    wb = XLSX.read(new Uint8Array(bytes), { type: 'array', cellText: true });
  } catch {
    return { ok: false, reason: 'unreadable', detail: unreadableDetail(fileName) };
  }

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    // Displayed text (`raw: false`) so numeric SKUs arrive as the text the user sees.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
    const headerIdx = grid.findIndex((r) => r.filter((c) => cellText(c).trim() !== '').length >= 2);
    if (headerIdx < 0) continue;
    const headers = grid[headerIdx].map(cellText);
    const companyCol = findColumn(headers, COMPANY_HEADERS);
    const skuCol = findColumn(headers, SKU_HEADERS);
    if (companyCol < 0 || skuCol < 0) continue;

    const dataRows = grid.slice(headerIdx + 1);
    if (dataRows.length > maxRows) {
      return {
        ok: false,
        reason: 'too_many_rows',
        detail: `${sheetName} has ${dataRows.length.toLocaleString()} rows; the limit is ${maxRows.toLocaleString()}.`,
      };
    }

    const rows: ImportRow[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    dataRows.forEach((r, i) => {
      const company = cellText(r[companyCol]).trim().replace(/\s+/g, ' ');
      const sku = cellText(r[skuCol]).trim();
      if (!company || !sku) {
        skipped += 1;
        return;
      }
      const key = JSON.stringify([normalizeCompanyName(company), sku]);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ company, sku, row: headerIdx + 2 + i });
    });

    return {
      ok: true,
      document: {
        sheet: sheetName,
        columns: { company: headers[companyCol].trim(), sku: headers[skuCol].trim() },
        rows,
        skipped,
        totalDataRows: dataRows.length,
      },
    };
  }

  return {
    ok: false,
    reason: 'no_qualifying_sheet',
    detail:
      'No sheet has both a company column and a SKU column. Looked for headers like Company Name / Supplier / Vendor and Product ID / SKU / Part Number.',
  };
}
