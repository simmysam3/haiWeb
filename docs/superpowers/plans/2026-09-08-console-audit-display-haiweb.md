# Console audit display — HaiWeb half (design + firmware origin on the audit surfaces) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The console's audit surfaces show design and firmware origin beside manufacturing origin: per-SKU country chips and per-dimension domestic badges on the run-detail grid, a per-dimension "fully domestic" summary line, and a Manufacturing / Design / Firmware lens on the dashboard's geo and partner charts — with the partner-compliance builders reading the auditor's country instead of a hard-coded `US`.

**Architecture:** Pure helpers first (`origin-dimension.ts`: `Dimension`, `rollupFor`, `resolvedCountriesOf`, `countryName`; `domestic.tsx`: `countDomesticByDimension`), then the grid, then the dashboard data layer (builders + loader + the cross-modality route), then the lens UI. Every per-dimension figure is derived in the console from the run's own `AuditRunResult` rows (spec R2) — no new BFF route, no haiCore dependency beyond D-218's per-result `design_geo_rollup` / `firmware_geo_rollup` (protocol 3.86.0). Manufacturing rendering under the default lens is unchanged.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind v4, recharts, vitest + Testing Library (jsdom; `retry: 2` configured — a `(retry x` in output is NOT green), `@haiwave/protocol` via the `node_modules/@haiwave/protocol` symlink (types only at build time).

**Spec:** `docs/superpowers/specs/2026-09-08-console-audit-display-design-firmware-origin-design.md` (owner-approved 2026-09-08). §1 rulings R1–R10 bind; §2, §5, §8 are this plan's requirements. Task 5 commits the spec beside this plan.

## Global Constraints

