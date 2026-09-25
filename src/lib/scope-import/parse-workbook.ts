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
  /** Rows under the header with a company or a SKU missing. Blank rows are not data and are not counted. */
  skipped: number;
  /** Non-empty rows under the header, before dedup and skip. */
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

export function normalizeHeader(s: string): string {
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

export function tooManyRowsDetail(sheetName: string, rowCount: number, maxRows: number = MAX_IMPORT_ROWS): string {
  return `${sheetName} has ${rowCount.toLocaleString()} rows; the limit is ${maxRows.toLocaleString()}.`;
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

    // A sheet's used range routinely runs past its data — an ERP export's
    // dimension record, a formatted-but-empty block — and SheetJS materialises
    // every row inside it as all-empty cells. Those are not data rows: they
    // must not count toward the ceiling ("6,000 rows" on a 3-row file), toward
    // `skipped` ("9 rows skipped" on a clean file), or toward the totals. The
    // original index rides along so `row` stays the true 1-based sheet row.
    const dataRows = grid
      .slice(headerIdx + 1)
      .map((cells, i) => ({ cells, row: headerIdx + 2 + i }))
      .filter(({ cells }) => cells.some((c) => cellText(c).trim() !== ''));
    if (dataRows.length > maxRows) {
      return {
        ok: false,
        reason: 'too_many_rows',
        detail: tooManyRowsDetail(sheetName, dataRows.length, maxRows),
      };
    }

    const rows: ImportRow[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    for (const { cells, row } of dataRows) {
      const company = cellText(cells[companyCol]).trim().replace(/\s+/g, ' ');
      const sku = cellText(cells[skuCol]).trim();
      if (!company || !sku) {
        skipped += 1;
        continue;
      }
      const key = JSON.stringify([normalizeCompanyName(company), sku]);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ company, sku, row });
    }

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

// ---------------------------------------------------------------------------
// Sourcing Map upload wizard (spec §7.3). The wizard maps columns itself, so it
// needs every sheet's rows as displayed text, not company/SKU pairs. The
// ceilings, refusal sentences and SheetJS reading above are reused; parseWorkbook's
// behaviour is unchanged.

/** The rows the Map step offers as the header row (map-step.tsx); a title block above the header fits in them. */
export const HEADER_ROWS_OFFERED = 10;

/**
 * Columns the upload reader reads from a sheet (security L1). A declared range can be far wider than its data, and
 * the grid holds every declared cell. 256 is the legacy .xls sheet's own width, well past what an upload maps (its
 * targets plus one column per size; an axis holds at most 40), and keeps a full sheet's grid to about 1.3 million
 * cells. Columns past it are not offered on the Map step.
 */
export const MAX_IMPORT_COLUMNS = 256;

export interface SheetGrid {
  name: string;
  /** Non-blank rows; `row` is the 1-based sheet row the user sees. */
  rows: Array<{ row: number; cells: string[] }>;
}

export type SheetsOutcome =
  | { ok: true; sheets: SheetGrid[]; decimalComma: boolean }
  | { ok: false; reason: ParseRefusal; detail: string };

const LF = String.fromCharCode(10);

/**
 * A semicolon CSV is European Excel's, whose numbers use decimal commas
 * (Review Focus 1). SheetJS already picks the separator and drops a byte-order
 * mark, so only the locale is read here, from the header line.
 */
function semicolonHeader(bytes: ArrayBuffer): boolean {
  const text = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  const end = text.indexOf(LF);
  const header = end === -1 ? text : text.slice(0, end);
  return header.split(';').length > header.split(',').length;
}

interface RealExtent {
  /** The first row holding a cell through the last; the first column through the last, at most MAX_IMPORT_COLUMNS. */
  range: import('xlsx').Range;
  /** Each row holding a cell inside those columns, in sheet order: how many cells it holds. */
  filled: number[];
}

/**
 * Security L1 (controller ruling): the extent a sheet's cells really occupy, never its declared range. SheetJS takes a
 * sheet's range from its <dimension>, which can run far past the data, and the grid fills every cell of the range it
 * is given. Null when the sheet holds no cell.
 */
function realExtent(XLSX: typeof import('xlsx'), ws: import('xlsx').WorkSheet): RealExtent | null {
  const cells: Array<{ r: number; c: number }> = [];
  let firstCol = Infinity;
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue;
    const at = XLSX.utils.decode_cell(key);
    cells.push(at);
    firstCol = Math.min(firstCol, at.c);
  }
  if (cells.length === 0) return null;
  const ceilingCol = firstCol + MAX_IMPORT_COLUMNS - 1;
  const perRow = new Map<number, number>();
  let lastCol = firstCol;
  for (const { r, c } of cells) {
    if (c > ceilingCol) continue;
    perRow.set(r, (perRow.get(r) ?? 0) + 1);
    lastCol = Math.max(lastCol, c);
  }
  const rows = [...perRow.keys()].sort((a, b) => a - b);
  return {
    range: { s: { r: rows[0]!, c: firstCol }, e: { r: rows[rows.length - 1]!, c: lastCol } },
    filled: rows.map((r) => perRow.get(r)!),
  };
}

