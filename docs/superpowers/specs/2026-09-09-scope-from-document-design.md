# Scope from document — import a spreadsheet into the watcher / audit scope picker

**Lane:** HaiWeb `scope-from-document` · **Release:** HaiWeb v1.90 PR 1 (owner's word 2026-09-09: "yes open a v.1.90 cycle") · **Base:** `origin/master` af82dc64 · **Author:** agent7 (hw-6e) · **Allocation:** `~/dev/hw/ALLOCATION-2026-09-09-scope-from-document-agent1.md`

## 1. Purpose

When a user defines a watcher or an audit run, the Scope step makes them find a trading partner, expand its product classes and check products one by one. Buyers already hold that information in spreadsheets (a program bill of materials, a supplier product list). This feature lets them upload that spreadsheet, tells them which of its suppliers are not on the HAIWAVE network (informational only), lets them pick the supplier they want to operate on, and checks every product in the file that exists in that supplier's catalog — exactly as if they had checked each one by hand. The rest of the watcher or audit configuration is unchanged and runs against the selected products.

Owner's directive, 2026-09-09 (agent7's window): upload an Excel file; parse companies (suppliers) and SKUs; one informational comma-delimited sentence naming the file's companies not on the network, no action on them; the user picks the target company from the file; products load from that company's agent; the file's SKUs are matched and each match becomes checked exactly as if hand-checked; the user completes the rest of the watcher / audit configuration.

## 2. Owner rulings taken at design (2026-09-09, agent7's window)

| # | question | ruling |
|---|---|---|
| R1 | Which companies count as "not on the HAIWAVE network"? | **Absent from the participant directory.** Registered participants the user is not connected to are on the network: they get a separate short line ("On the network but not yet connected: …") and are not pickable as a target. |
| R2 | Where is the spreadsheet parsed? | **In the browser.** No upload route, no server-side parse, no multipart ceiling, no new server-side untrusted-input surface. |
| R3 | haiCore's participant search returns `status = 'active'` participants only, so suspended participants read as "not on the network". | **Acceptable.** A suspended participant cannot trade. No haiCore change. |
| R4 | Design as a whole (sections 3–9 below). | **Approved, proceed.** |

## 3. Existing surface this builds on (measured 2026-09-09 at af82dc64)

- Both wizards share one scope tree: `WatcherScopePicker` (`src/app/account/sonar/watchers/new/_components/watcher-scope-picker.tsx`) and `AuditScopePicker` (`src/app/account/sonar/_components/audit-scope-picker.tsx`) each mount `BilateralCounterpartiesSkusFields` (`src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx`). That component is the single insertion point.
- Counterparty universe: watchers use `universe="bilateral_connections"` (`GET /api/account/partners`, `status === 'trading_pair'`); audits use `accepted_audit_scopes` (`GET /api/account/sonar/audit/wizard-options`, `product_ids` pre-populated). Each counterparty option carries `counterparty_id` and `counterparty_legal_name`.
- A counterparty's catalog loads lazily on expand (`loadCatalog`): `GET /api/account/partners/{id}/catalog/classes` plus `fetchAllCatalogProducts` (`src/lib/catalog-products.ts`, pages to haiCore's `total`). `CatalogProduct.external_product_id` is the SKU and the only stable identifier; `primary_class_slug` buckets it into a class. Under the audit universe only SKUs in the counterparty's accepted `product_ids` are selectable.
- Selection is `scope.skus[]`; `emitWith` derives `scope.counterparties` from which counterparty owns a selected SKU. `toggleSku` / `setSkusForGroup` → `applySelection` → `emitWith` → `onChange`. Anything that goes through `applySelection` is indistinguishable from a hand check.
- Directory: `GET /api/account/directory?q=` (`src/app/api/account/directory/route.ts`) → haiCore `GET /participants/search` (pg_trgm similarity over `legal_name`, `dba_name` and registered aliases; `WHERE p.status = 'active'`; excludes the caller). Returns `{ id, company_name, connection_status, … }` with `company_name = dba_name ?? legal_name`. `q` must be ≥ 2 characters. When haiCore is unreachable the BFF falls back to a mock directory (pre-existing behaviour, out of scope here).
- The only file-input precedent: `src/app/account/manifests/library/add-evidence-modal.tsx` (`MAX_BYTES = 10 MiB`, visually hidden `<input type="file">`).
- Repo invariants that constrain new code: `src/__tests__/bff-mutations-are-role-gated.test.ts` (every mutating route is role-gated), `no-request-derived-origin.test.ts`, `no-role-attribute.test.ts`. This feature adds **no** route, so none is touched.
- Test conventions: vitest + jsdom, `vi.stubGlobal('fetch', …)` dispatching on URL substring (see `watchers/new/_components/__tests__/watcher-scope-picker.test.tsx`), tests colocated in `__tests__/`.

