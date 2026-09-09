# Console audit display carrying design and firmware origin — design

Follow-on to `haiCore/docs/superpowers/specs/2026-09-08-design-and-firmware-origin-design.md` (D-218, owner-approved 2026-09-08; its §10 first bullet names this lane). Written 2026-09-08 in the owner's absence on the owner's standing request; the brainstorming questions were answered as rulings (§1) so the owner overturns rather than answers. **Draft until the owner approves it.** Counters are all NEXT-FREE and UNALLOCATED: one protocol MINOR (3.87.0 candidate, after D-218's 3.86.0), one decision number (D-219 candidate), one register revision, one HaiWeb slot. Nothing below is written until agent1 allocates and the owner releases the lane; the lane starts only after D-218 (haiCore v1.93) has merged and HaiWeb's protocol is re-vendored to 3.86.0 or later.

## 1. Problem, scope, rulings

D-218 puts design origin and firmware origin on the manifest and carries them through the audit path: `OriginDisclosure.design_country_of_origin` / `firmware_country_of_origin` on the universal floor, `AuditRunResult.design_geo_rollup` / `firmware_geo_rollup` beside `geo_rollup`, and an attestation `dimension`. The console's audit surfaces still read only manufacturing: the run-detail SKU grid derives its country and its domestic flag from `geo_rollup`; the dashboard geo chart and the Coverage-by-Partner chart merge `geo_rollup`; the run history Domestic column reads `fully_resolved_skus_by_country`; the audit report CSV/HTML/PDF carry a manufacturing-only geographic rollup and no per-SKU country at all. A buyer who requires domestic design cannot see, on any audit surface, which SKUs are CN-designed under a TW plant.

Surfaces in scope (§10 of D-218, verbatim): the audit run grid, the dashboard geo chart and partner-compliance weights, the fully-domestic badge and `fully_resolved_skus_by_country`, the audit report CSV/HTML/PDF. Display and rollup semantics only; no manifest, relay, verdict, or watcher change.

Approaches considered for how per-dimension data reaches the console:
- **A (chosen): sibling fields per dimension, named `design_*` / `firmware_*`**, mirroring D-218's approach B and its `design_geo_rollup` precedent. Additive; every existing consumer of the manufacturing field is untouched; a consumer not taught the dimension shows nothing.
- B: a dimension-keyed map (`rollups_by_dimension: { manufacturing, design, firmware }`). Cleaner to iterate, but either duplicates `geo_rollup` on the wire or moves it and breaks consumers. Rejected.
- C: the console derives everything from evidence trees, no haiCore change. Works for the grid and dashboard (the console already holds per-result rollups) but not for the reports, which haiCore renders. Adopted where it fits (R2), rejected as the whole answer.

Rulings made 2026-09-08 (each: decision — why — cost if wrong):
- **R1 Sibling fields (approach A).** — same argument that won approach B for the manifest — none on the wire; naming only.
- **R2 Per-dimension "fully domestic" is derived in the console from the run's own results, not added to the wire.** The run-detail page already fetches every `AuditRunResult`; the per-SKU definition `isFullyDomestic(rollup, auditorCountry)` applied to `design_geo_rollup` / `firmware_geo_rollup` is the per-dimension definition, and the run-level count is the number of SKUs that pass it. `fully_resolved_skus_by_country` (manufacturing, server-computed) stays as is and keeps feeding the run history column. — D-218 computes the dimension rollups at read time from the stored tree (no persisted column), so a server-side run-level count would need either a new persisted column plus migration or a tree walk per result row inside the cross-run history query; neither is warranted for one summary line. — If the run HISTORY list later needs per-dimension counts across runs, a persistence lane follows; the console definition written here becomes the server's.
- **R3 Undeclared is never domestic, and renders no chip.** A dimension whose rollup is empty or all-`<unknown>` for a SKU earns no domestic badge and no country chip; the `<unknown>` share is visible as the grey bar of the dashboard chart under that dimension's lens. — The badge is a positive claim (D-218 §2: null = undeclared, an ordinary state without a buyer flag), and the approved spec's HaiWeb rule is "no card / no chip when null, no placeholder". — A buyer chasing a design gap reads it off the dashboard lens or the relay verdict, one step from the row, rather than in the row itself.
- **R4 One dashboard lens — Manufacturing (default) · Design · Firmware — shared by the geo chart and the Coverage-by-Partner chart; the risk pill stays on manufacturing.** — Two independent toggles on one dashboard would let the two panels disagree; the risk score is a headline composite (audit weight × 0.4) and must not flip with a view control. — A buyer whose whole concern is design risk sees a manufacturing risk number; a per-dimension risk score is a scoring-semantics decision for the owner (§7).
- **R5 Lens state lives in the client; the loader computes all three datasets server-side.** No URL parameter, no persistence; a reload returns to Manufacturing. — The loader already merges one run's results; three merges over the same rows cost nothing measurable and the switch is instant. — A shared link cannot carry the lens; add a search param later if asked.
- **R6 Run history Domestic column unchanged; per-dimension counts appear on the run-detail page only** (a summary line above the grid, R2). — The history list has no results to derive from (R2) and a three-number cell would crowd a column pack. — A reader scanning history for design coverage opens the run.
- **R7 Rider, same lines: the Coverage-by-Partner and audit-weight builders hard-code `'US'` as the compliant country; they take `auditor_country`.** Unknown auditor country ⇒ no compliance rows (the chart's existing null state) and an empty weights map, which must yield the same risk pill as a run with no results. — Live user-visible defect for any non-US auditor, on the exact lines this lane rewrites (the D-218 `primary` rider precedent). — An account with no company country loses a chart that was silently wrong; the copy names the fix (§5.2).
- **R8 Reports: per-vendor SKU rows gain three country columns (manufacturing included), appended last; the aggregate geographic rollup becomes three rollups; the aggregate vendor CSV is unchanged.** — The per-SKU CSV carries no country today; adding design and firmware without manufacturing would read as an error, and appending keeps positional readers intact. The aggregate CSV is one row per vendor with no geo section to extend. — A wider CSV; consumers that assert an exact header break and are fixed by appending.
- **R9 Evidence export unchanged.** `evidenceNodeHtml` prints `geo` as the whole `OriginDisclosure`, which carries the two floor countries after D-218, and D-218 already labels the attestation pill with its dimension. — Nothing to add. — None.
- **R10 Copy.** Labels "Manufacturing", "Design", "Firmware"; a chip title is a sentence ("Design origin: China (CN)"); countries render as the curated flag when one exists, else the ISO-2 code; never a raw sentinel — `<unknown>` is written "Unknown / undisclosed" (the existing haiCore label) in reports and is the grey bar on the chart. No vendor names anywhere new.

## 2. Semantics

| concept | source | rule |
|---|---|---|
| SKU's countries in a dimension | that dimension's rollup on the `AuditRunResult` | distinct `country_of_origin` values in rollup order (desc by count), `<unknown>` excluded from chips, kept in reports |
| SKU fully domestic in a dimension | `isFullyDomestic(<dimension rollup>, auditorCountry)` | non-empty and every entry equals the auditor's country; `<unknown>` disqualifies; empty = not domestic |
| run fully-domestic count per dimension | console, over the run's results | count of SKUs passing the rule above; total = `results.length` |
| dashboard lens | client state | `'manufacturing' \| 'design' \| 'firmware'`, default manufacturing |
| partner non-compliant components under a lens | that dimension's rollup | entries whose country ≠ `auditor_country`, `<unknown>` counted as non-compliant (as today for manufacturing) |

Manufacturing behaviour is byte-for-byte unchanged under the default lens: same rollup, same badge, same counts, same report columns in the same order — the three new CSV columns follow the existing ones.

## 3. Protocol (`packages/protocol/src/audit/report.ts`) — one MINOR mint

- `AggregateReportSchema` gains `design_geographic_rollup` and `firmware_geographic_rollup`, each `z.array(GeographicRollupRowSchema).optional()`. `geographic_rollup` unchanged.
- `SkuTableRowSchema` gains `countries_of_origin`, `design_countries`, `firmware_countries`, each `z.array(z.string()).optional()` — distinct rollup keys, `<unknown>` last, empty when the SKU has no rollup in that dimension.
- `version.ts`: one MINOR entry in the 3.86.0 shape; the next-free line moves on. No other schema changes; `AuditRunSchema`, `AuditRunResultSchema`, `OriginDisclosureSchema` stay as D-218 left them.

## 4. haiCore (`apps/core`) — reports only

### 4.1 `services/audit-report-service.ts`
The aggregate builder runs the existing geo-map sum three times, over `geo_rollup`, `design_geo_rollup`, `firmware_geo_rollup` of each result (the rows come through D-218's `mapResultRow`, which computes the dimension rollups from the stored tree; nothing new is persisted). `country_label` uses `COUNTRY_LABELS`, so `<unknown>` reads "Unknown / undisclosed". The per-vendor SKU-table builder emits the three arrays per row.

### 4.2 Renderers
- `lib/report-csv-serializer.ts`: the per-vendor header and body gain `countries_of_origin`, `design_countries`, `firmware_countries` as the last three columns, each value the array joined by `;`, empty cell when empty. The aggregate serializer is unchanged.
- `lib/report-html-renderer.ts` and `lib/report-pdf.ts`: the "Geographic Rollup" section becomes three sub-tables headed Manufacturing, Design, Firmware, each in today's column shape; a sub-table whose rollup is empty prints one line "No components declared for this dimension." The per-vendor SKU table gains three columns after `predominant_resolution_class` — Manufacturing, Design, Firmware — each printing the ISO-2 codes joined by ", ", or "—" when empty, so the three dimensions read together.
- Evidence-mode HTML: unchanged (R9).

### 4.3 Decision record
One D row in `docs/security/security-compliance.md`, D-207's shape: the console and reports display the two D-218 dimensions; no new disclosure — every value shown is a floor field already on the wire; entity and site stay key-gated and are not displayed here. One revision row.

## 5. HaiWeb

Types come from `@haiwave/protocol` at a build ≥ 3.86.0 (D-218) — the console reads only the per-result rollups, so the 3.87.0 reports mint is not a dependency and the HaiWeb PR may run in parallel with the haiCore reports PR once D-218 has merged (plan-time refinement 2026-09-08 of the §6 order). Every file below is named from the 2026-09-08 tree at master `af82dc64`.

### 5.1 Run-detail grid — `src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx`
- `SkuEvidenceRow` renders, after the existing manufacturing `DomesticFlagBadge`, one domestic badge per dimension that passes `isFullyDomestic(row.result.design_geo_rollup ?? [], auditorCountry)` (and firmware), each carrying a short text label "Design" / "Firmware" beside the flag and a sentence title ("Every design origin in this SKU's tree is domestic."). The manufacturing badge is unchanged in look and position.
- Below the headline sub-head, a `DimensionCountryChips` row (new, `src/app/account/sonar/audit/_lib/dimension-countries.tsx`): for each of design and firmware whose rollup has at least one resolved country, a group labelled "Design" / "Firmware" followed by one chip per distinct country (flag from `FLAG_COMPONENTS` when present, else the ISO-2 code), title per R10. No group when the dimension has no resolved country (R3). The row itself does not render when neither dimension has one — the D-207 "no node when all absent" convention.
- The grid's header area gains one summary line (R2/R6): "Fully domestic — Manufacturing 12 of 40 · Design 3 of 40 · Firmware 0 of 40", each figure computed in the component from `results` with the rule in §2; the manufacturing figure uses the same rule over `geo_rollup` so the three are comparable (the history column's server figure may differ only when a result row lacks a rollup; that is the existing behaviour and is not reconciled here).
- `_lib/domestic.tsx`: `isFullyDomestic` unchanged; a thin `countDomesticByDimension(results, auditorCountry)` returning `{ manufacturing, design, firmware, total }` is added beside it so the grid and its tests share one definition.

### 5.2 Dashboard — `src/app/account/sonar/dashboard/`
- `_lib/load-audit-charts.ts`: `AuditChartData` gains `rollupByDimension: Record<Dimension, GeoRollupEntry[]>` and `partnerComplianceByDimension: Record<Dimension, PartnerComplianceData | null>`, computed by the same merge run over `geo_rollup`, `design_geo_rollup`, `firmware_geo_rollup`; the existing `rollup` and `partnerCompliance` keep their values (= the manufacturing entries) so untouched consumers and tests keep passing. The loader switches its runs fetch to the enriched list route `/api/account/sonar/audit/runs?limit=25`, which returns `auditor_country` beside `runs`, and passes it to the builders (R7).
- `_lib/partner-compliance.ts` `buildPartnerCompliance(latestRun, results, auditorCountry, dimension = 'manufacturing')` and `_lib/audit-weights.ts` `buildPerPartnerAuditWeights(latestRun, results, auditorCountry)`: the `'US'` literal is replaced by the parameter; `dimension` selects which rollup is read. `auditorCountry` undefined ⇒ `null` / an empty map (R7). The risk score keeps calling the weights builder for manufacturing only (R4).
- `_charts/geo-chart.tsx` and `_charts/partners-chart.tsx`: unchanged in shape; they receive the lens's dataset. Titles follow the lens: "Components by country" / "Components by design country" / "Components by firmware country"; the partners footnote reads "* Components outside {auditorCountry}" (was "* Non US Based Components"), or "Set your company country to see partner compliance." when unknown.
- New `_components/dimension-lens.tsx`: a client component wrapping the two charts with a three-option control (Manufacturing · Design · Firmware) built on `components/sonar/section-tabs.tsx` semantics (tablist, arrow keys, `hidden` panels) — reuse `SectionTabs` if its API fits, else the same pattern; never a third tab implementation. Default Manufacturing (R5). `page.tsx` mounts it where the two charts sit today.

### 5.3 Run history — `src/app/account/sonar/audit/_components/audit-column-packs.tsx`
Unchanged (R6). The Domestic column's tooltip gains one sentence: "Manufacturing origin; open the run for design and firmware."

### 5.4 Pills and copy
Country chips are not `Pill` categories (they are values, not enumerations) and do not enter `PILL_DEFINITIONS`; the domestic badge stays the flag component. All new strings are sentences or labels per R10.

## 6. Compatibility, security, rollout

- **Wire.** Report fields optional; old report consumers ignore them; new HaiWeb on an older haiCore (no `design_geo_rollup` on results) renders no chips, no dimension badges, "0 of N" under Design and Firmware, and an empty Design/Firmware lens — all from `?? []`. Order: **haiCore → HaiWeb**.
- **Verdicts.** None change; this lane never touches the relay, GoFish, or postures.
- **Security.** §4.3. Every displayed value is a universal-floor field (D-218 §1); entity and site are not displayed. No new door.
- **Rider R7** changes what a non-US auditor sees on the partners chart and risk pill: from a wrong US-relative figure to the right one, or to the empty state when the company country is unset.
- **Gates.** HaiWeb `npm run build` exit read directly; full vitest; no `(retry x`. haiCore gate on a lane DB only, one vitest gate at a time (`vitest-lock.sh`, quiet machine). Counters: ask agent1 before writing any; report each use by message.

## 7. §L (deferred, not forgotten)

- Per-dimension risk score / audit weights under a lens (R4): an owner scoring decision.
- Lens in the URL (R5) and per-dimension counts on the run history list (R2/R6, needs persistence).
- Aggregate CSV geographic section (none exists today for any dimension).
- Watcher change describers naming a design or firmware country change (already §L in D-218).

## 8. Testing (red then green per behaviour, one at a time)

- **Protocol.** Aggregate report with and without the two rollups parses; SKU row with and without the three arrays parses.
- **haiCore.** Aggregate builder: three rollups from a fixture with a CN-designed TW-fabbed node and an undeclared node (design rollup has CN and `<unknown>`; firmware rollup all `<unknown>`; manufacturing rollup unchanged from the existing test). Per-vendor rows: the three arrays, `<unknown>` last, empty when no rollup. CSV: header ends with the three new columns, existing columns byte-identical, `;`-joined values, empty cell. HTML and PDF: three sub-tables present, empty-dimension sentence, SKU table Design/Firmware columns with "—".
- **HaiWeb.** Grid: a result with `design_geo_rollup` all-US earns the Design badge and not the Firmware badge; all-`<unknown>` design earns no chip group; a result with no dimension rollups renders no chips row (assert absence); the summary line's three figures from a three-result fixture. `countDomesticByDimension` unit cases. Loader: three merged datasets from a fixture; manufacturing dataset equals today's `rollup`; enriched route consumed; `auditor_country` threaded. Partner compliance: `auditorCountry = 'DE'` marks US components non-compliant; `undefined` ⇒ `null`; `dimension: 'design'` reads the design rollup. Weights: empty map ⇒ risk pill equals the no-results case. Lens: default Manufacturing, switching swaps the datasets and titles, keyboard navigation per the tablist pattern. Gate: `npm run build` exit 0; full vitest; no `(retry x`.
- **Owner walk.** With D-218's seeded radio (CN design / CN firmware / TW manufacture) in a completed run on :3002 against the lane Central: the SKU row shows Design CN and Firmware CN chips and no dimension badge; the dashboard Design lens shows a CN bar; the per-vendor CSV row ends `TW;…, CN, CN`; the HTML report shows three geographic tables.

## 9. Delivery

1. haiCore PR on a lane worktree with a lane DB: protocol MINOR + §4 + the D row. Owner merges; agent1 tags.
2. HaiWeb PR: §5, protocol link repointed for development and restored after merge (the D-207 pattern). Owner merges.
Each PR: its own SDD run (plan → tasks → per-task review → final review → one fix wave → gate); a spec-only reviewer sees this spec + the diff, nothing else.