/** The header among a sheet's non-blank rows, from each one's count of filled cells: the first with two or more; 0 when none. */
function headerIndex(filled: readonly number[]): number {
  const i = filled.findIndex((n) => n >= 2);
  return i < 0 ? 0 : i;
}

export async function readWorkbookSheets(
  bytes: ArrayBuffer,
  opts: { fileName: string; maxBytes?: number; maxRows?: number },
): Promise<SheetsOutcome> {
  const maxBytes = opts.maxBytes ?? MAX_IMPORT_BYTES;
  const maxRows = opts.maxRows ?? MAX_IMPORT_ROWS;
  if (bytes.byteLength > maxBytes) {
    return { ok: false, reason: 'too_large', detail: tooLargeDetail(opts.fileName, bytes.byteLength, maxBytes) };
  }
  // Security L1: nothing is truncated, and no grid is built past the rows a sheet may keep: the data rows the ceiling
  // allows plus the header rows the Map step offers.
  const bound = maxRows + HEADER_ROWS_OFFERED;
  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try {
    wb = XLSX.read(new Uint8Array(bytes), { type: 'array', cellText: true, dateNF: 'yyyy-mm-dd' });
  } catch {
    return { ok: false, reason: 'unreadable', detail: unreadableDetail(opts.fileName) };
  }
  const sheets: SheetGrid[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const extent = realExtent(XLSX, ws);
    if (!extent) {
      sheets.push({ name, rows: [] });
      continue;
    }
    // spec §7.3: 5,000 data rows; the header, and any title row above it, do not count. Counted from the cells, so an
    // over-long sheet is refused with its true count before any grid is built.
    const dataRows = extent.filled.length - headerIndex(extent.filled) - 1;
    if (dataRows > maxRows) {
      return { ok: false, reason: 'too_many_rows', detail: tooManyRowsDetail(name, dataRows, maxRows) };
    }
    // A sparse sheet: few enough data rows, but its last one lies past the bound, and so would its grid.
    const { range } = extent;
    const span = range.e.r - range.s.r + 1;
    if (span > bound) {
      return { ok: false, reason: 'too_many_rows', detail: tooManyRowsDetail(name, span, maxRows) };
    }
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: true, range });
    const rows = grid
      .map((cells, i) => ({ row: range.s.r + i + 1, cells: cells.map(cellText) }))
      .filter((r) => r.cells.some((c) => c.trim() !== ''));
    sheets.push({ name, rows });
  }
  return { ok: true, sheets, decimalComma: /\.csv$/i.test(opts.fileName) && semicolonHeader(bytes) };
}

/** Index into `sheet.rows` of the header: the first row with at least two filled cells (the rule at :130); 0 when none. */
export function detectHeaderRow(sheet: SheetGrid): number {
  const i = sheet.rows.findIndex((r) => r.cells.filter((c) => c.trim() !== '').length >= 2);
  return i < 0 ? 0 : i;
}