## 4. User-facing flow

The Scope step of both wizards gains an **Import from spreadsheet** panel rendered directly above the counterparty ▸ class ▸ SKU tree.

1. **Choose file.** A visually hidden `<input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv">` behind a button. Parsing happens in the browser (§5). While parsing: "Reading `<filename>`…".
2. **Parsed summary.** One line: "`<filename>`: N products across M companies." plus, when applicable, "K rows skipped (no company or no SKU)." Any parse refusal (§5.4) is said in place in the panel and nothing else renders.
3. **Membership lines** (§6), each rendered only when its list is non-empty, in this order:
   - "**Not on the HAIWAVE network:** Meridian Aerospace Fasteners, Nordkapp Sensor Systems." (informational; no action)
   - "**On the network but not yet connected:** Texas Instruments, …" (informational; not pickable)
   - "**Could not be verified:** …" (a directory lookup failed for these names)
   Names are listed in file order, comma-delimited, each once; the sentence is singular/plural aware ("is not" / "are not" is not needed — the label form above avoids the agreement problem while keeping one sentence per class).
4. **Target company.** A `<select>` labelled "Import products for" listing only the file's companies that are pickable in this picker's universe, each as "`<name>` (N SKUs in file)". Placeholder option "Choose a company…". Choosing one fires the import (§7). The select stays enabled afterwards so a second company can be imported additively.
5. **Match summary** (after an import completes), one short paragraph:
   - "5 of 5 SKUs for Pratt & Whitney (Demo) matched and were checked below."
   - when some did not match: "Not in Pratt & Whitney (Demo)'s catalog: ABC-1, ABC-2." (informational)
   - audit universe only, when applicable: "In the catalog but not in an accepted audit scope: …" (informational)
   - when the catalog load failed: "Could not load Pratt & Whitney (Demo)'s catalog (`<reason>`). Nothing was checked." — the tree's own error state shows as today.
6. **Continue as usual.** The checked SKUs are ordinary picker state. The user may uncheck, check more, import another company, or clear the file (which resets the panel but never the selection). Schedule / Drift / Lifecycle steps and the submit payloads are untouched.

Copy is said in place inside the panel (no toasts, no modals). Every list uses the existing `text-slate` informational styling; the "Not on the HAIWAVE network" line is not an error.

## 5. Parsing (browser)

### 5.1 Module
`src/lib/scope-import/parse-workbook.ts` — a pure function, no React, no fetch:

```ts
export interface ImportRow { company: string; sku: string; row: number /* 1-based sheet row */ }
export interface ParsedDocument {
  sheet: string;
  columns: { company: string; sku: string };   // the header labels actually used
  rows: ImportRow[];                            // deduplicated on (normalized company, sku)
  skipped: number;                              // rows lacking a company or a SKU
  totalDataRows: number;                        // rows under the header, before dedup/skip
}
export type ParseOutcome =
  | { ok: true; document: ParsedDocument }
  | { ok: false; reason: 'too_large' | 'too_many_rows' | 'no_qualifying_sheet' | 'unreadable'; detail: string };
export async function parseWorkbook(bytes: ArrayBuffer, opts?: { maxBytes?: number; maxRows?: number }): Promise<ParseOutcome>;
```

### 5.2 Dependency
SheetJS Community Edition `xlsx` **0.20.3**, declared exactly as the reference agent declares it: `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`. Zero transitive dependencies, Apache-2.0, already present in the platform SBOM (edition 2026-09-08, purl `pkg:npm/xlsx@0.20.3?download_url=…cdn.sheetjs.com…`). Dep-footprint delta: **one direct dependency, zero new SBOM components.** Loaded with a dynamic `import('xlsx')` inside `parseWorkbook` so it is not in the console's main bundle. Reads .xlsx, .xls and .csv through the one API.

