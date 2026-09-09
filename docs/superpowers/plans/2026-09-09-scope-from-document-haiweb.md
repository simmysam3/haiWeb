# Scope from document (HaiWeb) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload a spreadsheet in the watcher / audit Scope step, see which of its companies are not on the HAIWAVE network, pick a target company, and have every file SKU that exists in that company's catalog checked exactly as if hand-checked.

**Architecture:** Everything is console-side. A pure parser (SheetJS, browser) turns the file into company/SKU pairs; a pure classifier sorts the companies using the existing partners / directory / profile BFF routes; a new `ScopeImportPanel` renders above the shared `BilateralCounterpartiesSkusFields` tree and hands it an `importRequest`; the tree loads the counterparty's catalog through its own `loadCatalog` and checks the matches through its own `applySelection` path, so the emitted scope is byte-for-byte a hand-checked one. No new API route, no haiCore change.

**Tech Stack:** Next.js 16 (App Router, `'use client'` components), React 19, TypeScript strict, Tailwind v4, vitest 4.1.4 + jsdom 29 + Testing Library, SheetJS CE `xlsx` 0.20.3 (cdn.sheetjs.com tarball).

**Spec:** `docs/superpowers/specs/2026-09-09-scope-from-document-design.md` (this plan argues from it; read it first).

## Global Constraints