- **Worktree `/Users/samfleming/dev/hw/haiWeb-audit-display`, NEW branch `console-audit-display` from `origin/master`** (Task 1 Step 1). Every command starts with `cd /Users/samfleming/dev/hw/haiWeb-audit-display…` or `git -C /Users/samfleming/dev/hw/haiWeb-audit-display`. The primary `~/dev/hw/haiWeb` serves :3001/:3002 — never edit, check out, build or install there.
- **Protocol link is a BUILD-TIME concern only.** `node_modules/@haiwave/protocol -> ../../../haiCore/packages/protocol` (the primary's dist). This plan needs `AuditRunResult.design_geo_rollup` / `firmware_geo_rollup` — protocol **≥ 3.86.0 (D-218)**; it does NOT need 3.87.0 (the reports mint is haiCore-internal), so this lane may run as soon as D-218 is merged and the primary dist rebuilt, in parallel with the haiCore reports half (the spec's "haiCore → HaiWeb" order was the wire dependency; there is none here — flagged to the owner in the plan's header). Tests use `import type` and vitest strips types, so they pass at any link; only `tsc` / `npm run build` need the types. Check with `cd /Users/samfleming/dev/hw/haiWeb-audit-display && node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'` → `3.86.0` or higher. If lower: repoint ONLY on the controller's word to a worktree that carries D-218 (`ln -sfn ../../../haiCore-<worktree>/packages/protocol node_modules/@haiwave/protocol`), and restore (`ln -sfn ../../../haiCore/packages/protocol node_modules/@haiwave/protocol`) after the primary dist is rebuilt. Never edit anything under any haiCore tree.
- **HaiWeb slot ALLOCATED by agent1 (`hw-48`) before Task 1 Step 2** (`v1.9x PR n`); the PR title carries it. No register row (the register is haiCore's; D-219's row names this PR). No new decision number.
- Every vitest through the machine-wide mutex: `/Users/samfleming/dev/hw/vitest-lock.sh npx vitest run <files> --maxWorkers=3` from the worktree root. Before any run: `pgrep -fl vitest` empty and load < ~10 (`uptime`); after any abort, kill your own ppid-1 tinypool orphans. Read exit codes on the next line (`echo "exit=$?"`). Gates FOREGROUND; the controller announces the Task 5 gate to every live peer by name.
- **Semantics (spec §2).** `Dimension = 'manufacturing' | 'design' | 'firmware'`. A SKU's countries in a dimension = distinct `country_of_origin` values of that dimension's rollup, most components first; `<unknown>` and `XX` are not countries and never become chips. "Fully domestic in a dimension" = `isFullyDomestic(<dimension rollup>, auditorCountry)` unchanged (non-empty AND every entry equals the auditor's country). Undeclared is never domestic and renders no chip (R3). The dashboard lens defaults to Manufacturing, lives in client state only (R5); the risk pill stays manufacturing (R4). Under the default lens every manufacturing surface renders exactly as today.
- **Copy (R10).** Labels `Manufacturing` / `Design` / `Firmware`; chip title `"<Dimension> origin: <Country name> (<CODE>)"`; badge title `"Every <dimension> origin in this SKU's tree is domestic."`; geo chart titles `Components by country` / `Components by design country` / `Components by firmware country`; partners footnote `* Components outside <CODE>`; unknown-auditor message `Set your company country to see partner compliance.`; Domestic column tooltip gains `Manufacturing origin; open the run for design and firmware.` No raw sentinels, no vendor names, no new `Pill` categories (country chips are values, not enumerations).
- Comments dated `D-219 (2026-09-08)`, one sentence of why. No `any`. Commit after every green task; messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. **No push / PR / merge / deploy** — Task 5 HOLDS for the owner.
- Line numbers below were read on `master` `af82dc64` (2026-09-08); locate every edit by SYMBOL NAME.

---

### Task 1: Worktree; shared dimension helpers; per-dimension domestic counts

**Files:**
- Create: `src/app/account/sonar/_lib/origin-dimension.ts`
- Modify: `src/app/account/sonar/audit/_lib/domestic.tsx` (append `countDomesticByDimension`)
- Test: Create `src/app/account/sonar/_lib/__tests__/origin-dimension.test.ts`, `src/app/account/sonar/audit/_lib/__tests__/domestic-dimensions.test.ts`

**Interfaces:**
- Produces: `type Dimension`; `DIMENSIONS: readonly Dimension[]` (manufacturing, design, firmware — in that order); `DIMENSION_LABEL: Record<Dimension, string>`; `rollupFor(result: AuditRunResult, dimension: Dimension): GeoRollupEntry[]`; `resolvedCountriesOf(rollup: GeoRollupEntry[]): string[]`; `countryName(code: string): string`; `countDomesticByDimension(results: AuditRunResult[], auditorCountry: string | undefined): DomesticCounts` where `DomesticCounts = { manufacturing: number; design: number; firmware: number; total: number }`.

- [ ] **Step 1: Worktree**

```bash
git -C /Users/samfleming/dev/hw/haiWeb fetch origin
git -C /Users/samfleming/dev/hw/haiWeb worktree add /Users/samfleming/dev/hw/haiWeb-audit-display -b console-audit-display origin/master
cd /Users/samfleming/dev/hw/haiWeb-audit-display && cp -c -R /Users/samfleming/dev/hw/haiWeb/node_modules ./node_modules && cp /Users/samfleming/dev/hw/haiWeb/.env* . 2>/dev/null; ls -la .env* 
node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'     # >= 3.86.0, else see Global Constraints (types only; tests run regardless)
```
(`cp -c` APFS-clones node_modules; the `@haiwave/protocol` symlink inside it is copied as a symlink and still resolves relative to the worktree's own `node_modules/@haiwave/` — verify with the `node -e` line.)

- [ ] **Step 2: Failing tests**

```ts
// src/app/account/sonar/_lib/__tests__/origin-dimension.test.ts
import { describe, it, expect } from 'vitest';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import { DIMENSIONS, DIMENSION_LABEL, rollupFor, resolvedCountriesOf, countryName } from '../origin-dimension';

const entry = (country_of_origin: string, component_count: number): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
// The helpers read only the three rollup fields; cast the rest away (the house fixture style).
const result = (r: Partial<AuditRunResult>): AuditRunResult => ({ geo_rollup: [], ...r } as unknown as AuditRunResult);

// D-219 (2026-09-08): one definition of "which rollup" and "which countries" for every audit surface.
describe('origin-dimension', () => {
  it('lists the three dimensions, manufacturing first, with sentence-case labels', () => {
    expect(DIMENSIONS).toEqual(['manufacturing', 'design', 'firmware']);
    expect(DIMENSION_LABEL).toEqual({ manufacturing: 'Manufacturing', design: 'Design', firmware: 'Firmware' });
  });
  it('rollupFor reads the matching field and is [] for a dimension an older haiCore did not send', () => {
    const r = result({ geo_rollup: [entry('TW', 3)], design_geo_rollup: [entry('CN', 2)] });
    expect(rollupFor(r, 'manufacturing')).toEqual([entry('TW', 3)]);
    expect(rollupFor(r, 'design')).toEqual([entry('CN', 2)]);
    expect(rollupFor(r, 'firmware')).toEqual([]);
  });
  it('resolvedCountriesOf: distinct, most components first, sentinels dropped', () => {
    expect(resolvedCountriesOf([entry('<unknown>', 9), entry('US', 1), entry('CN', 4), entry('XX', 2), entry('CN', 1)])).toEqual(['CN', 'US']);
    expect(resolvedCountriesOf([entry('<unknown>', 1)])).toEqual([]);
    expect(resolvedCountriesOf([])).toEqual([]);
  });
  it('countryName names a known code and falls back to the code', () => {
    expect(countryName('CN')).toBe('China');
    expect(countryName('TW')).toBe('Taiwan');
    expect(countryName('ZZ')).toBe('ZZ');
    expect(countryName('<unknown>')).toBe('<unknown>');
  });
});
```

```ts
// src/app/account/sonar/audit/_lib/__tests__/domestic-dimensions.test.ts
import { describe, it, expect } from 'vitest';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import { countDomesticByDimension } from '../domestic';

const entry = (country_of_origin: string, component_count = 1): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
const result = (r: Partial<AuditRunResult>): AuditRunResult => ({ geo_rollup: [], ...r } as unknown as AuditRunResult);

// D-219 (2026-09-08): the run's per-dimension "fully domestic" counts, derived from its own results (spec R2).
describe('countDomesticByDimension', () => {
  const results = [
    result({ geo_rollup: [entry('US', 3)], design_geo_rollup: [entry('US')], firmware_geo_rollup: [entry('US')] }),          // domestic in all three
    result({ geo_rollup: [entry('US', 2)], design_geo_rollup: [entry('CN')], firmware_geo_rollup: [entry('<unknown>')] }),   // manufacturing only
    result({ geo_rollup: [entry('TW')], design_geo_rollup: [entry('US')] }),                                                 // design only; firmware undeclared
  ];
  it('counts each dimension with the per-SKU definition and reports the total', () => {
    expect(countDomesticByDimension(results, 'US')).toEqual({ manufacturing: 2, design: 2, firmware: 1, total: 3 });
  });
  it('undeclared or unresolved never counts as domestic', () => {
    expect(countDomesticByDimension([results[1], results[2]], 'US').firmware).toBe(0);
  });
  it('no auditor country: zero everywhere, total still the row count', () => {
    expect(countDomesticByDimension(results, undefined)).toEqual({ manufacturing: 0, design: 0, firmware: 0, total: 3 });
  });
  it('no results: all zero', () => {
    expect(countDomesticByDimension([], 'US')).toEqual({ manufacturing: 0, design: 0, firmware: 0, total: 0 });
  });
});
```

- [ ] **Step 3: Run them — expect FAIL**

```bash
cd /Users/samfleming/dev/hw/haiWeb-audit-display && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/app/account/sonar/_lib/__tests__/origin-dimension.test.ts src/app/account/sonar/audit/_lib/__tests__/domestic-dimensions.test.ts --maxWorkers=2 ; echo "exit=$?"
```
Expected: FAIL — `Failed to resolve import "../origin-dimension"`; `countDomesticByDimension` is not exported.

- [ ] **Step 4: Implementation**

```ts
// src/app/account/sonar/_lib/origin-dimension.ts
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';

/**
 * D-219 (2026-09-08): the three origin dimensions every audit surface can show. Manufacturing is
 * the one the surfaces always showed; design and firmware arrived with D-218 (protocol 3.86.0) as
 * sibling rollups on each result row.
 */
export type Dimension = 'manufacturing' | 'design' | 'firmware';
export const DIMENSIONS: readonly Dimension[] = ['manufacturing', 'design', 'firmware'];
export const DIMENSION_LABEL: Record<Dimension, string> = {
  manufacturing: 'Manufacturing',
  design: 'Design',
  firmware: 'Firmware',
};

// haiCore's rollup bucket for a component whose country could not be resolved, and the older
// tree-node sentinel — neither is a country (see audit/_lib/domestic.tsx).
const UNKNOWN_ORIGIN = '<unknown>';
const UNKNOWN_ISO = 'XX';

/** The result's rollup for one dimension; [] when a pre-3.86.0 haiCore sent none. */
export function rollupFor(result: AuditRunResult, dimension: Dimension): GeoRollupEntry[] {
  switch (dimension) {
    case 'manufacturing':
      return result.geo_rollup;
    case 'design':
      return result.design_geo_rollup ?? [];
    case 'firmware':
      return result.firmware_geo_rollup ?? [];
  }
}

/** Distinct resolved countries, most components first; the unknown buckets are not countries. */
export function resolvedCountriesOf(rollup: GeoRollupEntry[]): string[] {
  const out: string[] = [];
  for (const e of [...rollup].sort((a, b) => b.component_count - a.component_count)) {
    const c = e.country_of_origin;
    if (c === UNKNOWN_ORIGIN || c === UNKNOWN_ISO || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/** "China" for CN; the code itself when Intl does not know it (a sentinel or a bad code). */
export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}
```

Append to `src/app/account/sonar/audit/_lib/domestic.tsx` (add `import type { AuditRunResult } from '@haiwave/protocol'` to its protocol import and `import { DIMENSIONS, rollupFor, type Dimension } from '@/app/account/sonar/_lib/origin-dimension';`):
```tsx
export type DomesticCounts = Record<Dimension, number> & { total: number };

/**
 * D-219 (2026-09-08): the run's "fully domestic" count per dimension, derived from its own result
 * rows with the per-SKU rule above (spec R2) — the manufacturing figure uses the same rule over
 * geo_rollup so the three are comparable.
 */
export function countDomesticByDimension(
  results: AuditRunResult[],
  auditorCountry: string | undefined,
): DomesticCounts {
  const counts: DomesticCounts = { manufacturing: 0, design: 0, firmware: 0, total: results.length };
  if (!auditorCountry) return counts;
  for (const r of results) {
    for (const d of DIMENSIONS) {
      if (isFullyDomestic(rollupFor(r, d), auditorCountry)) counts[d] += 1;
    }
  }
  return counts;
}
```

- [ ] **Step 5: Run them — expect PASS** (same command). Then `npx tsc --noEmit -p . ; echo "exit=$?"` → 0 (needs the ≥ 3.86.0 link; if the link is behind, record the exit and the reason, and run it again at Task 5).

- [ ] **Step 6: Commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-audit-display && git add src/app/account/sonar/_lib/origin-dimension.ts src/app/account/sonar/_lib/__tests__/origin-dimension.test.ts src/app/account/sonar/audit/_lib/domestic.tsx src/app/account/sonar/audit/_lib/__tests__/domestic-dimensions.test.ts
git commit -m "feat(sonar): origin dimensions — rollup, country and per-dimension domestic helpers (D-219)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Run-detail grid — dimension chips, per-dimension badges, the summary line; Domestic column tooltip

**Files:**
- Create: `src/app/account/sonar/audit/_lib/dimension-countries.tsx`
- Modify: `src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx` (`SkuEvidenceRow`; the status bar inside `TierGapGrid`), `src/app/account/sonar/audit/_components/audit-column-packs.tsx` (the `domestic` column's `headerTitle`)
- Test: Modify `src/app/account/sonar/audit/[run_id]/_components/__tests__/tier-gap-grid.test.tsx`; Create `src/app/account/sonar/audit/_lib/__tests__/dimension-countries.test.tsx`

**Interfaces:**
- Consumes: Task 1's helpers; `DomesticFlagBadge`, `isFullyDomestic` (existing); `FLAG_COMPONENTS` (existing).
- Produces: `DimensionCountryChips({ result }: { result: AuditRunResult })` — renders `null` when neither design nor firmware has a resolved country; otherwise `data-testid="dimension-countries"`. Grid: `data-testid="domestic-by-dimension"` summary line; per-dimension badges `data-testid="domestic-badge-design"` / `"domestic-badge-firmware"`.

- [ ] **Step 1: Failing tests** — `dimension-countries.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import { DimensionCountryChips } from '../dimension-countries';

const entry = (country_of_origin: string, component_count = 1): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
const result = (r: Partial<AuditRunResult>): AuditRunResult => ({ geo_rollup: [], ...r } as unknown as AuditRunResult);

// D-219 (2026-09-08): design/firmware country chips on a SKU row; nothing when undeclared (spec R3).
describe('DimensionCountryChips', () => {
  it('renders a labelled group per dimension with one chip per resolved country, most components first', () => {
    render(<DimensionCountryChips result={result({ design_geo_rollup: [entry('US', 1), entry('CN', 3)], firmware_geo_rollup: [entry('CN')] })} />);
    const row = screen.getByTestId('dimension-countries');
    expect(row).toHaveTextContent(/^Design.*Firmware/);
    const chips = screen.getAllByTitle(/origin:/);
    expect(chips.map((c) => c.getAttribute('title'))).toEqual([
      'Design origin: China (CN)', 'Design origin: United States (US)', 'Firmware origin: China (CN)',
    ]);
  });
  it('an unresolved-only dimension renders no group; both unresolved renders nothing at all', () => {
    render(<DimensionCountryChips result={result({ design_geo_rollup: [entry('<unknown>')], firmware_geo_rollup: [entry('DE')] })} />);
    expect(screen.getByTestId('dimension-countries')).not.toHaveTextContent('Design');
    expect(screen.getByTitle('Firmware origin: Germany (DE)')).toBeInTheDocument();
  });
  it('renders null when neither dimension has a resolved country (undeclared, or a pre-3.86.0 row)', () => {
    const { container } = render(<DimensionCountryChips result={result({ design_geo_rollup: [entry('<unknown>')] })} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('a code without a flag asset renders as the code', () => {
    render(<DimensionCountryChips result={result({ firmware_geo_rollup: [entry('ZZ')] })} />);
    expect(screen.getByTitle('Firmware origin: ZZ (ZZ)')).toHaveTextContent('ZZ');
  });
});
```

`tier-gap-grid.test.tsx` — extend the existing `result(...)` helper's `Descriptors` type to also accept `design_geo_rollup` / `firmware_geo_rollup` / `geo_rollup` (`Partial<Pick<AuditRunResult, 'product_name' | … | 'geo_rollup' | 'design_geo_rollup' | 'firmware_geo_rollup'>>`), and add a describe (reuse the file's `node`, `result`, `RUN`; `entry` as in the other tests):

```tsx
// D-219 (2026-09-08): per-dimension badges, chips and the run summary line.
describe('design and firmware dimensions (D-219)', () => {
  const entry = (country_of_origin: string, component_count = 1) => ({ country_of_origin, component_count, depth_distribution: {} });
  const tree = node(1, false, [], 'Acme');
  const allUs = result('ALL-US', 'v1', tree, { geo_rollup: [entry('US', 2)], design_geo_rollup: [entry('US')], firmware_geo_rollup: [entry('US')] });
  const cnDesign = result('CN-DES', 'v1', tree, { geo_rollup: [entry('US')], design_geo_rollup: [entry('CN', 2), entry('US')], firmware_geo_rollup: [entry('<unknown>')] });
  const plain = result('PLAIN', 'v1', tree, { geo_rollup: [entry('TW')] });

  it('an all-US design rollup earns the Design badge; an unresolved firmware rollup earns none', () => {
    render(<TierGapGrid run={RUN} results={[allUs, cnDesign]} auditorCountry="US" />);
    expect(screen.getAllByTestId('domestic-badge-design')).toHaveLength(1);
    expect(screen.getByTestId('domestic-badge-design')).toHaveAttribute('title', "Every design origin in this SKU's tree is domestic.");
    expect(screen.getAllByTestId('domestic-badge-firmware')).toHaveLength(1);
  });
  it('chips list the resolved design countries; an unresolved firmware rollup gets no group; a plain row gets no chips row', () => {
    render(<TierGapGrid run={RUN} results={[cnDesign, plain]} auditorCountry="US" />);
    expect(screen.getAllByTestId('dimension-countries')).toHaveLength(1);
    expect(screen.getByTitle('Design origin: China (CN)')).toBeInTheDocument();
    expect(screen.getByTestId('dimension-countries')).not.toHaveTextContent('Firmware');
  });
  it('the summary line reports the three counts over the run', () => {
    render(<TierGapGrid run={RUN} results={[allUs, cnDesign, plain]} auditorCountry="US" />);
    expect(screen.getByTestId('domestic-by-dimension')).toHaveTextContent('Fully domestic — Manufacturing 2 of 3 · Design 1 of 3 · Firmware 1 of 3');
  });
  it('no auditor country: no dimension badges and no summary line; chips still render', () => {
    render(<TierGapGrid run={RUN} results={[allUs, cnDesign]} />);
    expect(screen.queryByTestId('domestic-badge-design')).toBeNull();
    expect(screen.queryByTestId('domestic-by-dimension')).toBeNull();
    expect(screen.getAllByTestId('dimension-countries')).toHaveLength(2);
  });
});
```
(`allUs` has a Design and Firmware badge and an all-US chips row: Design US · Firmware US — so `cnDesign` alone accounts for the second test's single chips row only because `plain` has none; keep the fixtures as written.)

Also in `audit-column-packs` there is no component test to extend for a tooltip string — Task 2 adds one assertion to the run-history table test if one renders the pack (`grep -rl "buildAuditHistoryColumnPack" src --include='*.test.tsx'`); if none exists, the tooltip edit is covered by the build and by the Task 5 walk, and the report says so.

- [ ] **Step 2: Run them — expect FAIL** (`vitest run` on the two test files, same command shape as Task 1). Expected: `dimension-countries` import fails; the grid tests find no testids.

- [ ] **Step 3: Implementation**

```tsx
// src/app/account/sonar/audit/_lib/dimension-countries.tsx
import type { AuditRunResult } from '@haiwave/protocol';
import { FLAG_COMPONENTS } from './country-flags';
import {
  DIMENSION_LABEL,
  countryName,
  resolvedCountriesOf,
  rollupFor,
  type Dimension,
} from '@/app/account/sonar/_lib/origin-dimension';

const CHIP_DIMENSIONS: readonly Dimension[] = ['design', 'firmware'];

/** One country chip: the curated flag when an asset exists, else the ISO-2 code; the title is the sentence. */
function CountryChip({ country, title }: { country: string; title: string }) {
  const Flag = FLAG_COMPONENTS[country];
  return (
    <span className="inline-flex items-center rounded border border-slate/15 bg-white px-1 py-0.5" title={title} aria-label={title}>
      {Flag ? <Flag className="h-3 w-auto rounded-sm" /> : <span className="font-mono text-[10px] text-charcoal">{country}</span>}
    </span>
  );
}

/**
 * D-219 (2026-09-08): the SKU's design and firmware countries beside its id. A dimension with no
 * resolved country renders no group (undeclared is a state, not a chip — spec R3); no row at all
 * when neither has one, the D-207 "no node when all absent" convention.
 */
export function DimensionCountryChips({ result }: { result: AuditRunResult }) {
  const groups = CHIP_DIMENSIONS
    .map((d) => ({ d, countries: resolvedCountriesOf(rollupFor(result, d)) }))
    .filter((g) => g.countries.length > 0);
  if (groups.length === 0) return null;
  return (
    <span data-testid="dimension-countries" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
      {groups.map(({ d, countries }) => (
        <span key={d} className="inline-flex items-center gap-1">
          <span>{DIMENSION_LABEL[d]}</span>
          {countries.map((c) => (
            <CountryChip key={c} country={c} title={`${DIMENSION_LABEL[d]} origin: ${countryName(c)} (${c})`} />
          ))}
        </span>
      ))}
    </span>
  );
}
```

`tier-gap-grid.tsx`:
- Imports: add `countDomesticByDimension` to the `domestic` import; add `import { DimensionCountryChips } from '@/app/account/sonar/audit/_lib/dimension-countries';` and `import { DIMENSION_LABEL, rollupFor } from '@/app/account/sonar/_lib/origin-dimension';`.
- In `SkuEvidenceRow`, directly after the existing `{domestic && auditorCountry && (<DomesticFlagBadge … />)}`:
```tsx
            {/* D-219 (2026-09-08): one badge per dimension whose whole rollup is domestic — a positive claim, so undeclared earns none. */}
            {auditorCountry &&
              (['design', 'firmware'] as const).map((d) =>
                isFullyDomestic(rollupFor(row.result, d), auditorCountry) ? (
                  <span
                    key={d}
                    data-testid={`domestic-badge-${d}`}
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate"
                    title={`Every ${d} origin in this SKU's tree is domestic.`}
                  >
                    <DomesticFlagBadge country={auditorCountry} title={`Every ${d} origin in this SKU's tree is domestic.`} />
                    {DIMENSION_LABEL[d]}
                  </span>
                ) : null,
              )}
```
- Directly after the `{hasSubhead && (…)}` block inside the same `<span className="flex min-w-0 flex-1 flex-col gap-0.5">`: `<DimensionCountryChips result={row.result} />`.
- In `TierGapGrid`, beside the existing `useMemo`s: `const domesticCounts = useMemo(() => countDomesticByDimension(results, auditorCountry), [results, auditorCountry]);` and, as the last child of the status-bar `<div>` that holds the `StatCell`s and the "Follow-up priority" block (render it after that block, full width — a `<p>` with `className="basis-full text-xs text-slate"`), only when `auditorCountry && results.length > 0`:
```tsx
        {auditorCountry && results.length > 0 && (
          <p data-testid="domestic-by-dimension" className="basis-full text-xs text-slate" title="SKUs whose whole component tree resolved to your home country, per origin dimension">
            Fully domestic — Manufacturing {domesticCounts.manufacturing} of {domesticCounts.total} · Design {domesticCounts.design} of {domesticCounts.total} · Firmware {domesticCounts.firmware} of {domesticCounts.total}
          </p>
        )}
```
(If the status bar's container is not `flex-wrap`, add `flex-wrap` to it so `basis-full` drops the line below the cells.)
- `audit-column-packs.tsx`, the `domestic` column: `headerTitle: 'SKUs whose components fully resolved to your home country / total SKUs in the run. Manufacturing origin; open the run for design and firmware.'`.

- [ ] **Step 4: Run them — expect PASS**: the two new/changed test files plus the whole existing grid test file (all its earlier cases stay green — no manufacturing behaviour changed). Then `npx tsc --noEmit -p . ; echo "exit=$?"` (≥ 3.86.0 link).

- [ ] **Step 5: Commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-audit-display && git add src/app/account/sonar/audit/_lib/dimension-countries.tsx src/app/account/sonar/audit/_lib/__tests__/dimension-countries.test.tsx "src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx" "src/app/account/sonar/audit/[run_id]/_components/__tests__/tier-gap-grid.test.tsx" src/app/account/sonar/audit/_components/audit-column-packs.tsx
git commit -m "feat(audit): design + firmware chips, per-dimension domestic badges and run counts on the SKU grid (D-219)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Dashboard data — the auditor's country replaces `US`; three datasets per dimension; the cross-modality route

**Files:**
- Modify: `src/app/account/sonar/dashboard/_lib/partner-compliance.ts` (`buildPartnerCompliance` signature + the `'US'` literal), `src/app/account/sonar/dashboard/_lib/audit-weights.ts` (`buildPerPartnerAuditWeights` signature + the `'US'` literal), `src/app/account/sonar/dashboard/_lib/load-audit-charts.ts` (`AuditChartData`, `EMPTY`, the runs fetch, the merge), `src/app/api/account/sonar/dashboard/cross-modality/route.ts` (`loadAudit`)
- Test: Modify `src/app/account/sonar/dashboard/_lib/__tests__/partner-compliance.test.ts`, `…/audit-weights.test.ts`, `…/load-audit-charts.test.ts`, `src/app/api/account/sonar/dashboard/cross-modality/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Task 1's `Dimension`, `DIMENSIONS`, `rollupFor`; the enriched runs route `GET /api/account/sonar/audit/runs?limit=25` → `{ runs: AuditRun[]; auditor_country?: string }` (existing); `client.getCompanyProfile(id)` (existing, returns `{ locality?: { country?: string } }` among other fields).
- Produces: `buildPartnerCompliance(latestRun, results, auditorCountry: string, dimension: Dimension = 'manufacturing'): PartnerComplianceData`; `buildPerPartnerAuditWeights(latestRun, results, auditorCountry: string): Map<string, PartnerAuditWeight>`; `AuditChartData` gains `rollupByDimension: Record<Dimension, GeoRollupEntry[]>`, `partnerComplianceByDimension: Record<Dimension, PartnerComplianceData | null>`, `auditorCountry: string | undefined`, `latestRunId: string | null` — `rollup` and `partnerCompliance` KEEP their meaning (= the manufacturing entries).

- [ ] **Step 1: Failing tests**

`partner-compliance.test.ts` — every existing call `buildPartnerCompliance(run, results)` becomes `buildPartnerCompliance(run, results, 'US')` (the fixtures assume a US auditor — the hard-coded value made explicit; expectations unchanged). Add:
```ts
  // D-219 (2026-09-08): the compliant country is the auditor's, not US; the lens picks the rollup.
  it('a DE auditor counts US components as non-compliant', () => {
    const run = makeRun([VENDOR_A]);
    const results = [makeResult(VENDOR_A, 'A Co', makeRollup([['US', 4], ['DE', 2]]))];
    expect(buildPartnerCompliance(run, results, 'DE').total_non_compliant).toBe(4);
    expect(buildPartnerCompliance(run, results, 'US').total_non_compliant).toBe(2);
  });
  it("dimension: 'design' reads the design rollup and ignores the manufacturing one", () => {
    const run = makeRun([VENDOR_A]);
    const r = makeResult(VENDOR_A, 'A Co', makeRollup([['US', 4]]));
    const results = [{ ...r, design_geo_rollup: makeRollup([['CN', 3], ['US', 1]]) } as typeof r];
    expect(buildPartnerCompliance(run, results, 'US', 'design').total_non_compliant).toBe(3);
    expect(buildPartnerCompliance(run, results, 'US', 'firmware').total_non_compliant).toBe(0);   // no firmware rollup → nothing to count
    expect(buildPartnerCompliance(run, results, 'US').total_non_compliant).toBe(0);
  });
```
(`makeResult` is the file's existing result helper — use its actual name; if it takes a rollup positionally, keep that.)

`audit-weights.test.ts` — every `buildPerPartnerAuditWeights(run, results)` becomes `…(run, results, 'US')`. Add:
```ts
  // D-219 (2026-09-08): the compliant country is a parameter.
  it('a DE auditor weights US components as non-compliant', () => {
    const run = mkRun([VENDOR_A]);
    const results = [mkResult(VENDOR_A, 'A Co', [{ country: 'US', count: 3 }, { country: 'DE', count: 1 }])];
    expect(buildPerPartnerAuditWeights(run, results, 'DE').get(VENDOR_A)?.weight).toBe(0.75);
    expect(buildPerPartnerAuditWeights(run, results, 'US').get(VENDOR_A)?.weight).toBe(0.25);
  });
```

`load-audit-charts.test.ts` — every stubbed path `'/api/account/audit-runs?limit=25'` becomes `'/api/account/sonar/audit/runs?limit=25'` and its body `{ runs: [makeRun()] }` becomes `{ runs: [makeRun()], auditor_country: 'US' }` (the existing expectations hold: US auditor). Add:
```ts
  // D-219 (2026-09-08): three datasets, one per dimension; manufacturing stays in `rollup` / `partnerCompliance`.
  it('merges each dimension separately; the manufacturing dataset is the legacy `rollup`', async () => {
    const resultA = makeResult({
      result_id: '44444444-0000-0000-0000-000000000001',
      geo_rollup: [{ country_of_origin: 'TW', component_count: 2, depth_distribution: { '1': 2 } }],
      design_geo_rollup: [{ country_of_origin: 'CN', component_count: 2, depth_distribution: { '1': 2 } }],
    });
    const resultB = makeResult({
      result_id: '44444444-0000-0000-0000-000000000002',
      geo_rollup: [{ country_of_origin: 'TW', component_count: 1, depth_distribution: { '1': 1 } }],
      design_geo_rollup: [{ country_of_origin: 'CN', component_count: 1, depth_distribution: { '2': 1 } }],
      firmware_geo_rollup: [{ country_of_origin: '<unknown>', component_count: 1, depth_distribution: { '2': 1 } }],
    });
    stubFetch({
      '/api/account/sonar/audit/runs?limit=25': { ok: true, body: { runs: [makeRun()], auditor_country: 'US' } },
      [`/api/account/audit-runs/${RUN_ID}/results`]: { ok: true, body: { results: [resultA, resultB] } },
      [`/api/account/audit-runs/${RUN_ID}/class-rollup`]: { ok: true, body: { rollup: [] } },
    });
    const out = await loadAuditChartData();
    expect(out.rollupByDimension.manufacturing).toEqual(out.rollup);
    expect(out.rollupByDimension.design).toEqual([{ country_of_origin: 'CN', component_count: 3, depth_distribution: { '1': 2, '2': 1 } }]);
    expect(out.rollupByDimension.firmware).toEqual([{ country_of_origin: '<unknown>', component_count: 1, depth_distribution: { '2': 1 } }]);
    expect(out.partnerComplianceByDimension.manufacturing).toEqual(out.partnerCompliance);
    expect(out.partnerComplianceByDimension.design?.total_non_compliant).toBe(3);
    expect(out.auditorCountry).toBe('US');
    expect(out.latestRunId).toBe(RUN_ID);
  });
  it('no auditor country: partner compliance is null in every dimension; the rollups still load', async () => {
    stubFetch({
      '/api/account/sonar/audit/runs?limit=25': { ok: true, body: { runs: [makeRun()] } },
      [`/api/account/audit-runs/${RUN_ID}/results`]: { ok: true, body: { results: [makeResult({ geo_rollup: [{ country_of_origin: 'US', component_count: 1, depth_distribution: {} }] })] } },
      [`/api/account/audit-runs/${RUN_ID}/class-rollup`]: { ok: true, body: { rollup: [] } },
    });
    const out = await loadAuditChartData();
    expect(out.partnerCompliance).toBeNull();
    expect(out.partnerComplianceByDimension).toEqual({ manufacturing: null, design: null, firmware: null });
    expect(out.rollup).toHaveLength(1);
    expect(out.auditorCountry).toBeUndefined();
    expect(out.latestRunId).toBe(RUN_ID);
  });
```
(`load-audit-charts-origin.test.ts` stubs any URL with `{ runs: [] }` — unchanged and still green.)

`cross-modality/__tests__/route.test.ts` — every client mock object that has `listAuditRuns: vi.fn()…` gains `getCompanyProfile: vi.fn().mockResolvedValue({ locality: { country: 'us' } })` (the route uppercases; existing expectations assume a US auditor). Add two cases beside the existing audit-posture case:
```ts
  // D-219 (2026-09-08): the weights read the auditor's country; unknown → no audit weights, route still 200.
  it('weights US components as non-compliant for a DE auditor', async () => { /* same arrange as the existing audit-posture case, with getCompanyProfile → { locality: { country: 'DE' } }; assert the vendor's audit weight/non_compliant reflects the US components */ });
  it('no company profile: audit weights empty, response 200 with the same shape as a run with no results', async () => { /* getCompanyProfile: vi.fn().mockRejectedValue(new Error('404')); assert status 200 and the audit per-vendor map/array is empty */ });
```
Write those two bodies against the file's existing arrange/assert helpers (they build a `client` object and call `GET`); the comments name exactly what to assert.

- [ ] **Step 2: Run them — expect FAIL** (the four test files). Expected: TypeScript-agnostic runtime failures — `total_non_compliant` still computed against `'US'` (DE case: 2 not 4); `rollupByDimension` undefined; fetch stub `unexpected fetch: /api/account/audit-runs?limit=25`; route case counts US as compliant.

- [ ] **Step 3: Implementation**

`partner-compliance.ts`:
```ts
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';
import { rollupFor, type Dimension } from '@/app/account/sonar/_lib/origin-dimension';
…
export function buildPartnerCompliance(
  latestRun: AuditRun,
  results: AuditRunResult[],
  // D-219 (2026-09-08): the compliant country is the auditor's own (it was the literal 'US'), and the
  // lens chooses which origin dimension's rollup is counted.
  auditorCountry: string,
  dimension: Dimension = 'manufacturing',
): PartnerComplianceData {
```
and inside the loop replace `r.geo_rollup.reduce((sum, e) => (e.country_of_origin === 'US' ? sum : sum + e.component_count), 0)` with `rollupFor(r, dimension).reduce((sum, e) => (e.country_of_origin === auditorCountry ? sum : sum + e.component_count), 0)`.

`audit-weights.ts`: signature `buildPerPartnerAuditWeights(latestRun: AuditRun, results: AuditRunResult[], auditorCountry: string)` with the same one-sentence comment; `if (e.country_of_origin !== 'US') cur.nc += …` becomes `if (e.country_of_origin !== auditorCountry) cur.nc += …`. (Manufacturing only — the risk pill does not take the lens, spec R4.)

`load-audit-charts.ts`:
```ts
import type { AuditRun, AuditRunResult, ClassRollupEntry, GeoRollupEntry } from '@haiwave/protocol';
import { buildPartnerCompliance, type PartnerComplianceData } from './partner-compliance';
import { DIMENSIONS, rollupFor, type Dimension } from '@/app/account/sonar/_lib/origin-dimension';
import { fetchBffJson } from '@/lib/server-fetch';

export interface AuditChartData {
  rollup: GeoRollupEntry[];
  classRollup: ClassRollupEntry[];
  partnerCompliance: PartnerComplianceData | null;
  // D-219 (2026-09-08): the same two datasets per origin dimension for the dashboard lens; `rollup`
  // and `partnerCompliance` stay the manufacturing entries so untouched consumers keep their meaning.
  rollupByDimension: Record<Dimension, GeoRollupEntry[]>;
  partnerComplianceByDimension: Record<Dimension, PartnerComplianceData | null>;
  auditorCountry: string | undefined;
  latestRunId: string | null;
}

const EMPTY: AuditChartData = {
  rollup: [],
  classRollup: [],
  partnerCompliance: null,
  rollupByDimension: { manufacturing: [], design: [], firmware: [] },
  partnerComplianceByDimension: { manufacturing: null, design: null, firmware: null },
  auditorCountry: undefined,
  latestRunId: null,
};

/** Sum one dimension's rollups across the run's results by country, depth keys merged, most components first. */
function mergeRollups(results: AuditRunResult[], dimension: Dimension): GeoRollupEntry[] {
  const merged = new Map<string, GeoRollupEntry>();
  for (const r of results) {
    for (const e of rollupFor(r, dimension)) {
      const cur = merged.get(e.country_of_origin);
      if (!cur) {
        merged.set(e.country_of_origin, { ...e, depth_distribution: { ...e.depth_distribution } });
      } else {
        cur.component_count += e.component_count;
        for (const [d, c] of Object.entries(e.depth_distribution)) {
          cur.depth_distribution[d] = (cur.depth_distribution[d] ?? 0) + c;
        }
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.component_count - a.component_count);
}
```
In `loadAuditChartData`: the runs fetch becomes `fetchJson<{ runs: AuditRun[]; auditor_country?: string }>('/api/account/sonar/audit/runs?limit=25')` (the enriched route carries the auditor's country — D-219, the `US` rider); `const auditorCountry = runsRes.auditor_country;`. Replace the inline `merged` loop with:
```ts
  const results = resultsRes?.results ?? [];
  const rollupByDimension = { manufacturing: mergeRollups(results, 'manufacturing'), design: mergeRollups(results, 'design'), firmware: mergeRollups(results, 'firmware') };
  const compliance = (d: Dimension): PartnerComplianceData | null =>
    resultsRes && auditorCountry ? buildPartnerCompliance(latest, results, auditorCountry, d) : null;
  const partnerComplianceByDimension = { manufacturing: compliance('manufacturing'), design: compliance('design'), firmware: compliance('firmware') };

  return {
    rollup: rollupByDimension.manufacturing,
    classRollup: classRes?.rollup ?? [],
    partnerCompliance: partnerComplianceByDimension.manufacturing,
    rollupByDimension,
    partnerComplianceByDimension,
    auditorCountry,
    latestRunId: latest.run_id,
  };
```
(`DIMENSIONS` import is used only if you fold the three literals into a loop — either is fine; remove the import if unused.)

`cross-modality/route.ts`, `loadAudit`: add `getCompanyProfile: (id: string) => Promise<unknown>;` to the `client` parameter type and `participantId: string` as a second parameter (the handler passes `session.participant.id` — it already destructures `{ client }`; change to `{ client, session }`). After `latest` is found:
```ts
  // D-219 (2026-09-08): the compliant country is the auditor's own; unknown → no audit weights, the
  // same shape as a run with no results (the console's partner panel names the fix).
  let auditorCountry: string | undefined;
  try {
    const profile = await client.getCompanyProfile(participantId);
    const locality = (profile as { locality?: { country?: string } }).locality;
    if (locality?.country) auditorCountry = locality.country.toUpperCase();
  } catch {
    // No profile — leave undefined.
  }
  if (!auditorCountry) return { perVendor: new Map(), resultsByVendor: new Map() };
  const perVendor = buildPerPartnerAuditWeights(latest, results, auditorCountry);
```

- [ ] **Step 4: Run them — expect PASS**: the four test files, then the whole `src/app/account/sonar/dashboard` and `src/app/api/account/sonar/dashboard` trees (`vitest run src/app/account/sonar/dashboard src/app/api/account/sonar/dashboard`). `page.test.tsx` mocks `fetchBffJson`; if it builds an `AuditChartData` literal, add the four new fields to it (or `tsc` will name it). Then `npx tsc --noEmit -p . ; echo "exit=$?"`.

- [ ] **Step 5: Commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-audit-display && git add src/app/account/sonar/dashboard/_lib/partner-compliance.ts src/app/account/sonar/dashboard/_lib/audit-weights.ts src/app/account/sonar/dashboard/_lib/load-audit-charts.ts src/app/api/account/sonar/dashboard/cross-modality/route.ts src/app/account/sonar/dashboard/_lib/__tests__/partner-compliance.test.ts src/app/account/sonar/dashboard/_lib/__tests__/audit-weights.test.ts src/app/account/sonar/dashboard/_lib/__tests__/load-audit-charts.test.ts src/app/api/account/sonar/dashboard/cross-modality/__tests__/route.test.ts
git commit -m "feat(dashboard): auditor country replaces US in partner compliance; per-dimension chart datasets (D-219)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Dashboard lens — Manufacturing · Design · Firmware over the geo and partner charts

**Files:**
- Create: `src/app/account/sonar/dashboard/_components/dimension-lens.tsx`
- Modify: `src/app/account/sonar/dashboard/_charts/geo-chart.tsx` (`title` prop), `src/app/account/sonar/dashboard/_charts/partners-chart.tsx` (`footnote`, `emptyMessage` props), `src/app/account/sonar/dashboard/page.tsx` (the `<GeoChart>` / `<ClassChart>` grid and `<PartnersChart>` mount)
- Test: Create `src/app/account/sonar/dashboard/_components/__tests__/dimension-lens.test.tsx`

**Interfaces:**
- Consumes: `AuditChartData` (Task 3); `SectionTabs` (`src/components/sonar/section-tabs.tsx`, existing — `tabs[{id,label,content}]`, `ariaLabel`, `onChange`, `testId`); `DIMENSIONS`, `DIMENSION_LABEL`.
- Produces: `DimensionLens({ charts, classChart }: { charts: AuditChartData; classChart: ReactNode })`; `GeoChart({ data, title = 'Components by country' })`; `PartnersChart({ data, footnote = '* Non US Based Components', emptyMessage = 'No audit data yet. Run an audit to populate the dashboard.' })` — the defaults keep every other caller and test identical.

- [ ] **Step 1: Failing test**

```tsx
// src/app/account/sonar/dashboard/_components/__tests__/dimension-lens.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GeoRollupEntry } from '@haiwave/protocol';
import { DimensionLens } from '../dimension-lens';
import type { AuditChartData } from '../../_lib/load-audit-charts';
import type { PartnerComplianceData } from '../../_lib/partner-compliance';

// recharts measures a container the jsdom cannot size — render its ResponsiveContainer as a plain box (the page test's pattern).
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-responsive">{children}</div> };
});

const entry = (country_of_origin: string, component_count: number): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
const compliance = (total_non_compliant: number): PartnerComplianceData => ({ rows: [], total_vendors_in_scope: 1, total_non_compliant, median_per_vendor: total_non_compliant });
const charts: AuditChartData = {
  rollup: [entry('TW', 3)], classRollup: [], partnerCompliance: compliance(0),
  rollupByDimension: { manufacturing: [entry('TW', 3)], design: [entry('CN', 2)], firmware: [] },
  partnerComplianceByDimension: { manufacturing: compliance(0), design: compliance(2), firmware: compliance(0) },
  auditorCountry: 'US', latestRunId: 'run-1',
};

// D-219 (2026-09-08): one lens for the geo and partner charts; default Manufacturing (spec R4/R5).
describe('DimensionLens', () => {
  it('defaults to Manufacturing: today\'s title, the manufacturing dataset, the auditor footnote', () => {
    render(<DimensionLens charts={charts} classChart={<div data-testid="class-chart" />} />);
    expect(screen.getByRole('tab', { name: 'Manufacturing' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Components by country')).toBeInTheDocument();
    expect(screen.getByText('* Components outside US')).toBeInTheDocument();
    expect(screen.getByTestId('class-chart')).toBeInTheDocument();
  });
  it('switching to Design swaps the title and the datasets; Firmware with no data shows the empty geo copy', () => {
    render(<DimensionLens charts={charts} classChart={null} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }));
    expect(screen.getByText('Components by design country')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();                       // Total non-compliant under the design lens
    fireEvent.click(screen.getByRole('tab', { name: 'Firmware' }));
    expect(screen.getByText('Components by firmware country')).toBeInTheDocument();
    expect(screen.getByText('No audit data yet. Run an audit to populate the dashboard.')).toBeInTheDocument();
  });
  it('unknown auditor country with a run: the partner panel names the fix', () => {
    render(<DimensionLens charts={{ ...charts, auditorCountry: undefined, partnerCompliance: null, partnerComplianceByDimension: { manufacturing: null, design: null, firmware: null } }} classChart={null} />);
    expect(screen.getByText('Set your company country to see partner compliance.')).toBeInTheDocument();
  });
  it('no run at all keeps today\'s empty copy', () => {
    render(<DimensionLens charts={{ ...charts, latestRunId: null, auditorCountry: undefined, rollup: [], rollupByDimension: { manufacturing: [], design: [], firmware: [] }, partnerCompliance: null, partnerComplianceByDimension: { manufacturing: null, design: null, firmware: null } }} classChart={null} />);
    expect(screen.getAllByText('No audit data yet. Run an audit to populate the dashboard.')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Failed to resolve import "../dimension-lens"`).

- [ ] **Step 3: Implementation**

`geo-chart.tsx`: `export function GeoChart({ data, title = 'Components by country' }: { data: GeoRollupEntry[]; title?: string })` and render `{title}` in the `<h2>` (one-line D-219 comment: the lens names the dimension).

`partners-chart.tsx`: `export function PartnersChart({ data, footnote = '* Non US Based Components', emptyMessage = 'No audit data yet. Run an audit to populate the dashboard.' }: { data: PartnerComplianceData | null; footnote?: string; emptyMessage?: string })`; the null branch's `<p>` prints `{emptyMessage}`; the trailing `<p className="text-xs text-slate italic mt-3">` prints `{footnote}`.

```tsx
// src/app/account/sonar/dashboard/_components/dimension-lens.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { SectionTabs } from '@/components/sonar/section-tabs';
import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from '@/app/account/sonar/_lib/origin-dimension';
import { GeoChart } from '../_charts/geo-chart';
import { PartnersChart } from '../_charts/partners-chart';
import type { AuditChartData } from '../_lib/load-audit-charts';

const GEO_TITLE: Record<Dimension, string> = {
  manufacturing: 'Components by country',
  design: 'Components by design country',
  firmware: 'Components by firmware country',
};

function isDimension(id: string): id is Dimension {
  return (DIMENSIONS as readonly string[]).includes(id);
}

/**
 * D-219 (2026-09-08): one origin-dimension lens shared by the geo chart and the Coverage-by-Partner
 * chart (spec R4); client state only, default Manufacturing (R5). The tab control is SectionTabs with
 * empty panels — the charts below are the lens's subject and render once, so the class chart beside
 * the geo chart is not duplicated per panel. The risk pill does not take the lens (R4).
 */
export function DimensionLens({ charts, classChart }: { charts: AuditChartData; classChart: ReactNode }) {
  const [dimension, setDimension] = useState<Dimension>('manufacturing');
  const tabs = DIMENSIONS.map((d) => ({ id: d, label: DIMENSION_LABEL[d], content: null }));
  const hasRun = charts.latestRunId !== null;
  const footnote = charts.auditorCountry ? `* Components outside ${charts.auditorCountry}` : undefined;
  // A run with an unknown auditor country is a fixable state, named as such; no run at all keeps today's copy.
  const emptyMessage = hasRun && !charts.auditorCountry ? 'Set your company country to see partner compliance.' : undefined;

  return (
    <>
      <SectionTabs
        tabs={tabs}
        ariaLabel="Origin dimension"
        testId="dimension-lens"
        onChange={(id) => { if (isDimension(id)) setDimension(id); }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GeoChart data={charts.rollupByDimension[dimension]} title={GEO_TITLE[dimension]} />
        {classChart}
      </div>
      <PartnersChart data={charts.partnerComplianceByDimension[dimension]} footnote={footnote} emptyMessage={emptyMessage} />
    </>
  );
}
```
(`SectionTabs` panels are empty `<div role="tabpanel">`s here; the lens's subject is the charts beneath. If `SectionTabs`'s `content: ReactNode` type rejects `null`, pass `<></>`.)

`page.tsx`: replace the block
```tsx
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <GeoChart data={data.charts.rollup} />
                      <ClassChart data={data.charts.classRollup} />
                    </div>
                    <PartnersChart data={data.charts.partnerCompliance} />
```
with `<DimensionLens charts={data.charts} classChart={<ClassChart data={data.charts.classRollup} />} />` and fix the imports (`DimensionLens` in; `GeoChart` / `PartnersChart` out if now unused).

- [ ] **Step 4: Run it — expect PASS**; then `vitest run src/app/account/sonar/dashboard` (the page test still finds `Components by country` under the default lens); `npx tsc --noEmit -p . ; echo "exit=$?"`.

- [ ] **Step 5: Commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-audit-display && git add src/app/account/sonar/dashboard/_components/dimension-lens.tsx src/app/account/sonar/dashboard/_components/__tests__/dimension-lens.test.tsx src/app/account/sonar/dashboard/_charts/geo-chart.tsx src/app/account/sonar/dashboard/_charts/partners-chart.tsx src/app/account/sonar/dashboard/page.tsx
git commit -m "feat(dashboard): Manufacturing / Design / Firmware lens over the geo and partner charts (D-219)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Spec + plan into the tree; gate; owner walk notes; HOLD

**Files:**
- Create: `docs/superpowers/specs/2026-09-08-console-audit-display-design-firmware-origin-design.md`, `docs/superpowers/plans/2026-09-08-console-audit-display-haiweb.md` (copies from the primary — both are untracked there)
- Test: the gate

- [ ] **Step 1: Copy the docs and commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-audit-display && cp /Users/samfleming/dev/hw/haiWeb/docs/superpowers/specs/2026-09-08-console-audit-display-design-firmware-origin-design.md docs/superpowers/specs/ && cp /Users/samfleming/dev/hw/haiWeb/docs/superpowers/plans/2026-09-08-console-audit-display-haiweb.md docs/superpowers/plans/
git add docs/superpowers/specs/2026-09-08-console-audit-display-design-firmware-origin-design.md docs/superpowers/plans/2026-09-08-console-audit-display-haiweb.md
git commit -m "docs: console audit display spec + HaiWeb plan (D-219)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 2: Gate** (controller announces it to every live peer by name first; `pgrep -fl vitest` empty; load < 10; protocol link ≥ 3.86.0 — record the version the build ran against)

```bash
cd /Users/samfleming/dev/hw/haiWeb-audit-display && git fetch origin && git merge origin/master && git log --oneline origin/master..HEAD
node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'
npx tsc --noEmit -p . ; echo "exit=$?"
npm run build 2>&1 | tail -5 ; echo "exit=${pipestatus[1]}"
/Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 2>&1 | tee .superpowers/gate-haiweb.log | tail -6 ; echo "exit=${pipestatus[1]}"
grep -c "(retry" .superpowers/gate-haiweb.log     # 0
```
Expected: three exit 0; `(retry` = 0; counts = the control counts (taken on the untouched worktree before Task 1 Step 2 — the ledger holds them) plus this lane's new `it`s (Task 1: 8; Task 2: 8 + any tooltip assertion; Task 3: 7; Task 4: 4). Write the numbers into the ledger beside the controls.

- [ ] **Step 3: Owner walk notes + HOLD** — write `pr-body.md` in the ledger dir: title `HaiWeb v1.9x PR n — audit surfaces carry design + firmware origin (D-219)`; `## Summary` (one line per task); `## Test plan` (gate numbers, tsc + build exits, the protocol version the build ran against); `## Requires` ("haiCore D-218 (v1.93.0) deployed to Central — the grid and lens read `design_geo_rollup` / `firmware_geo_rollup` from the results route; the D-219 haiCore reports PR is independent of this one"); `## Owner walk` (spec §8, HaiWeb + owner-walk lines: on :3002 against a Central carrying D-218's seeded radio (CN design / CN firmware / TW manufacture) in a completed run — the SKU row shows Design CN and Firmware CN chips and no dimension badge; the summary line reads 0 of N for Design and Firmware; the dashboard Design lens shows a CN bar; the partners footnote names the auditor's country); `## Rider` ("the Coverage-by-Partner chart and the risk audit weights read the auditor's country instead of the literal `US` — a non-US auditor's figures change from wrong to right, or to the named empty state when the company country is unset"); the attribution line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Message the controller/agent1: tip sha · commit count · files ± · counts vs control · protocol version at build · `pr-body.md` path. **Do not push, PR, or merge.** On the owner's word only: `git -C /Users/samfleming/dev/hw/haiWeb-audit-display push -u origin console-audit-display` then `gh pr create --repo simmysam3/haiWeb --base master --head console-audit-display --title "…" --body-file …/pr-body.md`. If the link was repointed for the build, restore it after the haiCore merge and primary rebuild and re-run `tsc` + `npm run build` once.

---

## Self-review (run by the plan author 2026-09-08)

**Spec coverage.** §5.1 grid → Task 2 (badges per dimension with label + sentence title; chips row via `DimensionCountryChips`, no group when unresolved, no row when neither; summary line from `countDomesticByDimension`; manufacturing badge untouched). §5.1 `domestic.tsx` helper → Task 1. §5.2 loader (three datasets, enriched route, `auditor_country` threaded, legacy fields keep meaning) → Task 3; builders' `US` → parameter, `dimension` on compliance only, weights manufacturing-only (R4) → Task 3; chart titles / footnote / unknown-auditor copy → Task 4; `dimension-lens.tsx` on `SectionTabs` → Task 4 (empty panels, documented); `page.tsx` mount → Task 4. §5.3 tooltip sentence → Task 2. §5.4 no Pill categories → Task 2's `CountryChip`. §6 compatibility (`?? []` everywhere: `rollupFor`) → Task 1; order/dependency → header + Global Constraints (≥ 3.86.0 only — flagged as a spec refinement). R7's "empty weights ⇒ same as no results" → Task 3 (route returns the no-run shape) with a test. §8 HaiWeb tests → Tasks 1–4's cases; gate → Task 5; owner walk → Task 5 notes. **Not in this plan:** spec §3/§4 (haiCore reports — the haiCore plan); the run history column's numbers (R6: unchanged).

**Placeholder scan.** The two cross-modality route test bodies in Task 3 are described by their arrange/assert in comments because they reuse that file's own helpers, which the plan author read but whose names vary per case; everything they must assert is stated. `v1.9x PR n` is agent1's allocation, named as such. No TBD/TODO.

**Type consistency.** `Dimension`, `DIMENSIONS`, `DIMENSION_LABEL`, `rollupFor`, `resolvedCountriesOf`, `countryName` (Task 1) are the names used in Tasks 2–4. `countDomesticByDimension` returns `Record<Dimension, number> & { total }` — Task 2 reads `.manufacturing/.design/.firmware/.total`. `AuditChartData`'s four new fields (Task 3) are the ones `DimensionLens` reads (Task 4). `buildPartnerCompliance(run, results, auditorCountry, dimension?)` and `buildPerPartnerAuditWeights(run, results, auditorCountry)` are called with those arities in the loader, the route, and the tests.