### 5.3 Sheet and column detection
- Iterate sheets in workbook order. For each sheet, take the first row that has ≥ 2 non-empty cells as the candidate header. Normalize each header (trim, collapse whitespace, case-fold, strip trailing `*` / `:`).
- A sheet **qualifies** when its header row has a company column and a SKU column:
  - company synonyms: `company name`, `company`, `supplier`, `supplier name`, `vendor`, `vendor name`, `manufacturer`, `counterparty`
  - SKU synonyms: `product id`, `sku`, `part number`, `part no`, `part no.`, `part #`, `mpn`, `item number`, `item no`, `product code`, `vendor sku`
  - When several headers match, the first in row order wins. Exact normalized equality only (no substring matching), so `Company Key` does not steal from `Company Name` and `Product Name` does not steal from `Product ID`.
- The first qualifying sheet is used. With agent6's demo file, `README` (no header row) is passed over and `Products` qualifies with `Company Name` / `Product ID`.
- Cells are read as **displayed text** (`raw: false`, i.e. the `w` formatted string) so a numeric SKU such as `5328285` or `007` arrives as the text the user sees. Company text: trim + collapse internal whitespace. SKU text: trim only (SKUs are opaque, case-sensitive).
- A data row with an empty company or an empty SKU is counted in `skipped`. Duplicate (normalized company, sku) pairs are kept once. Rows are returned in sheet order.

### 5.4 Ceilings (stated here, enforced by the module, tested)
| ceiling | value | behaviour |
|---|---|---|
| file size | 10 MiB (`MAX_IMPORT_BYTES`, same as the evidence uploader) | refused before parsing: "`<file>` is 12.4 MB; the limit is 10 MB." |
| data rows on the chosen sheet | 5,000 (`MAX_IMPORT_ROWS`) | refused after header detection: "`Products` has 7,120 rows; the limit is 5,000." |
| no qualifying sheet | — | "No sheet has both a company column and a SKU column. Looked for headers like Company Name / Supplier / Vendor and Product ID / SKU / Part Number." |
| unreadable file | — | "Could not read `<file>` as a spreadsheet." |

Nothing is truncated silently; the framework never decides a limit.

The panel checks `File.size` against the byte ceiling **before** it reads the file, saying the same sentence `parseWorkbook` would (one exported source, `tooLargeDetail`): reading 10 MB+ only to refuse it is waste, and a read that then fails would have left the panel on "Reading …" for ever. A read the browser refuses is caught and said as `unreadable` (`unreadableDetail`).

## 6. Membership classification

### 6.1 Module
`src/lib/scope-import/classify-companies.ts` — pure over injected lookups so it is unit-testable without React:

```ts
export type Membership = 'pickable' | 'on_network_unconnected' | 'not_on_network' | 'unverified' | 'self';
export interface CompanyClassification { name: string /* as in file */; membership: Membership; counterpartyId?: string; skus: string[] }
export async function classifyCompanies(
  doc: ParsedDocument,
  ctx: {
    universe: { counterparty_id: string; counterparty_legal_name: string }[];   // the picker's options
    selfNames: string[];                                                          // the session company's names
    lookup: (name: string) => Promise<{ company_name: string; legal_name?: string; dba_name?: string }[]>;  // directory search, throws on failure
    concurrency?: number;                                                         // default 4
  },
): Promise<CompanyClassification[]>;
export const normalizeCompanyName = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
```

### 6.2 Rules (applied per distinct normalized company name, in file order)
1. Equal to one of `selfNames` → `self` (omitted from every line and from the select).
2. Equal to a universe option's `counterparty_legal_name` → `pickable` (carries `counterpartyId`).
3. Otherwise call `lookup(name)`; if the normalized file name is equal to any of a returned result's `company_name`, `legal_name` or `dba_name` → `on_network_unconnected`. All three, because the BFF's `company_name` is `dba_name ?? legal_name`: comparing against it alone reported a participant spelled by its other name as not on the network. Still an equality, never "any hit at all" — the directory search is similarity-based, so a hit threshold would swallow the not-on-network line.
4. Otherwise → `not_on_network`.
5. If `lookup` throws or the response is not OK → `unverified`. A network fault never produces a false membership claim.