- Worktree: `/Users/samfleming/dev/hw/haiWeb-scope-from-document`, branch `scope-from-document`, base `origin/master` = `af82dc64`. Run every command from the worktree. Never touch `~/dev/hw/haiWeb` (the primary; `:3002` serves its `.next`).
- Release label: **HaiWeb v1.90 PR 1** (owner's word 2026-09-09). HaiWeb has no CHANGELOG file; the label lives in commit subjects and the PR title, exactly as the v1.89 lane did (`v1.89 — users: …`). Feature commit subjects start `v1.90 — sonar: `. `package.json` `version` stays `0.1.0`.
- Dependency: exactly `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` (the pin `../haiClient/packages/reference-agent/package.json` carries; SBOM 2026-09-08 row 950; 0 transitive deps). Loaded by dynamic `import('xlsx')` only. No other new dependency — a second one is a STOP (message agent1 `hw-48`).
- Ceilings, named in code and tested: `MAX_IMPORT_BYTES = 10 * 1024 * 1024`, `MAX_IMPORT_ROWS = 5000`. Refused in place, naming the ceiling. Nothing truncated silently.
- No new API route (the repo-wide `src/__tests__/bff-mutations-are-role-gated.test.ts` must stay untouched). No haiCore / protocol change (STOP if one appears). No `any`; `unknown` + narrow. `kebab-case` filenames, `camelCase` TS, `snake_case` only for wire bodies.
- Copy: informational lines are prose in `text-slate`, never a `<Pill>`; no drill-down rows, so no `<DetailChevron>`. Failures are said in place inside the panel; none blocks manual checking.
- Tests: colocated `__tests__/`, `vi.stubGlobal('fetch', …)` dispatch on URL, `afterEach(() => vi.unstubAllGlobals())`. Run single files with `npx vitest run <path>`; the full gate ONLY through `~/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3` (vitest 4.1.4: `--minWorkers` aborts with CACError). Control on af82dc64 = 376 files / 2389 tests (agent1, 2026-09-09).
- TDD per `~/.claude/CLAUDE.md`: every behaviour RED first, one red at a time, show each red → green. Commit after each green.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

| file | responsibility | task |
|---|---|---|
| `package.json`, `package-lock.json` | the `xlsx` pin | 1 |
| `src/lib/scope-import/parse-workbook.ts` | bytes → `ParseOutcome` (pure) | 1 |
| `src/lib/scope-import/__tests__/parse-workbook.test.ts` | parser tests, workbooks built in-test | 1 |
| `src/lib/scope-import/classify-companies.ts` | `ParsedDocument` + lookups → `CompanyClassification[]` (pure) | 2 |
| `src/lib/scope-import/__tests__/classify-companies.test.ts` | | 2 |
| `src/lib/scope-import/import-copy.ts` | every sentence the panel says, as pure functions | 3 |
| `src/lib/scope-import/__tests__/import-copy.test.ts` | | 3 |
| `src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx` | `onOptionsLoaded`, `importRequest`, `onImportResult` | 4 |
| `src/app/account/sonar/_components/__tests__/bilateral-counterparties-skus-fields.import.test.tsx` | | 4 |
| `src/app/account/sonar/_components/scope-import-panel.tsx` | file input → parse → classify → select → summaries | 5 |
| `src/app/account/sonar/_components/__tests__/scope-import-panel.test.tsx` | | 5 |
| `src/app/account/sonar/watchers/new/_components/watcher-scope-picker.tsx` | mount panel + tree, hold import state | 6 |
| `src/app/account/sonar/_components/audit-scope-picker.tsx` | same, bilateral branch only | 6 |
| the two pickers' existing `__tests__` files | end-to-end picker tests | 6 |
| `docs/superpowers/specs/2026-09-09-scope-from-document-design.md` §7–8 | amended to the two-effect design of Task 4 | 4 |

Shared types live in `parse-workbook.ts` (`ImportRow`, `ParsedDocument`, `ParseOutcome`) and `classify-companies.ts` (`Membership`, `CompanyClassification`); the tree component exports `ImportRequest` and `ImportResult`.

---

### Task 1: Dependency + the parser

**Files:**
- Modify: `package.json` (dependencies), `package-lock.json` (via npm)
- Create: `src/lib/scope-import/parse-workbook.ts`
- Test: `src/lib/scope-import/__tests__/parse-workbook.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
  export const MAX_IMPORT_ROWS = 5000;
  export interface ImportRow { company: string; sku: string; row: number }        // row = 1-based sheet row
  export interface ParsedDocument {
    sheet: string;
    columns: { company: string; sku: string };
    rows: ImportRow[];          // deduplicated on (normalizeCompanyName(company), sku), sheet order
    skipped: number;            // data rows lacking company or sku
    totalDataRows: number;      // rows under the header before skip/dedupe
  }
  export type ParseRefusal = 'too_large' | 'too_many_rows' | 'no_qualifying_sheet' | 'unreadable';
  export type ParseOutcome =
    | { ok: true; document: ParsedDocument }
    | { ok: false; reason: ParseRefusal; detail: string };
  export function normalizeCompanyName(s: string): string;   // trim, collapse whitespace, toLocaleLowerCase
  export async function parseWorkbook(
    bytes: ArrayBuffer,
    opts?: { fileName?: string; maxBytes?: number; maxRows?: number },
  ): Promise<ParseOutcome>;
  ```

- [ ] **Step 1: Install the pinned dependency**

```bash
cd /Users/samfleming/dev/hw/haiWeb-scope-from-document
npm install --save-exact "xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz" --no-audit --no-fund
grep -n '"xlsx"' package.json
grep -n -A3 '"node_modules/xlsx"' package-lock.json
```
Expected: `package.json` has `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`; the lock entry has `"version": "0.20.3"`, `"resolved": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`, `"integrity": "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA=="` (the same integrity haiClient's lock carries). If npm rewrote the spec to a caret range, fix `package.json` back to the URL string by hand and re-run `npm install`.

- [ ] **Step 2: Write the first failing test — a qualifying sheet yields rows**

Create `src/lib/scope-import/__tests__/parse-workbook.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it — RED**

```bash
npx vitest run src/lib/scope-import/__tests__/parse-workbook.test.ts
```
Expected: FAIL — `Failed to resolve import "../parse-workbook"`.

- [ ] **Step 4: Minimal parser**

Create `src/lib/scope-import/parse-workbook.ts`:

```ts
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

export async function parseWorkbook(
  bytes: ArrayBuffer,
  opts: { fileName?: string; maxBytes?: number; maxRows?: number } = {},
): Promise<ParseOutcome> {
  const fileName = opts.fileName ?? 'the file';
  const maxBytes = opts.maxBytes ?? MAX_IMPORT_BYTES;
  const maxRows = opts.maxRows ?? MAX_IMPORT_ROWS;

  if (bytes.byteLength > maxBytes) {
    return {
      ok: false,
      reason: 'too_large',
      detail: `${fileName} is ${formatMb(bytes.byteLength)}; the limit is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    };
  }

  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try {
    wb = XLSX.read(new Uint8Array(bytes), { type: 'array', cellText: true });
  } catch {
    return { ok: false, reason: 'unreadable', detail: `Could not read ${fileName} as a spreadsheet.` };
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
      const key = `${normalizeCompanyName(company)} ${sku}`;
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
```

- [ ] **Step 5: Run — GREEN**

```bash
npx vitest run src/lib/scope-import/__tests__/parse-workbook.test.ts
```
Expected: PASS (1 test).

- [ ] **Step 6: Commit the dependency + first green**

```bash
git add package.json package-lock.json src/lib/scope-import/parse-workbook.ts src/lib/scope-import/__tests__/parse-workbook.test.ts
git commit -m "v1.90 — sonar: scope-from-document parser reads company/SKU pairs from the first qualifying sheet

Adds SheetJS xlsx 0.20.3 from the cdn.sheetjs.com tarball — the exact pin
packages/reference-agent already carries (SBOM 2026-09-08 row 950, zero
transitive deps): one direct declaration, zero new SBOM components.
Dynamically imported so the console's main bundle stays free of it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 7: RED — a README sheet before the data sheet is passed over, and `Company Key` does not steal from `Company Name`**

Append to the first `describe`:

```ts
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
```

Run: `npx vitest run src/lib/scope-import/__tests__/parse-workbook.test.ts` — Expected: PASS already (exact-equality synonyms). **This is a calibration test, not a red**: temporarily change `synonyms.includes(normalizeHeader(headers[i]))` to `synonyms.some((s) => normalizeHeader(headers[i]).includes(s))` in `findColumn`, run, confirm it FAILS (`Company Key` wins as `company`), then restore. Record the calibration in the commit message.

- [ ] **Step 8: RED — synonyms**

```ts
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
```
Run — Expected: PASS (already covered by the synonym list). Keep it as the pin on the synonym table.

- [ ] **Step 9: RED — numeric SKUs keep their displayed text**

```ts
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
```
Run — Expected: PASS if `raw: false` + `cellText: true` produce `007`; if it FAILS with `'7'`, the fix is in `parseWorkbook`: read with `XLSX.read(..., { type: 'array', cellText: true, cellNF: true })` and, for each cell, prefer `ws[addr].w` — implement by replacing the `sheet_to_json` call with `XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', rawNumbers: false })`. Re-run until green; keep whichever minimal change makes it pass.

- [ ] **Step 10: RED — skipped rows and duplicates**

```ts
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
```
Run — Expected: PASS (implemented in Step 4). It pins the behaviour.

- [ ] **Step 11: RED — refusals**

```ts
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
    expect(!out.ok && out.reason).toBe('unreadable');
  });

  it('enforces the default row ceiling at 5,001 rows', async () => {
    const rows: unknown[][] = [['Company', 'SKU']];
    for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) rows.push(['Acme', `A-${i}`]);
    const out = await parseWorkbook(workbook({ Products: rows }));
    expect(!out.ok && out.reason).toBe('too_many_rows');
    expect(!out.ok && out.detail).toBe('Products has 5,001 rows; the limit is 5,000.');
  });
});
```
Run — Expected: the `too_large` detail test may FAIL on the exact MB string (`10.0 MB` for 10 MiB + 1 byte). If so, keep the test and fix `formatMb` to match (it is the spec's format, one decimal). `unreadable` may FAIL if SheetJS reads arbitrary bytes as a one-cell CSV instead of throwing — then the test's expectation is **wrong about the mechanism, right about the outcome**: the correct assertion is that the outcome is a refusal; change it to `expect(!out.ok && ['unreadable', 'no_qualifying_sheet']).toContain(out.reason)` and note in the code comment that SheetJS parses unknown bytes as text. Re-run to GREEN.

- [ ] **Step 12: RED — CSV input**

```ts
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
```
Run — Expected: PASS (SheetJS sniffs CSV). If FAIL, pass `{ type: 'array', cellText: true, raw: false }` unchanged and check the sheet name (`Sheet1`); adjust the assertion only on `sheet`, never on `rows`.

- [ ] **Step 13: Full parser file green + commit**

```bash
npx vitest run src/lib/scope-import/__tests__/parse-workbook.test.ts
git add src/lib/scope-import
git commit -m "v1.90 — sonar: parser pins synonyms, displayed-text SKUs, skipped/duplicate rows, csv, and the named ceilings (10 MiB / 5,000 rows)

Calibrated: the Company Key / Product Name test fails under a substring
synonym match and passes under exact normalized equality.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Company classifier

**Files:**
- Create: `src/lib/scope-import/classify-companies.ts`
- Test: `src/lib/scope-import/__tests__/classify-companies.test.ts`

**Interfaces:**
- Consumes: `ParsedDocument`, `normalizeCompanyName` from `./parse-workbook`.
- Produces:
  ```ts
  export type Membership = 'pickable' | 'on_network_unconnected' | 'not_on_network' | 'unverified' | 'self';
  export interface CompanyClassification {
    name: string;              // first spelling seen in the file
    membership: Membership;
    counterpartyId?: string;   // pickable only
    skus: string[];            // this company's file SKUs, file order, deduplicated
  }
  export interface UniverseOption { counterparty_id: string; counterparty_legal_name: string }
  export type DirectoryLookup = (name: string) => Promise<Array<{ company_name: string }>>;
  export function groupByCompany(doc: ParsedDocument): Array<{ name: string; skus: string[] }>;
  export async function classifyCompanies(
    doc: ParsedDocument,
    ctx: { universe: UniverseOption[]; selfNames: string[]; lookup: DirectoryLookup; concurrency?: number },
  ): Promise<CompanyClassification[]>;
  ```

- [ ] **Step 1: RED — grouping + pickable / not-on-network**

Create `src/lib/scope-import/__tests__/classify-companies.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { ParsedDocument } from '../parse-workbook';
import { classifyCompanies, groupByCompany } from '../classify-companies';

function doc(pairs: Array<[string, string]>): ParsedDocument {
  return {
    sheet: 'Products',
    columns: { company: 'Company Name', sku: 'Product ID' },
    rows: pairs.map(([company, sku], i) => ({ company, sku, row: i + 2 })),
    skipped: 0,
    totalDataRows: pairs.length,
  };
}

const PW = { counterparty_id: 'cp-pw', counterparty_legal_name: 'Pratt & Whitney (Demo)' };

describe('groupByCompany', () => {
  it('groups SKUs under the first spelling of each normalized company name, in file order', () => {
    expect(
      groupByCompany(doc([['Acme', 'A-1'], ['  ACME', 'A-2'], ['Bolt Co', 'B-1'], ['Acme', 'A-1']])),
    ).toEqual([
      { name: 'Acme', skus: ['A-1', 'A-2'] },
      { name: 'Bolt Co', skus: ['B-1'] },
    ]);
  });
});

describe('classifyCompanies', () => {
  it('marks a universe counterparty pickable without a lookup, and an unknown name not on the network', async () => {
    const lookup = vi.fn(async () => []);
    const out = await classifyCompanies(doc([['Pratt & Whitney (Demo)', '5328285'], ['Meridian Aerospace Fasteners', 'MAF-1']]), {
      universe: [PW],
      selfNames: [],
      lookup,
    });
    expect(out).toEqual([
      { name: 'Pratt & Whitney (Demo)', membership: 'pickable', counterpartyId: 'cp-pw', skus: ['5328285'] },
      { name: 'Meridian Aerospace Fasteners', membership: 'not_on_network', skus: ['MAF-1'] },
    ]);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('Meridian Aerospace Fasteners');
  });
});
```

- [ ] **Step 2: Run — RED**

`npx vitest run src/lib/scope-import/__tests__/classify-companies.test.ts` — Expected: FAIL, cannot resolve `../classify-companies`.

- [ ] **Step 3: Minimal classifier**

Create `src/lib/scope-import/classify-companies.ts`:

```ts
/**
 * Scope-from-document membership classification (spec §6). Pure over injected
 * lookups so it is unit-tested without React or fetch.
 *
 * Rules, per distinct normalized company name, in file order:
 *  1. one of selfNames                          → 'self' (omitted from every line)
 *  2. a universe counterparty's legal name      → 'pickable'
 *  3. directory lookup returns an exact name    → 'on_network_unconnected'
 *  4. otherwise                                 → 'not_on_network'
 *  5. the lookup threw                          → 'unverified' (never a false claim)
 * Owner ruling R3 (2026-09-09): haiCore's search returns active participants
 * only, so a suspended participant reads as not_on_network. Accepted.
 */
import { normalizeCompanyName, type ParsedDocument } from './parse-workbook';

export type Membership = 'pickable' | 'on_network_unconnected' | 'not_on_network' | 'unverified' | 'self';

export interface CompanyClassification {
  name: string;
  membership: Membership;
  counterpartyId?: string;
  skus: string[];
}

export interface UniverseOption {
  counterparty_id: string;
  counterparty_legal_name: string;
}

export type DirectoryLookup = (name: string) => Promise<Array<{ company_name: string }>>;

export function groupByCompany(doc: ParsedDocument): Array<{ name: string; skus: string[] }> {
  const groups = new Map<string, { name: string; skus: string[]; seen: Set<string> }>();
  for (const r of doc.rows) {
    const key = normalizeCompanyName(r.company);
    let g = groups.get(key);
    if (!g) {
      g = { name: r.company, skus: [], seen: new Set() };
      groups.set(key, g);
    }
    if (!g.seen.has(r.sku)) {
      g.seen.add(r.sku);
      g.skus.push(r.sku);
    }
  }
  return Array.from(groups.values()).map(({ name, skus }) => ({ name, skus }));
}

/** The directory route needs q ≥ 2 characters; shorter names skip the lookup. */
const MIN_LOOKUP_LENGTH = 2;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function classifyCompanies(
  doc: ParsedDocument,
  ctx: { universe: UniverseOption[]; selfNames: string[]; lookup: DirectoryLookup; concurrency?: number },
): Promise<CompanyClassification[]> {
  const self = new Set(ctx.selfNames.map(normalizeCompanyName));
  const byName = new Map(ctx.universe.map((u) => [normalizeCompanyName(u.counterparty_legal_name), u]));

  return mapWithConcurrency(groupByCompany(doc), ctx.concurrency ?? 4, async ({ name, skus }) => {
    const key = normalizeCompanyName(name);
    if (self.has(key)) return { name, membership: 'self', skus };
    const cp = byName.get(key);
    if (cp) return { name, membership: 'pickable', counterpartyId: cp.counterparty_id, skus };
    if (name.trim().length < MIN_LOOKUP_LENGTH) return { name, membership: 'not_on_network', skus };
    try {
      const hits = await ctx.lookup(name);
      const found = hits.some((h) => normalizeCompanyName(h.company_name) === key);
      return { name, membership: found ? 'on_network_unconnected' : 'not_on_network', skus };
    } catch {
      return { name, membership: 'unverified', skus };
    }
  });
}
```

- [ ] **Step 4: Run — GREEN**, then commit

```bash
npx vitest run src/lib/scope-import/__tests__/classify-companies.test.ts
git add src/lib/scope-import/classify-companies.ts src/lib/scope-import/__tests__/classify-companies.test.ts
git commit -m "v1.90 — sonar: classify file companies as pickable or not on the network

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: RED — the remaining rules, one `it` at a time (add, run, confirm each passes; any that fails gets the smallest fix in the module)**

```ts
  it('marks a directory hit with the exact normalized name as on the network but unconnected', async () => {
    const lookup = vi.fn(async () => [{ company_name: 'texas instruments' }, { company_name: 'Texas Instruments Europe' }]);
    const out = await classifyCompanies(doc([['Texas Instruments', 'RM48']]), { universe: [], selfNames: [], lookup });
    expect(out[0]).toMatchObject({ membership: 'on_network_unconnected' });
  });

  it('marks a company unverified when the lookup throws, and still classifies the others', async () => {
    const lookup = vi.fn(async (name: string) => {
      if (name === 'Gore') throw new Error('HTTP 502');
      return [];
    });
    const out = await classifyCompanies(doc([['Gore', 'G-1'], ['Nordkapp', 'N-1']]), { universe: [], selfNames: [], lookup });
    expect(out.map((c) => c.membership)).toEqual(['unverified', 'not_on_network']);
  });

  it('marks the session company itself as self, without a lookup', async () => {
    const lookup = vi.fn(async () => []);
    const out = await classifyCompanies(doc([['Airbus (Demo)', 'SHIPSET']]), {
      universe: [],
      selfNames: ['Airbus S.A.S. (Demo)', 'Airbus (Demo)'],
      lookup,
    });
    expect(out[0]).toMatchObject({ membership: 'self' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('skips the lookup for a one-character name (the directory needs q ≥ 2)', async () => {
    const lookup = vi.fn(async () => []);
    const out = await classifyCompanies(doc([['X', 'X-1']]), { universe: [], selfNames: [], lookup });
    expect(out[0]).toMatchObject({ membership: 'not_on_network' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('never runs more lookups at once than the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const lookup = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return [];
    });
    const pairs: Array<[string, string]> = Array.from({ length: 10 }, (_, i) => [`Vendor ${i}`, `V-${i}`]);
    await classifyCompanies(doc(pairs), { universe: [], selfNames: [], lookup, concurrency: 3 });
    expect(lookup).toHaveBeenCalledTimes(10);
    expect(peak).toBeLessThanOrEqual(3);
  });
```
Run after each addition — Expected: PASS each (all implemented in Step 3; these pin the rules). Any FAIL → fix the module minimally, re-run.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scope-import/__tests__/classify-companies.test.ts
git commit -m "v1.90 — sonar: classifier pins unconnected, unverified, self, short-name and concurrency rules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The sentences

**Files:**
- Create: `src/lib/scope-import/import-copy.ts`
- Test: `src/lib/scope-import/__tests__/import-copy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function parsedSummary(fileName: string, products: number, companies: number, skipped: number): string;
  export const MEMBERSHIP_LABELS: Record<'not_on_network' | 'on_network_unconnected' | 'unverified', string>;
  export function membershipLine(kind: keyof typeof MEMBERSHIP_LABELS, names: string[]): string | null;
  export function companyOptionLabel(name: string, skuCount: number): string;
  export function matchSummary(name: string, matched: number, total: number): string;
  export function notInCatalogLine(name: string, skus: string[]): string | null;
  export function notAcceptedLine(skus: string[]): string | null;
  export function catalogFailureLine(name: string): string;
  export const SELECT_LABEL = 'Import products for';
  export const SELECT_PLACEHOLDER = 'Choose a company…';
  export const READING = (fileName: string) => `Reading ${fileName}…`;
  ```

- [ ] **Step 1: RED**

Create `src/lib/scope-import/__tests__/import-copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  parsedSummary,
  membershipLine,
  companyOptionLabel,
  matchSummary,
  notInCatalogLine,
  notAcceptedLine,
  catalogFailureLine,
} from '../import-copy';

describe('import copy', () => {
  it('summarises the parse with singular/plural agreement and an optional skipped clause', () => {
    expect(parsedSummary('bom.xlsx', 34, 10, 0)).toBe('bom.xlsx: 34 products across 10 companies.');
    expect(parsedSummary('bom.xlsx', 1, 1, 3)).toBe('bom.xlsx: 1 product across 1 company. 3 rows skipped (no company or no SKU).');
    expect(parsedSummary('bom.xlsx', 2, 1, 1)).toBe('bom.xlsx: 2 products across 1 company. 1 row skipped (no company or no SKU).');
  });

  it('renders each membership line as label + comma-delimited names, or nothing when empty', () => {
    expect(membershipLine('not_on_network', ['Meridian Aerospace Fasteners', 'Nordkapp Sensor Systems'])).toBe(
      'Not on the HAIWAVE network: Meridian Aerospace Fasteners, Nordkapp Sensor Systems.',
    );
    expect(membershipLine('on_network_unconnected', ['Texas Instruments'])).toBe(
      'On the network but not yet connected: Texas Instruments.',
    );
    expect(membershipLine('unverified', ['Gore'])).toBe('Could not be verified: Gore.');
    expect(membershipLine('not_on_network', [])).toBeNull();
  });

  it('labels a company option with its SKU count', () => {
    expect(companyOptionLabel('Pratt & Whitney (Demo)', 5)).toBe('Pratt & Whitney (Demo) (5 SKUs in file)');
    expect(companyOptionLabel('Acme', 1)).toBe('Acme (1 SKU in file)');
  });

  it('summarises a match and lists misses', () => {
    expect(matchSummary('Pratt & Whitney (Demo)', 5, 5)).toBe(
      '5 of 5 SKUs for Pratt & Whitney (Demo) matched and were checked below.',
    );
    expect(matchSummary('Acme', 0, 1)).toBe('0 of 1 SKU for Acme matched and were checked below.');
    expect(notInCatalogLine('Acme', ['ABC-1', 'ABC-2'])).toBe("Not in Acme's catalog: ABC-1, ABC-2.");
    expect(notInCatalogLine('Acme', [])).toBeNull();
    expect(notAcceptedLine(['Z-9'])).toBe('In the catalog but not in an accepted audit scope: Z-9.');
    expect(notAcceptedLine([])).toBeNull();
    expect(catalogFailureLine('Acme')).toBe("Could not load Acme's catalog. Nothing was checked.");
  });
});
```

- [ ] **Step 2: Run — RED** (`cannot resolve ../import-copy`)

- [ ] **Step 3: Implement**

Create `src/lib/scope-import/import-copy.ts`:

```ts
/** Every sentence the scope-import panel says (spec §4), tested once here. */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const SELECT_LABEL = 'Import products for';
export const SELECT_PLACEHOLDER = 'Choose a company…';
export const READING = (fileName: string) => `Reading ${fileName}…`;

export function parsedSummary(fileName: string, products: number, companies: number, skipped: number): string {
  const base = `${fileName}: ${products} ${plural(products, 'product', 'products')} across ${companies} ${plural(companies, 'company', 'companies')}.`;
  if (skipped === 0) return base;
  return `${base} ${skipped} ${plural(skipped, 'row', 'rows')} skipped (no company or no SKU).`;
}

export const MEMBERSHIP_LABELS = {
  not_on_network: 'Not on the HAIWAVE network',
  on_network_unconnected: 'On the network but not yet connected',
  unverified: 'Could not be verified',
} as const;

export function membershipLine(kind: keyof typeof MEMBERSHIP_LABELS, names: string[]): string | null {
  if (names.length === 0) return null;
  return `${MEMBERSHIP_LABELS[kind]}: ${names.join(', ')}.`;
}

export function companyOptionLabel(name: string, skuCount: number): string {
  return `${name} (${skuCount} ${plural(skuCount, 'SKU', 'SKUs')} in file)`;
}

export function matchSummary(name: string, matched: number, total: number): string {
  return `${matched} of ${total} ${plural(total, 'SKU', 'SKUs')} for ${name} matched and were checked below.`;
}

export function notInCatalogLine(name: string, skus: string[]): string | null {
  if (skus.length === 0) return null;
  return `Not in ${name}'s catalog: ${skus.join(', ')}.`;
}

export function notAcceptedLine(skus: string[]): string | null {
  if (skus.length === 0) return null;
  return `In the catalog but not in an accepted audit scope: ${skus.join(', ')}.`;
}

export function catalogFailureLine(name: string): string {
  return `Could not load ${name}'s catalog. Nothing was checked.`;
}
```

- [ ] **Step 4: Run — GREEN**, commit

```bash
npx vitest run src/lib/scope-import/__tests__/import-copy.test.ts
git add src/lib/scope-import/import-copy.ts src/lib/scope-import/__tests__/import-copy.test.ts
git commit -m "v1.90 — sonar: the scope-import sentences, tested once

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The tree accepts an import request

**Files:**
- Modify: `src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx` (Props :51–100; options effect :159–203; `loadCatalog` :208–312; `setSkusForGroup` :451)
- Modify: `docs/superpowers/specs/2026-09-09-scope-from-document-design.md` §7 and §8 (design change: two effects instead of a returning `loadCatalog`)
- Test: `src/app/account/sonar/_components/__tests__/bilateral-counterparties-skus-fields.import.test.tsx`

**Interfaces:**
- Produces (exported from the component file):
  ```ts
  export interface ImportRequest { id: number; counterpartyId: string; skus: string[] }
  export interface ImportResult {
    id: number; counterpartyId: string;
    matched: string[]; notInCatalog: string[]; notAccepted: string[];
    error?: string;
  }
  // new optional Props:
  onOptionsLoaded?: (options: Array<{ counterparty_id: string; counterparty_legal_name: string }>) => void;
  importRequest?: ImportRequest | null;
  onImportResult?: (result: ImportResult) => void;
  ```
- Design note (supersedes spec §7 step 2 "loadCatalog returns state"): `loadCatalog` early-returns when a catalog is already loading, so a returned value cannot cover the concurrent case. Instead: **effect A** on a new `importRequest.id` expands the counterparty, calls `loadCatalog(cp)` and stores the request as pending; **effect B** on `[catalogs, pending]` fires once that counterparty's catalog is `loaded` or carries `error`, computes the match, applies it via `setSkusForGroup(matched, true)`, expands the matched classes, calls `onImportResult`, and clears pending. A `useRef<number>` of the last handled id makes each request run once.

- [ ] **Step 1: RED — `onOptionsLoaded` fires with the universe**

Create `src/app/account/sonar/_components/__tests__/bilateral-counterparties-skus-fields.import.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BilateralCounterpartiesSkusFields,
  type ImportResult,
} from '../bilateral-counterparties-skus-fields';

afterEach(() => vi.unstubAllGlobals());

const PW = 'cccccccc-0000-0000-0000-000000000002';

/**
 * Stubs partners (bilateral) / wizard-options (audit) + P&W's catalog:
 * two classes, four SKUs. `accepted` narrows the audit universe's product_ids.
 */
function stubFetch(opts: { accepted?: string[]; catalogFails?: boolean } = {}) {
  const products = [
    { external_product_id: '5328285', product_name: 'EEC FCS6.0', primary_class_slug: 'engine-control' },
    { external_product_id: '5331092', product_name: 'EEC FCS6.2', primary_class_slug: 'engine-control' },
    { external_product_id: '3957985205', product_name: 'EIU', primary_class_slug: 'airframe-interface' },
    { external_product_id: '271-200-025-026', product_name: 'Accelerometer', primary_class_slug: null },
  ];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/account/partners') {
      return json([{ id: PW, company_name: 'Pratt & Whitney (Demo)', status: 'trading_pair' }]);
    }
    if (url.pathname.endsWith('/audit/wizard-options')) {
      return json({
        counterparties: [
          {
            counterparty_id: PW,
            counterparty_legal_name: 'Pratt & Whitney (Demo)',
            product_ids: opts.accepted ?? products.map((p) => p.external_product_id),
          },
        ],
      });
    }
    if (url.pathname.endsWith('/catalog/classes')) {
      if (opts.catalogFails) return json({ error: 'boom' }, 502);
      return json({
        classes: [
          { class_id: 'c1', class_slug: 'engine-control', class_name: 'Engine Control', product_count: 2 },
          { class_id: 'c2', class_slug: 'airframe-interface', class_name: 'Airframe Interface', product_count: 1 },
        ],
      });
    }
    if (url.pathname.endsWith('/catalog/products')) {
      if (opts.catalogFails) return json({ error: 'boom' }, 502);
      return json({ products, total: products.length });
    }
    throw new Error(`unexpected fetch ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('BilateralCounterpartiesSkusFields — onOptionsLoaded', () => {
  it('reports the loaded universe once so a caller can offer it without a second request', async () => {
    const fetchMock = stubFetch();
    const onOptionsLoaded = vi.fn();
    render(
      <BilateralCounterpartiesSkusFields
        skus={[]}
        onChange={() => {}}
        universe="bilateral_connections"
        onOptionsLoaded={onOptionsLoaded}
      />,
    );
    await screen.findByRole('button', { name: /Pratt & Whitney/ });
    expect(onOptionsLoaded).toHaveBeenCalledTimes(1);
    expect(onOptionsLoaded).toHaveBeenCalledWith([
      { counterparty_id: PW, counterparty_legal_name: 'Pratt & Whitney (Demo)' },
    ]);
    // The universe request happened exactly once.
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/account/partners')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — RED**

`npx vitest run src/app/account/sonar/_components/__tests__/bilateral-counterparties-skus-fields.import.test.tsx` — Expected: FAIL — `onOptionsLoaded` not called (TypeScript may also flag the unknown prop; vitest still runs).

- [ ] **Step 3: Add the prop and fire it**

In `bilateral-counterparties-skus-fields.tsx`:

(a) after the `Props` interface's `counterparties?: string[];` line add:

```ts
  /**
   * v1.90 scope-from-document: fired once when the counterparty universe has
   * loaded, with (id, legal name) pairs, so the import panel can offer the
   * file's pickable companies without a second request.
   */
  onOptionsLoaded?: (
    options: Array<{ counterparty_id: string; counterparty_legal_name: string }>,
  ) => void;
  /**
   * v1.90 scope-from-document: a request to check the given SKUs of one
   * counterparty as if by hand. Each new `id` is handled exactly once: the
   * counterparty is expanded, its catalog loaded through loadCatalog, the SKUs
   * intersected with the catalog (and, under 'accepted_audit_scopes', with the
   * accepted product_ids), the matches applied through the same applySelection
   * path a click uses, and the outcome reported through onImportResult.
   */
  importRequest?: ImportRequest | null;
  onImportResult?: (result: ImportResult) => void;
```

(b) above `interface Props` add the exported types:

```ts
export interface ImportRequest {
  id: number;
  counterpartyId: string;
  skus: string[];
}

export interface ImportResult {
  id: number;
  counterpartyId: string;
  matched: string[];
  notInCatalog: string[];
  notAccepted: string[];
  error?: string;
}
```

(c) destructure `onOptionsLoaded, importRequest, onImportResult` in the component signature.

(d) in the options effect, replace both `if (!cancelled) setOptions(body);` lines with:

```ts
          if (!cancelled) {
            setOptions(body);
            onOptionsLoaded?.(
              body.counterparties.map((c) => ({
                counterparty_id: c.counterparty_id,
                counterparty_legal_name: c.counterparty_legal_name ?? c.counterparty_id,
              })),
            );
          }
```
Keep the effect's dependency array `[universe]` and add `// eslint-disable-next-line react-hooks/exhaustive-deps` above it only if lint demands; the callback must not re-run the fetch. (Check `counterparty_legal_name`'s type in `AuditWizardOptionsResponse`; if it is non-nullable, drop the `?? c.counterparty_id`.)

- [ ] **Step 4: Run — GREEN**, commit

```bash
npx vitest run src/app/account/sonar/_components/__tests__/bilateral-counterparties-skus-fields.import.test.tsx
git add src/app/account/sonar/_components
git commit -m "v1.90 — sonar: the scope tree reports its loaded universe through onOptionsLoaded

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: RED — an import checks the matched SKUs and emits exactly what hand-checking emits**

Append to the test file:

```tsx
type Emitted = { counterparties: string[]; skus: string[]; sku_asks: unknown[] };

/** Controlled harness: feeds onChange back into `skus` the way the wizards do. */
function Harness(props: {
  universe: 'bilateral_connections' | 'accepted_audit_scopes';
  importRequest: { id: number; counterpartyId: string; skus: string[] } | null;
  onImportResult?: (r: ImportResult) => void;
  onEmit: (e: Emitted) => void;
  initialSkus?: string[];
}) {
  const [skus, setSkus] = useState<string[]>(props.initialSkus ?? []);
  return (
    <BilateralCounterpartiesSkusFields
      skus={skus}
      universe={props.universe}
      importRequest={props.importRequest}
      onImportResult={props.onImportResult}
      onChange={(e) => {
        setSkus(e.skus);
        props.onEmit(e);
      }}
    />
  );
}
```
(add `import { useState } from 'react';` at the top.)

```tsx
describe('BilateralCounterpartiesSkusFields — importRequest', () => {
  it('checks the matched SKUs and emits the same payload a manual click sequence emits', async () => {
    // Manual control: click the two EEC SKUs by hand.
    stubFetch();
    const manual: Emitted[] = [];
    const m = render(<Harness universe="bilateral_connections" importRequest={null} onEmit={(e) => manual.push(e)} />);
    fireEvent.click(await screen.findByRole('button', { name: /Pratt & Whitney/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Engine Control/ }));
    const boxes = await screen.findAllByRole('checkbox');
    const eec1 = boxes.find((b) => b.closest('li, div')?.textContent?.includes('5328285'));
    const eec2 = boxes.find((b) => b.closest('li, div')?.textContent?.includes('5331092'));
    if (!eec1 || !eec2) throw new Error('SKU checkboxes not found');
    fireEvent.click(eec1);
    fireEvent.click(eec2);
    const manualLast = manual[manual.length - 1];
    expect(manualLast.skus).toEqual(['5328285', '5331092']);
    m.unmount();
    vi.unstubAllGlobals();

    // Import: same two SKUs, plus one the file has and the catalog does not.
    stubFetch();
    const imported: Emitted[] = [];
    const results: ImportResult[] = [];
    render(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 1, counterpartyId: PW, skus: ['5328285', '5331092', 'NOT-IN-CATALOG'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => imported.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toEqual({
      id: 1,
      counterpartyId: PW,
      matched: ['5328285', '5331092'],
      notInCatalog: ['NOT-IN-CATALOG'],
      notAccepted: [],
    });
    expect(imported[imported.length - 1]).toEqual(manualLast);
    // The counterparty and the class holding the matches are expanded, and the boxes are checked.
    const checked = (await screen.findAllByRole('checkbox')).filter((b) => (b as HTMLInputElement).checked);
    expect(checked.length).toBeGreaterThanOrEqual(2);
  });
});
```
If `eec1`/`eec2` cannot be located by nearest text, find the leaf rows by their `metaSlot` text instead: `screen.getByText('5328285').closest('[role="listitem"], li, div')!.querySelector('input[type=checkbox]')`. Adjust once; the assertion of interest is `imported.last === manualLast`.

- [ ] **Step 6: Run — RED** (`results` stays empty: the component ignores `importRequest`).

- [ ] **Step 7: Implement the two effects**

In the component, after `const selectedSkus = useMemo(...)` and after `loadCatalog` is defined (so it is in scope), add:

```ts
  // ── v1.90 scope-from-document: apply an import request ──────────────────
  // Effect A: a new request expands its counterparty and starts the catalog
  // load. Effect B: once that catalog is loaded (or failed), intersect, check
  // through setSkusForGroup (the click path), expand the matched classes, and
  // report. Split in two because loadCatalog early-returns while a load is in
  // flight, so awaiting it cannot cover a counterparty already loading.
  const [pendingImport, setPendingImport] = useState<ImportRequest | null>(null);
  const lastImportId = useRef<number | null>(null);

  useEffect(() => {
    if (!importRequest || !options) return;
    if (lastImportId.current === importRequest.id) return;
    lastImportId.current = importRequest.id;
    const cp = options.counterparties.find((c) => c.counterparty_id === importRequest.counterpartyId);
    if (!cp) {
      onImportResult?.({
        id: importRequest.id,
        counterpartyId: importRequest.counterpartyId,
        matched: [],
        notInCatalog: importRequest.skus,
        notAccepted: [],
        error: 'not_a_counterparty',
      });
      return;
    }
    setExpandedCounterparties((prev) => new Set(prev).add(cp.counterparty_id));
    setPendingImport(importRequest);
    void loadCatalog(cp);
  }, [importRequest, options, loadCatalog, onImportResult]);

  useEffect(() => {
    if (!pendingImport || !options) return;
    const catalog = catalogs.get(pendingImport.counterpartyId);
    if (!catalog || catalog.loading) return;
    const cp = options.counterparties.find((c) => c.counterparty_id === pendingImport.counterpartyId);
    setPendingImport(null);
    if (!cp) return;
    if (catalog.error) {
      onImportResult?.({
        id: pendingImport.id,
        counterpartyId: cp.counterparty_id,
        matched: [],
        notInCatalog: [],
        notAccepted: [],
        error: catalog.error,
      });
      return;
    }
    // SKU → class slug over the SELECTABLE catalog (already intersected with
    // the accepted set under 'accepted_audit_scopes' by loadCatalog).
    const slugOf = new Map<string, string>();
    for (const [slug, products] of catalog.byClass) {
      for (const p of products) slugOf.set(p.external_product_id, slug);
    }
    for (const id of catalog.orphanIds) slugOf.set(id, UNCLASSIFIED_SLUG);
    const accepted = universe === 'bilateral_connections' ? null : new Set(cp.product_ids);
    const matched: string[] = [];
    const notInCatalog: string[] = [];
    const notAccepted: string[] = [];
    for (const sku of pendingImport.skus) {
      if (slugOf.has(sku)) matched.push(sku);
      else if (accepted && !accepted.has(sku) && catalog.allIds.has(sku)) notAccepted.push(sku);
      else notInCatalog.push(sku);
    }
    if (matched.length > 0) {
      setExpandedClasses((prev) => {
        const next = new Set(prev);
        for (const sku of matched) next.add(`${cp.counterparty_id}|${slugOf.get(sku)}`);
        return next;
      });
      setSkusForGroup(matched, true);
    }
    onImportResult?.({ id: pendingImport.id, counterpartyId: cp.counterparty_id, matched, notInCatalog, notAccepted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogs, pendingImport, options]);
```

`catalog.allIds` is new: the un-intersected catalog ids, which `loadCatalog` currently discards for the audit universe. Extend `CatalogState` with `allIds: Set<string>` (every `external_product_id` the catalog returned, before the accepted intersection): in `loadCatalog`, build `const allIds = new Set<string>()` and `allIds.add(p.external_product_id)` **before** the `if (accepted && !accepted.has(...)) continue;` line; include `allIds` in the `setCatalogs` success payload and `allIds: new Set()` in the loading and error payloads.

Add `useRef` to the React import. Because `setSkusForGroup` reads `selectedSkus` from the current render and the effect runs after that render, the addition is additive over the live selection.

- [ ] **Step 8: Run — GREEN.** If `imported.last` differs from `manualLast` only in `counterparties` ordering or the `sku_asks` key, the payloads are not byte-for-byte equal — that is the test's whole point; fix the effect, never the assertion. Commit:

```bash
npx vitest run src/app/account/sonar/_components/__tests__/bilateral-counterparties-skus-fields.import.test.tsx
git add src/app/account/sonar/_components
git commit -m "v1.90 — sonar: an importRequest checks matched SKUs through the tree's own selection path

Two effects (expand + load, then intersect + apply) because loadCatalog
early-returns while a load is in flight. The emitted scope equals the
manual click sequence's, asserted by comparison.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 9: RED — audit universe: catalog-but-not-accepted is reported, not checked**

```tsx
  it('under the audit universe reports SKUs in the catalog but outside the accepted scope, and does not check them', async () => {
    stubFetch({ accepted: ['5328285'] });
    const results: ImportResult[] = [];
    const emitted: Emitted[] = [];
    render(
      <Harness
        universe="accepted_audit_scopes"
        importRequest={{ id: 2, counterpartyId: PW, skus: ['5328285', '5331092', 'ZZZ'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toMatchObject({ matched: ['5328285'], notAccepted: ['5331092'], notInCatalog: ['ZZZ'] });
    expect(emitted[emitted.length - 1].skus).toEqual(['5328285']);
  });
```
Run — Expected: PASS with the `allIds` implementation; if RED, the `allIds` capture is placed after the `continue` — move it before.

- [ ] **Step 10: RED — additive over an existing selection**

```tsx
  it('adds to an existing selection rather than replacing it', async () => {
    stubFetch();
    const emitted: Emitted[] = [];
    const results: ImportResult[] = [];
    render(
      <Harness
        universe="bilateral_connections"
        initialSkus={['271-200-025-026']}
        importRequest={{ id: 3, counterpartyId: PW, skus: ['3957985205'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(emitted[emitted.length - 1].skus.sort()).toEqual(['271-200-025-026', '3957985205']);
  });
```
Run — Expected: PASS. (If RED because `selectedSkus` was stale, the effect must read `skus` through `selectedSkus` at the render in which the catalog became loaded — it does; investigate before changing.)

- [ ] **Step 11: RED — catalog failure checks nothing and reports the error**

```tsx
  it('reports a catalog failure and checks nothing', async () => {
    stubFetch({ catalogFails: true });
    const emitted: Emitted[] = [];
    const results: ImportResult[] = [];
    render(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 4, counterpartyId: PW, skus: ['5328285'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0].error).toBeTruthy();
    expect(results[0].matched).toEqual([]);
    expect(emitted).toHaveLength(0);
  });
```
Run — Expected: PASS.

- [ ] **Step 12: Run the whole existing tree test suite too, then commit + amend the spec**

```bash
npx vitest run src/app/account/sonar/_components/__tests__/
```
Expected: all PASS (the existing `bilateral-counterparties-skus-fields.test.tsx` and `bilateral-universe.test.tsx` unchanged and green).

Edit the spec, §7: replace the numbered list's step 2 sentence "`loadCatalog` is refactored to **return** the `CatalogState` it computed …" with: "The component holds the request as pending, expands the counterparty and calls `loadCatalog`; a second effect fires once that counterparty's catalog is `loaded` or carries `error` (so a load already in flight is covered), then intersects and applies. `CatalogState` gains `allIds` (the catalog before the accepted intersection) so the audit universe can tell 'not accepted' from 'not in catalog'." In §8's table row for the tree component replace "`loadCatalog` returns its state" with "pending-import effects + `allIds`".

```bash
git add src/app/account/sonar/_components docs/superpowers/specs/2026-09-09-scope-from-document-design.md
git commit -m "v1.90 — sonar: import reports not-accepted vs not-in-catalog, is additive, and checks nothing on a catalog failure; spec §7–8 follow the two-effect design

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The import panel

**Files:**
- Create: `src/app/account/sonar/_components/scope-import-panel.tsx`
- Test: `src/app/account/sonar/_components/__tests__/scope-import-panel.test.tsx`

**Interfaces:**
- Consumes: `parseWorkbook`, `MAX_IMPORT_BYTES` (Task 1); `classifyCompanies`, `CompanyClassification`, `UniverseOption` (Task 2); all of `import-copy` (Task 3); `ImportResult` (Task 4).
- Produces:
  ```tsx
  export interface ScopeImportPanelProps {
    universe: 'bilateral_connections' | 'accepted_audit_scopes';
    options: UniverseOption[] | null;                 // null until the tree reports them
    onImport: (counterpartyId: string, skus: string[], companyName: string) => void;
    result: (ImportResult & { companyName: string }) | null;
    importing: boolean;
  }
  export function ScopeImportPanel(props: ScopeImportPanelProps): JSX.Element;
  ```
- Internal fetches (browser): `GET /api/account/profile` → `{ legal_name: string; dba_name?: string }` for `selfNames` (failure → `[]`); `GET /api/account/directory?q=<name>` → `Array<{ company_name: string }>` (non-2xx → throw, so the classifier marks `unverified`).

- [ ] **Step 1: RED — choosing the demo-shaped file renders the parsed summary and the three membership lines, and the select lists only pickable companies**

Create `src/app/account/sonar/_components/__tests__/scope-import-panel.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { ScopeImportPanel } from '../scope-import-panel';

afterEach(() => vi.unstubAllGlobals());

const PW = 'cccccccc-0000-0000-0000-000000000002';
const options = [{ counterparty_id: PW, counterparty_legal_name: 'Pratt & Whitney (Demo)' }];

function demoFile(): File {
  const rows: unknown[][] = [
    ['Company Key', 'Company Name', 'Product ID', 'Product Name'],
    ['airbus', 'Airbus (Demo)', 'A320NEO-PW1100G-ENGCTL-SHIPSET', 'Shipset'],
    ['pw', 'Pratt & Whitney (Demo)', '5328285', 'EEC'],
    ['pw', 'Pratt & Whitney (Demo)', '5331092', 'EEC 6.2'],
    ['ti', 'Texas Instruments', 'RM48L952', 'MCU'],
    ['meridian', 'Meridian Aerospace Fasteners', 'MAF-HL-T10-6', 'Hi-Lok'],
    ['nordkapp', 'Nordkapp Sensor Systems', 'NKS-EGT-T4-K', 'EGT probe'],
    ['gore', 'W.M. Gore Advanced Materials', 'WMG-CA-16AWG-260', 'Cable'],
    ['', '', 'ORPHAN', 'no company'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['README only']]), 'README');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Products');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], 'airbus-pw-demo.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function stubFetch() {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/account/profile') return json({ legal_name: 'Airbus S.A.S. (Demo)', dba_name: 'Airbus (Demo)' });
      if (url.pathname === '/api/account/directory') {
        const q = url.searchParams.get('q') ?? '';
        if (q === 'Texas Instruments') return json([{ company_name: 'Texas Instruments' }]);
        if (q === 'W.M. Gore Advanced Materials') return json({ error: 'upstream' }, 502);
        return json([]);
      }
      throw new Error(`unexpected fetch ${url.pathname}`);
    }),
  );
}

function chooseFile(file: File) {
  const input = screen.getByLabelText(/choose a spreadsheet/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ScopeImportPanel', () => {
  it('parses the file, says who is not on the network, and offers only pickable companies', async () => {
    stubFetch();
    render(
      <ScopeImportPanel universe="bilateral_connections" options={options} onImport={() => {}} result={null} importing={false} />,
    );
    chooseFile(demoFile());

    expect(
      await screen.findByText('airbus-pw-demo.xlsx: 7 products across 6 companies. 1 row skipped (no company or no SKU).'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Not on the HAIWAVE network: Meridian Aerospace Fasteners, Nordkapp Sensor Systems.'),
    ).toBeInTheDocument();
    expect(screen.getByText('On the network but not yet connected: Texas Instruments.')).toBeInTheDocument();
    expect(screen.getByText('Could not be verified: W.M. Gore Advanced Materials.')).toBeInTheDocument();
    // Airbus is the session company: omitted from every line.
    expect(screen.queryByText(/Airbus/)).not.toBeInTheDocument();

    const select = screen.getByLabelText('Import products for') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual(['Choose a company…', 'Pratt & Whitney (Demo) (2 SKUs in file)']);
  });
});
```

- [ ] **Step 2: Run — RED** (`cannot resolve ../scope-import-panel`)

- [ ] **Step 3: Implement the panel**

Create `src/app/account/sonar/_components/scope-import-panel.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { parseWorkbook, MAX_IMPORT_BYTES, type ParsedDocument } from '@/lib/scope-import/parse-workbook';
import {
  classifyCompanies,
  type CompanyClassification,
  type UniverseOption,
} from '@/lib/scope-import/classify-companies';
import {
  READING,
  SELECT_LABEL,
  SELECT_PLACEHOLDER,
  catalogFailureLine,
  companyOptionLabel,
  matchSummary,
  membershipLine,
  notAcceptedLine,
  notInCatalogLine,
  parsedSummary,
} from '@/lib/scope-import/import-copy';
import type { ImportResult } from './bilateral-counterparties-skus-fields';

/**
 * Scope from document (HaiWeb v1.90 PR 1, spec §4). Sits above the
 * counterparty ▸ class ▸ SKU tree in both wizards. Parses the chosen
 * spreadsheet IN THE BROWSER, classifies its companies against the picker's
 * universe + the participant directory, and lets the user pick one pickable
 * company to import. The membership lines are informational only.
 * Every failure is said in place; none blocks manual checking below.
 */
export interface ScopeImportPanelProps {
  universe: 'bilateral_connections' | 'accepted_audit_scopes';
  options: UniverseOption[] | null;
  onImport: (counterpartyId: string, skus: string[], companyName: string) => void;
  result: (ImportResult & { companyName: string }) | null;
  importing: boolean;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string }
  | { kind: 'refused'; detail: string }
  | { kind: 'ready'; fileName: string; document: ParsedDocument; companies: CompanyClassification[] };

const ACCEPT =
  '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

async function fetchSelfNames(): Promise<string[]> {
  try {
    const res = await fetch('/api/account/profile');
    if (!res.ok) return [];
    const body = (await res.json()) as { legal_name?: string; dba_name?: string | null };
    return [body.legal_name, body.dba_name].filter((s): s is string => typeof s === 'string' && s.length > 0);
  } catch {
    return [];
  }
}

async function directoryLookup(name: string): Promise<Array<{ company_name: string }>> {
  const res = await fetch(`/api/account/directory?q=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`directory ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) return [];
  return body.filter(
    (r): r is { company_name: string } =>
      typeof r === 'object' && r !== null && typeof (r as { company_name?: unknown }).company_name === 'string',
  );
}

export function ScopeImportPanel({ universe, options, onImport, result, importing }: ScopeImportPanelProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [choice, setChoice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Re-classify if the universe arrives after the file was parsed.
  const [rawDoc, setRawDoc] = useState<{ fileName: string; document: ParsedDocument } | null>(null);

  useEffect(() => {
    if (!rawDoc || !options) return;
    let cancelled = false;
    (async () => {
      const selfNames = await fetchSelfNames();
      const companies = await classifyCompanies(rawDoc.document, { universe: options, selfNames, lookup: directoryLookup });
      if (!cancelled) setPhase({ kind: 'ready', fileName: rawDoc.fileName, document: rawDoc.document, companies });
    })();
    return () => {
      cancelled = true;
    };
  }, [rawDoc, options]);

  async function onFile(file: File | undefined) {
    setChoice('');
    if (!file) {
      setRawDoc(null);
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'reading', fileName: file.name });
    const bytes = await file.arrayBuffer();
    const out = await parseWorkbook(bytes, { fileName: file.name, maxBytes: MAX_IMPORT_BYTES });
    if (!out.ok) {
      setRawDoc(null);
      setPhase({ kind: 'refused', detail: out.detail });
      return;
    }
    setRawDoc({ fileName: file.name, document: out.document });
  }

  const ready = phase.kind === 'ready' ? phase : null;
  const visible = ready ? ready.companies.filter((c) => c.membership !== 'self') : [];
  const pickable = visible.filter((c) => c.membership === 'pickable');
  const names = (m: CompanyClassification['membership']) => visible.filter((c) => c.membership === m).map((c) => c.name);

  return (
    <section className="rounded border border-slate/20 bg-white px-3 py-3 space-y-2" aria-label="Import from spreadsheet">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-charcoal">Import from spreadsheet</span>
        <label className="cursor-pointer rounded border border-teal px-3 py-1 text-sm text-teal hover:bg-teal/5 focus-within:ring-2 focus-within:ring-teal">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="peer sr-only"
            aria-label="Choose a spreadsheet"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          Choose file…
        </label>
        {phase.kind !== 'idle' && (
          <button
            type="button"
            className="text-sm text-slate underline"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = '';
              void onFile(undefined);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {phase.kind === 'reading' && <p className="text-sm text-slate italic">{READING(phase.fileName)}</p>}
      {phase.kind === 'refused' && <p className="text-sm text-charcoal">{phase.detail}</p>}

      {ready && (
        <div className="space-y-1 text-sm text-slate">
          <p>
            {parsedSummary(
              ready.fileName,
              ready.document.rows.length,
              ready.companies.length,
              ready.document.skipped,
            )}
          </p>
          {(['not_on_network', 'on_network_unconnected', 'unverified'] as const).map((kind) => {
            const line = membershipLine(kind, names(kind));
            return line ? <p key={kind}>{line}</p> : null;
          })}
          <label className="flex flex-wrap items-center gap-2 pt-1 text-charcoal">
            <span>{SELECT_LABEL}</span>
            <select
              className="rounded border border-slate/30 px-2 py-1 text-sm"
              value={choice}
              disabled={importing || pickable.length === 0}
              onChange={(e) => {
                const id = e.target.value;
                setChoice(id);
                const c = pickable.find((p) => p.counterpartyId === id);
                if (c && c.counterpartyId) onImport(c.counterpartyId, c.skus, c.name);
              }}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {pickable.map((c) => (
                <option key={c.counterpartyId} value={c.counterpartyId}>
                  {companyOptionLabel(c.name, c.skus.length)}
                </option>
              ))}
            </select>
            {pickable.length === 0 && (
              <span>
                {universe === 'bilateral_connections'
                  ? 'None of the file’s companies is one of your active trading pairs.'
                  : 'None of the file’s companies has an accepted audit scope with you.'}
              </span>
            )}
          </label>
          {result && (
            <div className="space-y-1">
              {result.error ? (
                <p>{catalogFailureLine(result.companyName)}</p>
              ) : (
                <>
                  <p>
                    {matchSummary(
                      result.companyName,
                      result.matched.length,
                      result.matched.length + result.notInCatalog.length + result.notAccepted.length,
                    )}
                  </p>
                  {notInCatalogLine(result.companyName, result.notInCatalog) && (
                    <p>{notInCatalogLine(result.companyName, result.notInCatalog)}</p>
                  )}
                  {notAcceptedLine(result.notAccepted) && <p>{notAcceptedLine(result.notAccepted)}</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

Note on the company count in `parsedSummary`: the spec says "N products across M companies" for the file as a whole, so `self` is counted in M but omitted from the lines (the test expects 6 companies with Airbus present). Keep the arithmetic as written.

- [ ] **Step 4: Run — GREEN.** If `file.arrayBuffer` is undefined under jsdom, jsdom 29 implements it (measured at `node_modules/jsdom/lib/jsdom/living/file-api/Blob-impl.js:75`); if the test still fails there, construct the `File` from a `Uint8Array` instead of the raw `ArrayBuffer`. Commit:

```bash
npx vitest run src/app/account/sonar/_components/__tests__/scope-import-panel.test.tsx
git add src/app/account/sonar/_components/scope-import-panel.tsx src/app/account/sonar/_components/__tests__/scope-import-panel.test.tsx
git commit -m "v1.90 — sonar: the import panel parses in the browser, says who is not on the network, offers pickable companies

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: RED — choosing a company fires onImport with that company's SKUs; a result renders the summary; a refusal is said in place**

```tsx
  it('fires onImport with the chosen company’s file SKUs and renders the result summary', async () => {
    stubFetch();
    const onImport = vi.fn();
    const { rerender } = render(
      <ScopeImportPanel universe="bilateral_connections" options={options} onImport={onImport} result={null} importing={false} />,
    );
    chooseFile(demoFile());
    const select = (await screen.findByLabelText('Import products for')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: PW } });
    expect(onImport).toHaveBeenCalledWith(PW, ['5328285', '5331092'], 'Pratt & Whitney (Demo)');

    rerender(
      <ScopeImportPanel
        universe="bilateral_connections"
        options={options}
        onImport={onImport}
        importing={false}
        result={{ id: 1, counterpartyId: PW, companyName: 'Pratt & Whitney (Demo)', matched: ['5328285'], notInCatalog: ['5331092'], notAccepted: [] }}
      />,
    );
    expect(screen.getByText('1 of 2 SKUs for Pratt & Whitney (Demo) matched and were checked below.')).toBeInTheDocument();
    expect(screen.getByText("Not in Pratt & Whitney (Demo)'s catalog: 5331092.")).toBeInTheDocument();
  });

  it('says a refusal in place and offers no select', async () => {
    stubFetch();
    render(<ScopeImportPanel universe="bilateral_connections" options={options} onImport={() => {}} result={null} importing={false} />);
    const pdf = new File([new TextEncoder().encode('%PDF-1.4')], 'x.pdf', { type: 'application/pdf' });
    chooseFile(pdf);
    await waitFor(() => expect(screen.queryByText(/Reading/)).not.toBeInTheDocument());
    expect(screen.getByText(/Could not read x\.pdf as a spreadsheet\.|No sheet has both a company column/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Import products for')).not.toBeInTheDocument();
  });

  it('says the byte ceiling in place without parsing', async () => {
    stubFetch();
    render(<ScopeImportPanel universe="bilateral_connections" options={options} onImport={() => {}} result={null} importing={false} />);
    const big = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'big.xlsx');
    chooseFile(big);
    expect(await screen.findByText('big.xlsx is 10.0 MB; the limit is 10 MB.')).toBeInTheDocument();
  });
```
(add `import { MAX_IMPORT_BYTES } from '@/lib/scope-import/parse-workbook';` at the top.)

Run — Expected: PASS for the first two; the third may be slow (10 MiB allocation) but passes. Commit:

```bash
git add src/app/account/sonar/_components/__tests__/scope-import-panel.test.tsx
git commit -m "v1.90 — sonar: panel pins onImport payload, result summary, and in-place refusals

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Mount the panel in both wizards

**Files:**
- Modify: `src/app/account/sonar/watchers/new/_components/watcher-scope-picker.tsx` (imports :1–9; the `<BilateralCounterpartiesSkusFields …/>` block :70–83)
- Modify: `src/app/account/sonar/_components/audit-scope-picker.tsx` (imports :1–6; the bilateral branch :114–129)
- Test: `src/app/account/sonar/watchers/new/_components/__tests__/watcher-scope-picker.test.tsx` (append), `src/app/account/sonar/_components/__tests__/audit-scope-picker.test.tsx` (append; create if absent — check with `ls`)

**Interfaces:**
- Consumes: `ScopeImportPanel` (Task 5); `ImportRequest`, `ImportResult`, `onOptionsLoaded`, `importRequest`, `onImportResult` (Task 4); `UniverseOption` (Task 2).
- Produces: no new exports. Each picker holds `const [importOptions, setImportOptions] = useState<UniverseOption[] | null>(null); const [importRequest, setImportRequest] = useState<ImportRequest | null>(null); const [importResult, setImportResult] = useState<(ImportResult & { companyName: string }) | null>(null); const importSeq = useRef(0); const pendingName = useRef('');`.

- [ ] **Step 1: RED — watcher picker: importing through the panel checks the SKU and emits it**

Append to `watcher-scope-picker.test.tsx` (reuse its `stubCatalogFetch`, but the panel also calls `/api/account/profile` and `/api/account/directory` — the stub's final `return Promise.resolve(json({}))` answers profile with `{}` (no self names) and directory with `{}` (non-array → no hits), which is enough):

```tsx
import * as XLSX from 'xlsx';

function fileWith(rows: unknown[][], name = 'scope.xlsx'): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Products');
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], name);
}

describe('WatcherScopePicker — import from spreadsheet', () => {
  it('checks the file’s matching SKU for the chosen company and emits it in the scope', async () => {
    stubCatalogFetch(['PN-88A', 'PN-99B']);
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);

    const input = (await screen.findByLabelText(/choose a spreadsheet/i)) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [fileWith([['Supplier', 'SKU'], ['Acme', 'PN-99B'], ['Acme', 'PN-NOPE'], ['Zed Co', 'Z-1']])] },
    });

    expect(await screen.findByText('Not on the HAIWAVE network: Zed Co.')).toBeInTheDocument();
    const select = (await screen.findByLabelText('Import products for')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'cccccccc-0000-0000-0000-000000000001' } });

    expect(await screen.findByText('1 of 2 SKUs for Acme matched and were checked below.')).toBeInTheDocument();
    expect(screen.getByText("Not in Acme's catalog: PN-NOPE.")).toBeInTheDocument();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as WatcherScope;
    expect(last.skus).toEqual(['PN-99B']);
    expect(last.counterparties).toEqual(['cccccccc-0000-0000-0000-000000000001']);
  });
});
```
Note: `WatcherScopePicker` is uncontrolled in this test (`value={empty}` never updates), and the import applies once, so the single `onChange` carries the full selection.

- [ ] **Step 2: Run — RED** (`Unable to find a label with the text of: /choose a spreadsheet/i`)

- [ ] **Step 3: Mount in the watcher picker**

In `watcher-scope-picker.tsx`:

imports — change `import { useEffect, useState } from 'react';` to `import { useEffect, useRef, useState } from 'react';` and add:

```ts
import {
  BilateralCounterpartiesSkusFields,
  type ImportRequest,
  type ImportResult,
} from '../../../_components/bilateral-counterparties-skus-fields';
import { ScopeImportPanel } from '../../../_components/scope-import-panel';
import type { UniverseOption } from '@/lib/scope-import/classify-companies';
```
(replace the existing `BilateralCounterpartiesSkusFields` import line.)

inside the component, after `const baseline = …`:

```ts
  // v1.90 scope-from-document: the import panel above the tree. The tree
  // reports its universe once; a chosen company becomes an importRequest the
  // tree applies through its own selection path; the result feeds the panel.
  const [importOptions, setImportOptions] = useState<UniverseOption[] | null>(null);
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null);
  const [importResult, setImportResult] = useState<(ImportResult & { companyName: string }) | null>(null);
  const importSeq = useRef(0);
  const pendingName = useRef('');
```

in the JSX, immediately before `<BilateralCounterpartiesSkusFields`:

```tsx
      <ScopeImportPanel
        universe="bilateral_connections"
        options={importOptions}
        importing={importRequest !== null && importResult?.id !== importRequest.id}
        result={importResult}
        onImport={(counterpartyId, skus, companyName) => {
          importSeq.current += 1;
          pendingName.current = companyName;
          setImportResult(null);
          setImportRequest({ id: importSeq.current, counterpartyId, skus });
        }}
      />
```

and add to the `<BilateralCounterpartiesSkusFields` props:

```tsx
        onOptionsLoaded={setImportOptions}
        importRequest={importRequest}
        onImportResult={(r) => setImportResult({ ...r, companyName: pendingName.current })}
```

- [ ] **Step 4: Run — GREEN**, then run the whole watcher picker test file to confirm nothing else moved:

```bash
npx vitest run src/app/account/sonar/watchers/new/_components/__tests__/watcher-scope-picker.test.tsx
```
Expected: all PASS. Commit:

```bash
git add src/app/account/sonar/watchers/new/_components
git commit -m "v1.90 — sonar: the watcher Scope step imports products from a spreadsheet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: RED — audit picker, bilateral branch**

`ls src/app/account/sonar/_components/__tests__/ | grep audit-scope-picker` — if absent, create `audit-scope-picker.test.tsx`; otherwise append:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { RunTemplateScope } from '@haiwave/protocol';
import { AuditScopePicker } from '../audit-scope-picker';

afterEach(() => vi.unstubAllGlobals());

type AuditScope = Extract<RunTemplateScope, { kind: 'audit' }>;
const CP = 'cccccccc-0000-0000-0000-000000000001';

const bilateralEmpty = {
  kind: 'audit',
  authorization_basis: 'bilateral',
  counterparties: [],
  signal_types: [],
  skus: [],
  depth_limit: 1,
  hop_budget: 3,
} as AuditScope;

function stubAuditFetch() {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname.endsWith('/audit/wizard-options')) {
        return json({ counterparties: [{ counterparty_id: CP, counterparty_legal_name: 'Acme', product_ids: ['PN-88A'] }] });
      }
      if (url.pathname.endsWith('/catalog/classes')) return json({ classes: [] });
      if (url.pathname.endsWith('/catalog/products')) {
        return json({
          products: [
            { external_product_id: 'PN-88A', product_name: 'Widget A', primary_class_slug: null },
            { external_product_id: 'PN-99B', product_name: 'Widget B', primary_class_slug: null },
          ],
          total: 2,
        });
      }
      if (url.pathname === '/api/account/profile') return json({ legal_name: 'Me Inc' });
      if (url.pathname === '/api/account/directory') return json([]);
      throw new Error(`unexpected fetch ${url.pathname}`);
    }),
  );
}

function fileWith(rows: unknown[][]): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Products');
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'scope.xlsx');
}

describe('AuditScopePicker — import from spreadsheet (bilateral branch)', () => {
  it('checks the accepted match, reports the unaccepted one, and emits the audit scope', async () => {
    stubAuditFetch();
    const onChange = vi.fn();
    render(<AuditScopePicker value={bilateralEmpty} onChange={onChange} />);

    const input = (await screen.findByLabelText(/choose a spreadsheet/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fileWith([['Vendor', 'Part Number'], ['Acme', 'PN-88A'], ['Acme', 'PN-99B']])] } });
    const select = (await screen.findByLabelText('Import products for')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: CP } });

    expect(await screen.findByText('1 of 2 SKUs for Acme matched and were checked below.')).toBeInTheDocument();
    expect(screen.getByText('In the catalog but not in an accepted audit scope: PN-99B.')).toBeInTheDocument();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AuditScope & { skus: string[]; counterparties: string[] };
    expect(last.skus).toEqual(['PN-88A']);
    expect(last.counterparties).toEqual([CP]);
    expect(last.authorization_basis).toBe('bilateral');
  });

  it('offers no import panel on the key-scoped branch', () => {
    stubAuditFetch();
    render(
      <AuditScopePicker
        value={{ kind: 'audit', authorization_basis: 'key_scoped', provenance_key_id: '', depth_limit: 1, hop_budget: 3 } as AuditScope}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/choose a spreadsheet/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run — RED**, then mount in `audit-scope-picker.tsx`

imports: `import { useState, useEffect, useRef } from 'react';` (keep what exists, add `useRef`), replace the tree import with

```ts
import {
  BilateralCounterpartiesSkusFields,
  type ImportRequest,
  type ImportResult,
} from './bilateral-counterparties-skus-fields';
import { ScopeImportPanel } from './scope-import-panel';
import type { UniverseOption } from '@/lib/scope-import/classify-companies';
```

state, after `const hopBudget = …`: the same five declarations as the watcher picker (Step 3).

JSX: inside `{authBasis === 'bilateral' && ( … )}` wrap the tree in a fragment and put the panel first:

```tsx
      {authBasis === 'bilateral' && (
        <>
          <ScopeImportPanel
            universe="accepted_audit_scopes"
            options={importOptions}
            importing={importRequest !== null && importResult?.id !== importRequest.id}
            result={importResult}
            onImport={(counterpartyId, skus, companyName) => {
              importSeq.current += 1;
              pendingName.current = companyName;
              setImportResult(null);
              setImportRequest({ id: importSeq.current, counterpartyId, skus });
            }}
          />
          <BilateralCounterpartiesSkusFields
            skus={'skus' in value ? value.skus : []}
            onOptionsLoaded={setImportOptions}
            importRequest={importRequest}
            onImportResult={(r) => setImportResult({ ...r, companyName: pendingName.current })}
            onChange={({ counterparties, skus }) =>
              onChange({
                kind: 'audit',
                authorization_basis: 'bilateral',
                counterparties,
                signal_types: 'signal_types' in value ? value.signal_types : [],
                skus,
                depth_limit: depthLimit,
                hop_budget: hopBudget,
              })
            }
          />
        </>
      )}
```

- [ ] **Step 7: Run — GREEN**; then the whole sonar test tree:

```bash
npx vitest run src/app/account/sonar/_components/__tests__/audit-scope-picker.test.tsx
npx vitest run src/app/account/sonar
```
Expected: all PASS. Commit:

```bash
git add src/app/account/sonar/_components
git commit -m "v1.90 — sonar: the audit Scope step (company scope) imports products from a spreadsheet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Lint, build, full gate, HOLD

**Files:** none new. Read-only verification + the HOLD notice.

- [ ] **Step 1: Lint + typecheck**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.json
```
Expected: 0 errors. Fix any `no-explicit-any`, unused import, or exhaustive-deps finding in the files this lane touched (and only those); re-run; commit as `v1.90 — sonar: lint` if anything changed.

- [ ] **Step 2: Production build in the worktree** (never in `~/dev/hw/haiWeb`)

```bash
npm run build 2>&1 | tee /private/tmp/claude-501/-Users-samfleming-dev-hw/d200cdd7-bf11-4d8b-99cd-ee3de834b230/scratchpad/build-scope-from-document.log | tail -25
```
Expected: `✓ Compiled successfully`, no type errors; `xlsx` appears only as a separate chunk (grep the `.next` output: `grep -rl "SheetJS" .next/static/chunks | head` should list a chunk that is not the main app chunk). Record the log path.

- [ ] **Step 3: Full vitest gate under the machine lock, on a quiet machine**

```bash
pgrep -fl vitest || echo "no vitest running"
~/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 2>&1 | tee /private/tmp/claude-501/-Users-samfleming-dev-hw/d200cdd7-bf11-4d8b-99cd-ee3de834b230/scratchpad/vitest-scope-from-document.log | tail -15
grep -c "(retry" /private/tmp/claude-501/-Users-samfleming-dev-hw/d200cdd7-bf11-4d8b-99cd-ee3de834b230/scratchpad/vitest-scope-from-document.log
```
Expected: all files pass; test files = 376 + the 6 new files (`parse-workbook`, `classify-companies`, `import-copy`, `…skus-fields.import`, `scope-import-panel`, `audit-scope-picker` if created) = **382**; tests = 2389 + the count of new `it`s (tally them from the files; expect ≈ 2389 + 33); `(retry` count = 0. If any pre-existing test fails, do not touch it — record it, check whether it fails on af82dc64 too (`git stash` is forbidden; use `git worktree add /tmp/hw-control af82dc64` and run that single file there), and report. If an aborted run leaves orphan tinypool workers, `pgrep -fl tinypool` and kill ppid-1 workers before re-running.

- [ ] **Step 4: Porcelain + measurement for the HOLD**

```bash
git status --porcelain | wc -l          # expect 0
git log --oneline af82dc64..HEAD        # the lane's commits
git diff --stat af82dc64..HEAD | tail -1
git rev-parse HEAD
```

- [ ] **Step 5: Send the HOLD notice to agent1** (`SendMessage` to `hw-48`) with: tip sha; commits over af82dc64 (count + subjects); files/±; porcelain 0; vitest log path + files/tests/`(retry`=0; build log path; the release-label convention used (`v1.90 — sonar: …` commit subjects + PR title, since HaiWeb has no CHANGELOG file — ask agent1 to confirm that satisfies rule 4's "CHANGELOG line" or name the file to write); dependency statement for the PR body (`xlsx` 0.20.3, same pin as reference-agent, SBOM row 950, 0 new components, dynamic import); counters: none; the two PR-body paragraphs (what it does; how it degrades). Then STOP: the push and PR are the owner's word; agent1 merges.

- [ ] **Step 6: Live proof recipe (for the owner's walk after the refresh, not for this lane to run on :3001/:3002)**

Written into the HOLD message: on the refreshed console, New watcher → Scope → Import from spreadsheet → choose `~/dev/hw/demo-assets/airbus-pw-demo/airbus-pw-engine-controls-demo-products-2026-09-08.xlsx` → expect "airbus-pw-engine-controls-demo-products-2026-09-08.xlsx: 34 products across 10 companies." (verify the exact count against the file at walk time), "Not on the HAIWAVE network: Meridian Aerospace Fasteners, Nordkapp Sensor Systems, …" (the four suspended vendors join this list per ruling R3), Import products for → Pratt & Whitney (Demo) (5 SKUs in file) → "5 of 5 SKUs for Pratt & Whitney (Demo) matched and were checked below." with the five P&W SKUs checked in the tree. Precondition: the signed-in company is Airbus (Demo) with the P&W trading pair (agent6's mesh pairs, 6/6).

---

## Self-review (run after writing)

**Spec coverage.** §4 flow → Tasks 5, 6. §5 parser + §5.4 ceilings → Task 1. §6 classification (rules 1–5, `q ≥ 2`, self via profile) → Tasks 2, 5. §7 matching/checking (two-effect design, additive, classes expanded, audit `notAccepted`) → Task 4 (+ spec amendment). §8 files → the table above; `onOptionsLoaded` → Task 4 step 3. §9 degradation (in-place refusals, unverified, catalog failure, clear resets panel not selection) → Tasks 4, 5 (Clear calls `onFile(undefined)` which never touches the tree). §10 tests → each task. §11 numbers → Task 7 step 5. §12 out of scope → nothing planned for it.

**Placeholder scan.** No TBD/TODO. Every code step shows the code. Step-level "if it fails, then …" branches name the exact change.

**Type consistency.** `ImportRequest {id, counterpartyId, skus}` / `ImportResult {id, counterpartyId, matched, notInCatalog, notAccepted, error?}` used identically in Tasks 4, 5, 6. `UniverseOption {counterparty_id, counterparty_legal_name}` from Task 2 is what `onOptionsLoaded` emits (Task 4) and `ScopeImportPanel.options` consumes (Task 5). `onImport(counterpartyId, skus, companyName)` matches in Tasks 5 and 6. Copy functions' signatures match between Task 3 and Task 5.