Notes: the directory route needs `q ≥ 2` characters; a one-character company name goes straight to `not_on_network` without a lookup. Ruling R3: suspended participants are not returned and therefore read as `not_on_network`.

**Known residual (follow-up, not fixed in v1.90):** haiCore's search *matches* registered aliases, but the search result shape carries only the participant's `legal_name` and `dba_name` — an alias is not among the returned names. So a file spelling a participant by an alias alone produces a hit whose three names all differ from the file's, and the company still reads `not_on_network`. Closing it needs the alias set on the search result (a haiCore change), not a console change.

### 6.3 Self names
No client-side session context exists in the console (measured: no `useSession`/account context hook). The panel fetches `GET /api/account/profile` once when a file is chosen and takes `legal_name` and `dba_name` (the `CompanyProfile` shape in `src/lib/haiwave-api.ts`) as `selfNames`. If that request fails, `selfNames` is empty and rule 6.2.1 is skipped: an own-company row would then read as `not_on_network` because the directory route excludes the caller. That degradation is accepted and tested; it never blocks the import.

## 7. Matching and checking (the tree component)

`BilateralCounterpartiesSkusFields` gains two optional props; nothing else about it changes for callers that do not pass them:

```ts
importRequest?: { id: number; counterpartyId: string; skus: string[] };
onImportResult?: (r: {
  id: number; counterpartyId: string;
  matched: string[]; notInCatalog: string[]; notAccepted: string[];
  error?: string;
}) => void;
```

On each new `importRequest.id`:
1. Add `counterpartyId` to `expandedCounterparties`.
2. The component holds the request as pending, expands the counterparty and calls `loadCatalog`; a second effect fires once that counterparty's catalog is `loaded` or carries `error` (so a load already in flight is covered), then intersects and applies. `CatalogState` gains `allIds` (the catalog before the accepted intersection) so the audit universe can tell 'not accepted' from 'not in catalog'.
3. Compute over the catalog's `external_product_id` set (and, for the audit universe, the counterparty's accepted `product_ids`):
   - `matched` = file SKUs present in the catalog (and accepted, for audits)
   - `notInCatalog` = file SKUs absent from the catalog
   - `notAccepted` = audit universe only: present in the catalog but not accepted
4. `setSkusForGroup(matched, true)` — **additive**, through the same `applySelection → emitWith → onChange` path a click uses. Expand the classes that hold matched SKUs so the checks are visible.
5. Call `onImportResult`. On a catalog load failure, call it with `error` and check nothing.

Because the selection path is shared, the emitted `{ counterparties, skus, sku_asks }` is byte-for-byte what the same hand checks produce; the readiness-watcher ask drafts, the counterparty derivation and the edit-route asymmetry guard all behave as today.

## 8. Components and files

| file | role |
|---|---|
| `src/lib/scope-import/parse-workbook.ts` | §5 parser (pure) |
| `src/lib/scope-import/classify-companies.ts` | §6 classifier (pure) |
| `src/lib/scope-import/import-copy.ts` | the sentences of §4 as pure functions of the data (so copy is unit-tested once) |
| `src/app/account/sonar/_components/scope-import-panel.tsx` | client component: file input, parse, classify (with the directory `fetch`), select, summaries; emits `importRequest` upward and receives `onImportResult` |
| `src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx` | §7 props + pending-import effects + `allIds` |
| `watcher-scope-picker.tsx`, `audit-scope-picker.tsx` | mount the panel above the tree, hold the `importRequest` / result state, pass the universe options through |
| `package.json` | `xlsx` 0.20.3 pinned tarball |
| `CHANGELOG.md` | one line under a new `v1.90` heading |

The panel needs the picker's universe options for the select and for rule 6.2.2. Rather than fetching them twice, `BilateralCounterpartiesSkusFields` exposes them through a new optional `onOptionsLoaded?: (options) => void` callback fired once when its universe request resolves; the picker holds them and hands them to the panel. No second network request.

## 9. Error handling and degradation

- Every failure is said in place inside the panel; none blocks manual checking in the tree below.
- Parse refusals (§5.4) name the ceiling or the missing columns.
- Directory lookup failures degrade to "Could not be verified" for the affected names only; the other names still classify.
- Catalog load failure during import checks nothing and says so; the tree shows its own existing error state.
- Counterparty-universe failure: the panel holds at the `parsed` phase — the parse summary plus "Checking companies against the network…" — and the tree below shows its own universe error. The parse is never lost and the panel never sits on "Reading …" waiting for a universe that is not coming. The `parsed` phase exists for exactly this: parsed-but-not-yet-classified is a state the user can be told about.
- A file read that fails (file moved, permission revoked) is caught and said as `unreadable`; the byte ceiling is checked before the read (§5.4).
- Two rapid picks: each pick takes a sequence number and a result from a superseded pick is discarded, so a slower earlier file can never overwrite the newer one's summary.
- Import is additive and idempotent: importing the same company twice checks the same SKUs and emits the same selection.
- Clearing or replacing the file resets the panel, never the selection.
- No pill is introduced (the lines are prose, not status badges), so `PILL_DEFINITIONS` is untouched; no drill-down row is introduced, so `DetailChevron` is not needed.

## 10. Testing (RED first, one behaviour at a time)

- **Parser** (`src/lib/scope-import/__tests__/parse-workbook.test.ts`): workbooks built in-test with SheetJS `write` — synonyms (`Supplier` + `Part Number`), README-then-Products sheet order, numeric SKU preserved as text (`007`, `5328285`), skipped rows counted, duplicate pairs collapsed, `too_large`, `too_many_rows` at 5,001, `no_qualifying_sheet`, `unreadable`, `.csv` input, `Company Key` not stealing from `Company Name`.
- **Classifier** (`__tests__/classify-companies.test.ts`): pickable by universe name; unconnected via lookup hit; not-on-network via empty lookup; unverified via thrown lookup; self omitted; one-character name skips lookup; concurrency respected (lookup call count = distinct non-pickable names).
- **Copy** (`__tests__/import-copy.test.ts`): the exact sentences of §4 for 0/1/N names and the match summary variants.
- **Tree component** (`_components/__tests__/bilateral-counterparties-skus-fields.import.test.tsx`, stubbed fetch): an import request expands, loads, checks matched SKUs and `onChange` receives **the same payload** as a recorded manual click sequence on the same SKUs; `notInCatalog` reported; audit universe `notAccepted` reported and not checked; additive on top of an existing selection; catalog failure → `error`, nothing checked.
- **Panel + pickers** (`__tests__/scope-import-panel.test.tsx`, `watcher-scope-picker.test.tsx`, `audit-scope-picker.test.tsx`): panel renders in both wizards; choosing a file shows the membership lines with the demo-shaped fixture; the select lists only pickable companies with SKU counts; choosing one fires the request; the summary renders the result.
- **Invariants**: the repo-wide tests run unchanged (no new route). Build (`npm run build`) is part of the gate.
- **Gate**: full vitest + build via `vitest-lock.sh`; hw-6f's / hw-bb's gates have priority. Playwright walk: not required (no route change); a browser check of the demo file on the lane's own build is the live proof.

## 11. Numbers and process

- **Counters requested: none.** No server-side parse ⇒ no D-219; no haiCore route or protocol change ⇒ no 3.87.0 involvement; no §L unless a walk finding appears.
- HaiWeb `package.json` version stays `0.1.0`; the CHANGELOG entry goes under `v1.90`; the branch carries no label.
- HOLD to agent1 with tip sha, commits over af82dc64, files/±, porcelain 0, vitest + build logs, the CHANGELOG line. Owner's push/PR word → agent1 merges (merge commit) → :3001/:3002 refresh on the word → cleanup on the word.

## 12. Out of scope (deliberately)
- Acting on companies not on the network (inviting, nominating, storing them). Informational only, per the directive.
- Fuzzy SKU matching (brand/model/family descriptors exist on `CatalogProduct` but are unread by every picker today).
- Persisting the uploaded file or its parse anywhere.
- Fixing the directory BFF's mock fallback when haiCore is unreachable (pre-existing).
- Distinguishing suspended participants (ruling R3).
