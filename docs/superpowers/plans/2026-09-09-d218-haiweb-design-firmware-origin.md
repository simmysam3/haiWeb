# Design + firmware origin in the console (D-218 HaiWeb half) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The console shows the two new vendor-declared origin dimensions: a "Design origin" and a "Firmware origin" card on the manifest drawer, design and firmware country chips beside the manufacturing origin on the watcher/audit tree, and the four new ladder fields on the provenance-key permission checklist.

**Architecture:** Three independent presentation changes over protocol 3.86.0, in three separate files, each with its own test cycle. No new module and no shared helper: the drawer card reuses the entry card's own field rendering, the tree chips reuse the tree's own `resolvedCountry()` sentinel rule, and the checklist gains four entries in its existing inline mirror array. **BFF-only, and in fact BFF-free:** `GET /api/account/provenance/manifests/[productId]` is `withHaiCore(({ client, params }) => client.getOriginManifest(params.productId))`, and `haiwave-api.ts:1433` returns `request<Record<string, unknown>>('GET', '/provenance/manifest/…')` — a raw pass-through with no mapper and no zod strip, so `design_origin` / `firmware_origin` reach the component the moment Central carries them. No route change, no haiCore change.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind v4, vitest + Testing Library (jsdom; `retry: 2` is configured in `vitest.config.ts` — a `(retry x` line in output is NOT green), `@haiwave/protocol` through the `node_modules/@haiwave/protocol` symlink.

**Spec:** `docs/superpowers/specs/2026-09-08-design-and-firmware-origin-design.md` (owner-approved 2026-09-08; the primary copy lives at `/Users/samfleming/dev/hw/haiCore/docs/superpowers/specs/…`). §6 is this plan's requirements; §2 fixes the semantics, §7 the compatibility rules, §8 the tests, §9 step 3 the delivery. Task 4 commits the spec beside this plan.

## Global Constraints

- **Worktree `/Users/samfleming/dev/hw/haiWeb-design-origin`, NEW branch `design-firmware-origin` from `origin/master` (base `af82dc64`)** — created in Task 1 Step 1. Every command starts with `cd /Users/samfleming/dev/hw/haiWeb-design-origin` or `git -C /Users/samfleming/dev/hw/haiWeb-design-origin`. **The primary `/Users/samfleming/dev/hw/haiWeb` serves :3001 and :3002 — never edit, check out, pull, build, install or run tests there.** Build only in the worktree. Never `git stash` (the stack is shared with other sessions); set work aside with a WIP commit instead.
- **No protocol repoint in this lane.** The primary haiCore dist is already 3.86.0 (D-218 merged to `main` at `a7eb2eaa`), and the symlink `node_modules/@haiwave/protocol -> ../../../haiCore/packages/protocol` is copied with `node_modules` and still resolves relative to the worktree's own `node_modules/@haiwave/`. Task 1 Step 1 proves it (version constant AND emitted `.d.ts` keys — a bumped constant over stale types would only surface at gate time). Never edit anything under any haiCore tree.
- **Slot: HaiWeb v1.90 PR 2** (landing order; agent1 `hw-48` re-states it at HOLD). PR title: `HaiWeb v1.90 PR 2 — design + firmware origin on the manifest drawer, watcher tree and key checklist (D-218, protocol 3.86.0)`. HaiWeb does **not** bump `package.json` (it sits at 0.1.0 and never moves) and **has no CHANGELOG.md on master** — measured, so the allocation's "CHANGELOG line under v1.90" clause is moot: **write no cycle label anywhere in the tree; the label lives only in the PR title.** No register row (the register is haiCore's; D-218's row is already written). No new decision number.
- **File-disjoint from the sibling §10 lane** (worktree `haiWeb-audit-display`, branch `console-audit-display`, HaiWeb v1.90 PR 3). That lane creates `src/app/account/sonar/_lib/origin-dimension.ts` (with a `countryName()` helper) and edits `src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx`, `src/app/account/sonar/audit/_lib/domestic.tsx`, `src/app/account/sonar/audit/_components/audit-column-packs.tsx` and the dashboard tree. **This lane must not touch any of those files and must not import `origin-dimension.ts`** — it does not exist on `master`. Where a country is displayed here, render the ISO code as the spec shows the field; do not invent a name helper.
- **Every vitest goes through the machine-wide mutex, from the worktree root:** `/Users/samfleming/dev/hw/vitest-lock.sh npx vitest run <files> --maxWorkers=1` for a focused run, `--maxWorkers=3` for the gate. **Before any run:** `pgrep -fl vitest` must be empty and load < ~10 (`uptime`). **After any abort:** kill your own ppid-1 tinypool orphans (`pgrep -fl tinypool`, check `ps -o ppid=` is 1, kill only yours) — an aborted run leaves ~4.5 GB workers behind. Read exit codes on the next line: `; echo "exit=$?"`.
- **`retry: 2` is configured.** A retried pass is NOT green: `grep -c "(retry" .superpowers/gate-haiweb.log` must print `0`.
- **CONTROL RUN.** One full vitest run on the untouched worktree, before Task 1's first edit, recorded in the ledger. The gate compares against those numbers. Measure, do not recall.
- **TDD per task, one red at a time.** Write the failing test, run it, confirm it fails for the right reason (not a typo or a missing import), implement the minimum, run it green, commit. The one exception in this plan is the comment-only amendment in Task 3 Step 4, marked as such.
- **Comments** dated `D-218 (2026-09-08)`, one sentence of why (not what). **No `any`.**
- **Copy:** sentences and labels, no raw codes — except ISO-3166 alpha-2 country codes, which the spec displays as codes, and the permission-field key names, which this checklist has always rendered verbatim in `font-mono` because they are the key author's own vocabulary. No vendor names in copy.
- **Ruling R1 (house):** an existing exact-shape assertion broken by the contract change is REPLACED with the new shape, never worked around. This lane hits R1 exactly once, in Task 3.
- **Commit after every green task.** Messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```
- **No push, no PR, no merge, no deploy.** Task 4 HOLDs for the owner's word, relayed through agent1 (`hw-48`).
- **Ledger:** `/Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/` (create in Task 1 Step 1). Holds the control counts, the gate log copy and `pr-body.md`. `.superpowers/` is gitignored in HaiWeb, so the in-tree gate log is safe there.
- Line numbers below were read on `origin/master` `af82dc64` (2026-09-08). **Locate every edit by SYMBOL NAME**, not by line.

---

### Task 1: Worktree, control run, and the manifest drawer's dimension cards

**Files:**
- Modify: `src/app/account/provenance/manifest-detail-drawer.tsx` (the type import on line 4; `ManifestBody`; a new `DimensionOriginCard` in the same file)
- Test: Create `src/app/account/provenance/__tests__/manifest-detail-drawer.test.tsx` (the drawer's FIRST test file — none exists on master)

**Split decision:** `DimensionOriginCard` goes in `manifest-detail-drawer.tsx`, **not** a sibling file. The file is 215 lines and already holds four components (`ManifestDetailDrawer`, `ManifestBody`, `OriginEntryCard`, `SubcomponentRow`); the new card is the entry card's near-twin and reads best beside it. A sibling file would split one screen's rendering across two files for no gain.

**Interfaces:**
- Consumes: `FacilityBlock`, `OriginManifest` from `@haiwave/protocol` (`FacilityBlock` = `{ facility_id: string; facility_name?: string; country_code: string; region_code?: string; facility_type: 'fabrication'|'assembly'|'warehouse'|'testing'|'headquarters'|'design_center'|'firmware'; verified: boolean; verification_method: 'self_declared'|'third_party_audit'|'government_certification'|'haiwave_validated'; last_verified_at?: string }`; `OriginManifest.design_origin` and `.firmware_origin` are `FacilityBlock | null | undefined`).
- Produces: nothing consumed by a later task. The two test ids `dimension-origin-design` / `dimension-origin-firmware` are the owner-walk and gate anchors.

- [ ] **Step 1: Create the worktree, prove the protocol link, create the ledger**

```bash
git -C /Users/samfleming/dev/hw/haiWeb fetch origin
git -C /Users/samfleming/dev/hw/haiWeb worktree add /Users/samfleming/dev/hw/haiWeb-design-origin -b design-firmware-origin origin/master
cd /Users/samfleming/dev/hw/haiWeb-design-origin && cp -c -R /Users/samfleming/dev/hw/haiWeb/node_modules ./node_modules && cp /Users/samfleming/dev/hw/haiWeb/.env* . 2>/dev/null; ls -la .env*
git log --oneline -1                                          # af82dc64
node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'   # 3.86.0
grep -c "design_origin" node_modules/@haiwave/protocol/dist/provenance/origin-manifest.d.ts   # >= 1
grep -c "design_country_of_origin\|design_entity" node_modules/@haiwave/protocol/dist/audit/disclosure.d.ts   # >= 1
grep -c "design_entity" node_modules/@haiwave/protocol/dist/provenance/permission-fields.d.ts   # >= 1
mkdir -p /Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb .superpowers
```
`cp -c` APFS-clones `node_modules`; the `@haiwave/protocol` entry is copied as a symlink and resolves inside the new worktree. **The four greps matter as much as the version print:** the constant can be bumped while the emitted `.d.ts` is stale, and that only surfaces at gate time under `tsc`. If any grep prints 0, STOP and report — do not repoint anything on your own.

- [ ] **Step 2: Control run (before any edit)**

```bash
pgrep -fl vitest ; uptime
cd /Users/samfleming/dev/hw/haiWeb-design-origin && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 > /Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/control.log 2>&1 ; echo "exit=$?" ; tail -6 /Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/control.log
grep -c "(retry" /Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/control.log
```
Write the two numbers (`N files`, `M tests`) and the retry count into `/Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/CONTROL.md`. The Task 4 gate must equal control + this lane's new `it`s (Task 1: 4; Task 2: 5; Task 3: 1 net new, one existing case rewritten under R1) = **control + 10 tests, control + 1 file**.

- [ ] **Step 3: Write the failing test**

Create `src/app/account/provenance/__tests__/manifest-detail-drawer.test.tsx`. The fetch-mock harness is `__tests__/manifests-tab.test.tsx`'s (that file's `json()` helper and `beforeEach` reset); the drawer fetches once, on mount, from `/api/account/provenance/manifests/<productId>`.

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { FacilityBlock, OriginManifest } from '@haiwave/protocol';
import { ManifestDetailDrawer } from '../manifest-detail-drawer';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const block = (over: Partial<FacilityBlock> = {}): FacilityBlock => ({
  facility_id: 'fac-design-1',
  facility_name: 'Coastal Design House',
  country_code: 'CN',
  region_code: 'CN-GD',
  facility_type: 'design_center',
  verified: true,
  verification_method: 'third_party_audit',
  last_verified_at: '2026-08-01T00:00:00.000Z',
  ...over,
});

// A manifest whose manufacturing entry is a TW fab — the spec's walk case is CN design and
// CN firmware over TW manufacture. `over` sets only the two dimension keys per case.
const manifest = (over: Partial<OriginManifest> = {}): OriginManifest =>
  ({
    origin_manifest_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    external_product_id: 'RADIO-1',
    product_name: 'Field radio',
    manifest_version: 3,
    domestic_context: 'US',
    origin_entries: [
      {
        entry_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        entry_type: 'primary_manufacture',
        facility: block({
          facility_id: 'plant-1',
          facility_name: 'Hsinchu Fab',
          country_code: 'TW',
          region_code: undefined,
          facility_type: 'fabrication',
        }),
        provenance_depth: 'facility',
        subcomponent_origins: [],
      },
    ],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-02T00:00:00.000Z',
    ...over,
  }) as OriginManifest;

async function openDrawer(body: OriginManifest) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response);
  render(<ManifestDetailDrawer productId="RADIO-1" productName="Field radio" onClose={() => {}} />);
  // The SKU dd is the load anchor; the product name appears twice (drawer title + dd).
  await waitFor(() => expect(screen.getByText('RADIO-1')).toBeInTheDocument());
}

// D-218 (2026-09-08): design and firmware origin are separate vendor-declared dimensions; each
// declared block gets a card, an undeclared one gets nothing at all (no placeholder, spec §6).
describe('<ManifestDetailDrawer> dimension origin cards', () => {
  it('renders a card per declared dimension, above the entries, with entity, country, site, verification and the verified badge', async () => {
    await openDrawer(
      manifest({
        design_origin: block(),
        firmware_origin: block({
          facility_id: 'fw-signer-7',
          facility_name: undefined,
          region_code: undefined,
          facility_type: 'firmware',
          verified: false,
          verification_method: 'self_declared',
          last_verified_at: undefined,
        }),
      }),
    );

    const design = screen.getByTestId('dimension-origin-design');
    expect(within(design).getByText('Design origin')).toBeInTheDocument();
    expect(within(design).getByText('Coastal Design House')).toBeInTheDocument();
    expect(within(design).getByText('(design center)')).toBeInTheDocument();
    expect(within(design).getByText('CN')).toBeInTheDocument();
    expect(within(design).getByText('CN-GD')).toBeInTheDocument();
    expect(within(design).getByText('third party audit')).toBeInTheDocument();
    expect(within(design).getByText(/2026/)).toBeInTheDocument();   // last_verified_at; locale formats the rest
    expect(within(design).getByText('Verified')).toBeInTheDocument();

    // Entity falls back to facility_id when the vendor declared no name; no Site row without a region.
    const firmware = screen.getByTestId('dimension-origin-firmware');
    expect(within(firmware).getByText('Firmware origin')).toBeInTheDocument();
    expect(within(firmware).getByText('fw-signer-7')).toBeInTheDocument();
    expect(within(firmware).queryByText('Site')).toBeNull();
    expect(within(firmware).getByText('Unverified')).toBeInTheDocument();

    // Spec §6: "two cards above the entries".
    const entriesHeading = screen.getByText('Origin entries (1)');
    expect(design.compareDocumentPosition(entriesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders only the declared dimension when the other is null', async () => {
    await openDrawer(manifest({ design_origin: block(), firmware_origin: null }));
    expect(screen.getByTestId('dimension-origin-design')).toBeInTheDocument();
    expect(screen.queryByTestId('dimension-origin-firmware')).toBeNull();
  });

  it('renders no card when the vendor declared neither dimension', async () => {
    await openDrawer(manifest({ design_origin: null, firmware_origin: null }));
    expect(screen.queryByTestId('dimension-origin-design')).toBeNull();
    expect(screen.queryByTestId('dimension-origin-firmware')).toBeNull();
    expect(screen.getByText('Origin entries (1)')).toBeInTheDocument();
  });

  it('renders no card for an old-shape manifest that carries neither key (a 3.85.0 Central)', async () => {
    await openDrawer(manifest());
    expect(screen.queryByTestId('dimension-origin-design')).toBeNull();
    expect(screen.queryByTestId('dimension-origin-firmware')).toBeNull();
  });
});
```

- [ ] **Step 4: Run it — expect FAIL**

```bash
pgrep -fl vitest ; uptime
cd /Users/samfleming/dev/hw/haiWeb-design-origin && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/app/account/provenance/__tests__/manifest-detail-drawer.test.tsx --maxWorkers=1 ; echo "exit=$?"
```
Expected: FAIL — `Unable to find an element by: [data-testid="dimension-origin-design"]` in the first two cases. The last two cases (no card) PASS already; that is correct and expected, they are the regression guards. **If the failure is anything else** (an import error, `global.fetch is not a function`, a `waitFor` timeout on `RADIO-1`), fix the test before writing implementation.

- [ ] **Step 5: Implement**

In `src/app/account/provenance/manifest-detail-drawer.tsx`:

Extend the type import (line 4):
```tsx
import type { OriginManifest, OriginEntry, SubcomponentReference, FacilityBlock } from '@haiwave/protocol';
```

Insert the cards inside `ManifestBody`, between the summary `<section>` (the `<dl>` ending `</section>`) and the `Origin entries` `<section>`:
```tsx
      {/* D-218 (2026-09-08): the two declared dimensions read above the manufacturing entries
          because they qualify the product as a whole, not one step of its route. The guard keeps
          the parent's space-y-6 from opening a gap for an empty section when neither is declared. */}
      {(manifest.design_origin || manifest.firmware_origin) && (
        <section className="space-y-3">
          <DimensionOriginCard label="Design origin" block={manifest.design_origin} />
          <DimensionOriginCard label="Firmware origin" block={manifest.firmware_origin} />
        </section>
      )}
```

Add the component below `ManifestBody` and above `OriginEntryCard`:
```tsx
const DIMENSION_TEST_ID: Record<'Design origin' | 'Firmware origin', string> = {
  'Design origin': 'dimension-origin-design',
  'Firmware origin': 'dimension-origin-firmware',
};

/**
 * D-218 (2026-09-08): a declared dimension is one FacilityBlock, so this shows the entry card's
 * facility fields and nothing else — depth, batch, manufacturing date and subcomponents are
 * properties of a manufacturing step that a design or firmware block does not carry. "Entity" and
 * "Site" are the spec's own names for the block's facility_name and region_code (§2), and the
 * names of the permission-ladder fields that gate them.
 */
function DimensionOriginCard({
  label,
  block,
}: {
  label: 'Design origin' | 'Firmware origin';
  block: FacilityBlock | null | undefined;
}) {
  // Undeclared (null) or absent (an older Central): no card and no placeholder.
  if (!block) return null;

  return (
    <div
      data-testid={DIMENSION_TEST_ID[label]}
      className="rounded-md border border-slate/15 bg-light-gray/40 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-navy">{label}</p>
          <p className="mt-0.5 text-xs text-slate">{block.country_code}</p>
        </div>
        <StatusBadge status={block.verified ? 'verified' : 'unverified'} />
      </div>

      <dl className="mt-3 grid grid-cols-[max-content,1fr] items-baseline gap-x-4 gap-y-1 text-xs">
        <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Entity</dt>
        <dd className="text-charcoal">
          {block.facility_name ?? block.facility_id}
          <span className="ml-1 text-slate">({block.facility_type.replace(/_/g, ' ')})</span>
        </dd>
        {block.region_code && (
          <>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Site</dt>
            <dd className="text-charcoal">{block.region_code}</dd>
          </>
        )}
        <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Verification</dt>
        <dd className="text-charcoal capitalize">
          {block.verification_method.replace(/_/g, ' ')}
          {block.last_verified_at && (
            <span className="ml-1 text-slate">
              ({new Date(block.last_verified_at).toLocaleDateString()})
            </span>
          )}
        </dd>
      </dl>
    </div>
  );
}
```
`facility_type` is rendered (the spec removes only depth, batch, date and subcomponents) but humanised with the same `replace(/_/g, ' ')` the entry card already applies to `entry_type`, so the card reads `(design center)` rather than a raw enum member.

- [ ] **Step 6: Run it — expect PASS**

```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/app/account/provenance --maxWorkers=1 ; echo "exit=$?"
npx tsc --noEmit -p . ; echo "exit=$?"
```
Expected: 4 new tests pass; the existing `manifests-tab` and `manifests-sku-row` suites still pass; `tsc` exit 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin
git add src/app/account/provenance/manifest-detail-drawer.tsx src/app/account/provenance/__tests__/manifest-detail-drawer.test.tsx
git commit -m "feat(provenance): design and firmware origin cards on the manifest drawer (D-218)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Design and firmware country chips on the tree view

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/tree-view.tsx` (`TreeView` — the two derived constants beside `originLabel`, and the `Origin` `DetailRow`; a new `OriginDimensionChip` at the bottom beside `DetailRow` and `Pill`)
- Test: Modify `src/app/account/sonar/watchers/[id]/__tests__/tree-view.test.tsx` (append one new `describe`; the four existing describes are untouched)

**Interfaces:**
- Consumes: `ObservationNode` from `@haiwave/protocol`; its audit payload's `origin` is an `OriginDisclosure`, which at 3.86.0 carries `design_country_of_origin` and `firmware_country_of_origin` as `string | null | undefined`.
- Produces: test ids `origin-chip-design` / `origin-chip-firmware`; titles `Design origin: <CODE>` / `Firmware origin: <CODE>`.

**Sentinel decision:** reuse the file's existing `resolvedCountry(country: string | null | undefined): string | null` (tree-view.tsx:56) unchanged — it already returns `null` for `null`, `undefined`, `''`, `'XX'` and `'<unknown>'`, which is exactly the rule the dimension countries need. **No `resolvedDimensionCountry` sibling is added**; a second function with identical semantics would be the bug the next sentinel change causes. Do NOT touch `src/app/account/sonar/audit/_lib/domestic.tsx` — it belongs to the sibling lane.

- [ ] **Step 1: Write the failing test**

Append this describe to the END of `src/app/account/sonar/watchers/[id]/__tests__/tree-view.test.tsx`. It reuses that file's own `node()` fixture (line 7), which casts through `as ObservationNode`, so extra origin keys need no type surgery.

```tsx
describe('TreeView design + firmware origin chips', () => {
  // D-218 (2026-09-08): the two declared dimension countries ride beside the manufacturing
  // origin. Unresolved is unresolved: the same 'XX' / '<unknown>' rule the sliver uses.
  const withDimensions = (over: {
    design?: string | null;
    firmware?: string | null;
    country?: string;
    state?: string | null;
  }): ObservationNode =>
    node({
      payload: {
        kind: 'audit', product_id: null, disclosure_data: null, class_ids: [],
        origin: {
          country_of_origin: over.country ?? 'US',
          state_province: over.state === undefined ? 'WA' : over.state,
          city: null, plant_address: null, plant_identifier: null, vendor_name: null,
          design_country_of_origin: over.design ?? null,
          firmware_country_of_origin: over.firmware ?? null,
        },
        operational_status: { lead_time_meets: null, capacity: null, delivery_state: null },
      } as ObservationNode['payload'],
    });

  it('renders both chips, each titled with its dimension and country', () => {
    render(<TreeView node={withDimensions({ design: 'CN', firmware: 'CN' })} />);
    expect(screen.getByTestId('origin-chip-design')).toHaveAttribute('title', 'Design origin: CN');
    expect(screen.getByTestId('origin-chip-firmware')).toHaveAttribute('title', 'Firmware origin: CN');
    expect(screen.getByTestId('origin-chip-design')).toHaveTextContent('Design CN');
  });

  it('renders only the dimension the vendor declared', () => {
    render(<TreeView node={withDimensions({ design: 'CN' })} />);
    expect(screen.getByTestId('origin-chip-design')).toBeInTheDocument();
    expect(screen.queryByTestId('origin-chip-firmware')).toBeNull();
  });

  it('renders no chip when both are null (undeclared, or an older Central)', () => {
    render(<TreeView node={withDimensions({})} />);
    expect(screen.queryByTestId('origin-chip-design')).toBeNull();
    expect(screen.queryByTestId('origin-chip-firmware')).toBeNull();
  });

  it("renders no chip for the 'XX' or '<unknown>' sentinels", () => {
    render(<TreeView node={withDimensions({ design: 'XX', firmware: '<unknown>' })} />);
    expect(screen.queryByTestId('origin-chip-design')).toBeNull();
    expect(screen.queryByTestId('origin-chip-firmware')).toBeNull();
  });

  it('shows a chip even when the manufacturing origin resolves to nothing', () => {
    // The Origin row previously rendered only with a manufacturing label. A node whose plant is
    // the XX sentinel can still carry a declared design country, and hiding it would lose the
    // one piece of provenance that node has.
    render(<TreeView node={withDimensions({ design: 'CN', country: 'XX', state: null })} />);
    expect(screen.getByTestId('origin-chip-design')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
pgrep -fl vitest ; uptime
cd /Users/samfleming/dev/hw/haiWeb-design-origin && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run "src/app/account/sonar/watchers/[id]/__tests__/tree-view.test.tsx" --maxWorkers=1 ; echo "exit=$?"
```
Expected: FAIL — `Unable to find an element by: [data-testid="origin-chip-design"]` in cases 1, 2 and 5. Cases 3 and 4 pass already (regression guards). The four pre-existing describes (25 `it`s) must stay green in this same run; if any of them turns red, that is a real regression, not an R1 case.

- [ ] **Step 3: Implement**

In `src/app/account/sonar/watchers/[id]/tree-view.tsx`, inside `TreeView`, beside `const originLabel = formatOrigin(audit);`:
```tsx
  // D-218 (2026-09-08): design and firmware country are floor fields like the manufacturing
  // country, so they use the same sentinel rule — an 'XX' or '<unknown>' dimension is no dimension.
  const designCountry = resolvedCountry(audit?.origin.design_country_of_origin);
  const firmwareCountry = resolvedCountry(audit?.origin.firmware_country_of_origin);
```

Replace the `Origin` detail row (the `{originLabel && (<DetailRow label="Origin">…</DetailRow>)}` block) with:
```tsx
          {(originLabel || designCountry || firmwareCountry) && (
            <DetailRow label="Origin">
              {originLabel && <span className="text-charcoal">{originLabel}</span>}
              {designCountry && <OriginDimensionChip dimension="Design" country={designCountry} />}
              {firmwareCountry && <OriginDimensionChip dimension="Firmware" country={firmwareCountry} />}
            </DetailRow>
          )}
```

Add the chip at the bottom of the file, after `Pill`:
```tsx
const DIMENSION_CHIP_TEST_ID: Record<'Design' | 'Firmware', string> = {
  Design: 'origin-chip-design',
  Firmware: 'origin-chip-firmware',
};

// D-218 (2026-09-08): the chip carries its own dimension word so a bare ISO code beside the
// manufacturing origin can never be read as a second manufacturing country.
function OriginDimensionChip({
  dimension,
  country,
}: {
  dimension: 'Design' | 'Firmware';
  country: string;
}) {
  return (
    <span
      data-testid={DIMENSION_CHIP_TEST_ID[dimension]}
      title={`${dimension} origin: ${country}`}
      className="ml-1.5 rounded bg-teal/10 px-1.5 py-0.5 text-[10px] text-teal-dark"
    >
      {dimension} {country}
    </span>
  );
}
```

- [ ] **Step 4: Run it — expect PASS**

```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run "src/app/account/sonar/watchers/[id]" "src/app/account/sonar/audit/[run_id]" --maxWorkers=1 ; echo "exit=$?"
npx tsc --noEmit -p . ; echo "exit=$?"
```
Expected: 30 `it`s green in tree-view (25 existing + 5 new), and `tier-gap-grid.test.tsx` green too — that grid mounts the real `TreeView` (tier-gap-grid.tsx:202), so it is the blast-radius check for the widened Origin row. `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin
git add "src/app/account/sonar/watchers/[id]/tree-view.tsx" "src/app/account/sonar/watchers/[id]/__tests__/tree-view.test.tsx"
git commit -m "feat(sonar): design and firmware country chips on the origin tree (D-218)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The four dimension fields on the permission-field checklist

**Files:**
- Modify: `src/app/account/provenance-keys/_shared/permission-field-checklist.tsx` (the sync comment, `CANONICAL_PERMISSION_FIELDS`, and the stale `PERMISSION_FIELD_CATEGORIES` note)
- Test: Modify `src/app/account/provenance-keys/_shared/__tests__/permission-field-checklist.test.tsx` (rewrite the first `it` under R1; add one new `it`)

**Interfaces:**
- Consumes: `PermissionField` from `@haiwave/protocol`, whose enum at 3.86.0 is `CANONICAL_PERMISSION_FIELDS` = `['state_province','city','plant_address','plant_identifier','vendor_name','design_entity','design_site','firmware_entity','firmware_site']` (`packages/protocol/src/provenance/permission-fields.ts:10-21` on haiCore `main` — read it and mirror it exactly, order included).
- Produces: nine checkboxes with ids `field-<name>`; the three mounts (`generate-key-modal.tsx`, `edit-permissions-modal.tsx`, `sharing-policy-panel.tsx`) get the four extra fields with no change of their own.

**Label decision:** there is **no display-label map to extend.** The component renders the raw field key inside `<span className="font-mono">{field}</span>` (line 51) — deliberately, because a provenance key's author is choosing protocol field names. The four new fields therefore need no label work, and adding one for them alone would make the list inconsistent. Do not add a label map.

**Blast radius (measured):** `toHaveLength(5)` appears exactly once in the repo, in this file's own test. Three other test files carry prose comments naming the five Step-1 fields but assert nothing about the count; those comments remain historically accurate about the v3.1.0 reduction, so leave them alone.

- [ ] **Step 1: Write the failing test — R1 on the existing case, plus one new case**

In `src/app/account/provenance-keys/_shared/__tests__/permission-field-checklist.test.tsx`, REPLACE the first `it` (`'renders all 5 canonical Step-1 fields'`) with the new shape. R1: the assertion is not worked around, patched or skipped — it is rewritten to the contract that now holds.

```tsx
  it('renders all 9 canonical fields — the five Step-1 fields and the four D-218 dimension fields', () => {
    render(<PermissionFieldChecklist value={[]} onChange={() => {}} />);
    expect(screen.getByLabelText(/state_province/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plant_address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plant_identifier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vendor_name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/design_entity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/design_site/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/firmware_entity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/firmware_site/i)).toBeInTheDocument();
    // Count all checkboxes
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(9);
  });
```

And APPEND this `it` at the end of the describe:
```tsx
  // D-218 (2026-09-08): this array is an inline mirror of the protocol enum, so its ORDER is part
  // of the contract — a key author reading the ladder top-to-bottom must see the protocol's ladder.
  it('lists the four D-218 dimension fields after the five Step-1 fields, in the protocol order', () => {
    render(<PermissionFieldChecklist value={[]} onChange={() => {}} />);
    const ids = screen.getAllByRole('checkbox').map((box) => box.id);
    expect(ids).toEqual([
      'field-state_province',
      'field-city',
      'field-plant_address',
      'field-plant_identifier',
      'field-vendor_name',
      'field-design_entity',
      'field-design_site',
      'field-firmware_entity',
      'field-firmware_site',
    ]);
  });
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
pgrep -fl vitest ; uptime
cd /Users/samfleming/dev/hw/haiWeb-design-origin && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/app/account/provenance-keys/_shared/__tests__/permission-field-checklist.test.tsx --maxWorkers=1 ; echo "exit=$?"
```
Expected: FAIL — `Unable to find a label with the text of: /design_entity/i` in the first case, and `expected [ 'field-state_province', … ] to deeply equal [ … ]` with the four names missing in the new case. The other four `it`s stay green.

- [ ] **Step 3: Implement**

In `src/app/account/provenance-keys/_shared/permission-field-checklist.tsx`, replace lines 5-15 with:
```tsx
// Turbopack + file: symlink: inline mirror of @haiwave/protocol (sync-comment required).
// Source of truth: packages/protocol/src/provenance/permission-fields.ts (v3.1.0 — Step 1;
// v3.86.0 — D-218 adds the four dimension fields).
const CANONICAL_PERMISSION_FIELDS = [
  'state_province',
  'city',
  'plant_address',
  'plant_identifier',
  'vendor_name',
  // D-218 (2026-09-08): entity (facility_name) and site (region_code) per dimension. The three
  // countries are NOT here — they are the universal floor and are returned regardless of key state.
  'design_entity',
  'design_site',
  'firmware_entity',
  'firmware_site',
] as const;

// PERMISSION_FIELD_CATEGORIES removed — redundant at 5 fields, and still redundant at 9: D-218
// added a dimension pair, not a new category of disclosure.
```

- [ ] **Step 4 (comment-only, no test — the plan's one TDD exception): confirm the amended note**

The `PERMISSION_FIELD_CATEGORIES` line in Step 3 is a comment whose stated reason ("redundant at 5 fields") stopped being literally true the moment the list reached nine. It carries no behaviour and no test can pin it; it is amended in the same edit, and this step exists only so the executor does not stall trying to write a red for it. Re-read the finished file top to bottom and confirm the comment now describes the list it sits above.

- [ ] **Step 5: Run it — expect PASS**

```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/app/account/provenance-keys src/app/account/manifests --maxWorkers=1 ; echo "exit=$?"
npx tsc --noEmit -p . ; echo "exit=$?"
```
Expected: 6 `it`s green in the checklist suite (4 untouched, 1 rewritten, 1 new), and the three mounts' own suites green — `generate-key-modal`, `edit-permissions-modal` and `sharing-policy-panel` are the only files that render this checklist (measured), and they now render nine rows. The `installer-*` suites in that directory do not mount it; they mention `plant_identifier` only as fixture data, so nothing there should change. `tsc` exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin
git add src/app/account/provenance-keys/_shared/permission-field-checklist.tsx src/app/account/provenance-keys/_shared/__tests__/permission-field-checklist.test.tsx
git commit -m "feat(provenance-keys): the four D-218 dimension fields on the permission ladder (D-218)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Spec + plan into the tree, gate, PR body, HOLD

**Files:**
- Create: `docs/superpowers/specs/2026-09-08-design-and-firmware-origin-design.md` (copied from the haiCore primary), `docs/superpowers/plans/2026-09-09-d218-haiweb-design-firmware-origin.md` (copied from the HaiWeb primary, where it is untracked)
- Create (outside the tree): `/Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/pr-body.md`
- Test: the gate

- [ ] **Step 1: Copy the spec and this plan into the worktree and commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin
cp /Users/samfleming/dev/hw/haiCore/docs/superpowers/specs/2026-09-08-design-and-firmware-origin-design.md docs/superpowers/specs/
cp /Users/samfleming/dev/hw/haiWeb/docs/superpowers/plans/2026-09-09-d218-haiweb-design-firmware-origin.md docs/superpowers/plans/
git add docs/superpowers/specs/2026-09-08-design-and-firmware-origin-design.md docs/superpowers/plans/2026-09-09-d218-haiweb-design-firmware-origin.md
git commit -m "docs: design + firmware origin spec and HaiWeb plan (D-218)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
The spec is copied from haiCore because that is where it was authored and merged; this is the same document, not a fork. Do not edit either file in the worktree.

- [ ] **Step 2: Gate — FOREGROUND, on a quiet machine**

Announce the gate to the live peers first (the mutex serialises, but a queued gate blocks theirs). Then:
```bash
cd /Users/samfleming/dev/hw/haiWeb-design-origin
git fetch origin && git merge origin/master && git log --oneline origin/master..HEAD
pgrep -fl vitest ; uptime
node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'
npx tsc --noEmit -p . ; echo "exit=$?"
npm run build > .superpowers/gate-build.log 2>&1 ; echo "exit=$?" ; tail -5 .superpowers/gate-build.log
/Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 > .superpowers/gate-haiweb.log 2>&1 ; echo "exit=$?" ; tail -6 .superpowers/gate-haiweb.log
grep -c "(retry" .superpowers/gate-haiweb.log
cp .superpowers/gate-haiweb.log /Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/
```
Expected: four commits over `origin/master`; `tsc` exit 0; build exit 0; vitest exit 0; **`(retry` count = 0** (a retried pass is not green — if it is non-zero, find the flake and re-run, do not report green); test count = control + 10, file count = control + 1. Record all of it in the ledger beside `CONTROL.md`. If the merge from `origin/master` brings in the sibling lane's PR, re-read the three files this lane owns before trusting the numbers.

- [ ] **Step 3: Write the PR body**

Write `/Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/pr-body.md`. Use a file, never a multi-line `--body` argument — an unbalanced quote in a shell heredoc has silently eaten a PR body in this project before.

```markdown
## Summary

Protocol 3.86.0 (D-218) added two vendor-declared origin dimensions beside manufacturing origin. This is the console half: three surfaces, no new module, no BFF change.

- **Manifest drawer** — a "Design origin" and a "Firmware origin" card above the origin entries, each showing entity, country, site, verification and the verified badge. A dimension the vendor did not declare renders no card and no placeholder.
- **Origin tree** — design and firmware country chips beside the manufacturing origin on every node, titled with their dimension. The tree's existing sentinel rule applies: an `XX` or `<unknown>` dimension is treated as undeclared.
- **Permission-field checklist** — the inline protocol mirror gains `design_entity`, `design_site`, `firmware_entity`, `firmware_site` in the protocol's order, so a key author can grant the entity and site of either dimension. The three countries are not on the list: they are universal-floor fields.

## Requires

haiCore D-218 (v1.93.0, protocol 3.86.0) deployed to Central. **No BFF change was needed** — `/api/account/provenance/manifests/[productId]` is a pass-through to `client.getOriginManifest`, which returns the raw JSON body, so the two blocks arrive as soon as Central sends them. Against an older Central every surface here renders exactly as it does today.

## Test plan

- Gate on <tip sha>: `tsc --noEmit` exit 0, `npm run build` exit 0, full vitest exit 0, `(retry` count 0.
- <files>/<tests> vs the control run on the untouched worktree (<control files>/<control tests>): +1 file, +10 tests.
- Protocol version the build ran against: 3.86.0.

## Owner walk

Spec §8 "Owner walk". This depends on Lane A's seed fixture (the radio product with a CN design house, a CN firmware signer and a TW fab) being published to the lane Central, and on the rig running that agent — both are the owner's steps, not this PR's.

1. On :3002, open Provenance → the seeded radio → the manifest drawer. Above the origin entries: a **Design origin** card reading CN and a **Firmware origin** card reading CN, over a TW manufacturing entry below.
2. A product with neither dimension declared shows no card at all, and the drawer reads as it does today.
3. Open an audit run or watcher tree containing that radio. The node's Origin row carries a **Design CN** and a **Firmware CN** chip beside the manufacturing origin.
4. Provenance keys → create or edit a key. The permission list shows nine fields, the four dimension fields last.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
Fill every `<…>` from the gate output before sending. Leaving one unfilled is a failed step.

- [ ] **Step 4: HOLD — message agent1 (`hw-48`) and stop**

Send: branch and tip sha · commit count · files changed with ± · gate counts vs the control · `(retry` count · the protocol version the build ran against · the `pr-body.md` path · the proposed PR title `HaiWeb v1.90 PR 2 — design + firmware origin on the manifest drawer, watcher tree and key checklist (D-218, protocol 3.86.0)` and a request that agent1 re-state the slot number in landing order. State plainly that the drawer, chips and checklist are **test-proven only** and that the owner walk above is the live proof, still owed.

**Do not push, do not open a PR, do not merge, do not deploy.** On the owner's word only:
```bash
git -C /Users/samfleming/dev/hw/haiWeb-design-origin push -u origin design-firmware-origin
gh pr create --repo simmysam3/haiWeb --base master --head design-firmware-origin \
  --title "HaiWeb v1.90 PR 2 — design + firmware origin on the manifest drawer, watcher tree and key checklist (D-218, protocol 3.86.0)" \
  --body-file /Users/samfleming/dev/hw/sdd-ledger-2026-09-09-d218-haiweb/pr-body.md
```

---

## Self-review (run by the plan author, 2026-09-09)

**1. Spec coverage.** §6 bullet 1 (drawer cards: entity, country, region, verification, verified badge; entry-card fields minus depth/batch/date/subcomponents; no card when null; no placeholder) → Task 1, with the "above the entries" clause pinned by a `compareDocumentPosition` assertion. §6 bullet 2 (tree chips when present, nothing when null) → Task 2, five cases including the two sentinels and the unresolved-manufacturing case. §6 bullet 3 (inline mirror gains the four fields; sync comment cites the new version) → Task 3. §6 bullet 4 (types from `@haiwave/protocol`; the D-207 repoint pattern) → Global Constraints: **no repoint is needed here**, the primary dist is already 3.86.0, and Task 1 Step 1 proves it against the emitted `.d.ts` rather than the version constant alone. §6 bullet 5 (copy = sentences and labels, no raw codes, no vendor names) → Global Constraints, with two stated exceptions the spec itself displays: ISO country codes, and the permission-field key names this component has always rendered verbatim. §7 (all new fields optional and nullable; a newer console on an older Central renders no cards) → the "old-shape manifest" case in Task 1 and the "both null" case in Task 2. §8 "HaiWeb" (cards render with a block and not without; tree chips; checklist lists nine fields; build exit read directly; full vitest; no `(retry x`) → Tasks 1-3 and the Task 4 gate. §8 "Owner walk" → Task 4 Step 3, flagged as depending on Lane A's seed and the rig. §9 step 3 → Task 4's HOLD. **Not in this plan, by design:** §3, §4, §5 (protocol, haiCore, haiClient — other lanes) and §10's audit-grid, dashboard, badge and describer work (the sibling lane's spec, file-disjoint).

**2. Placeholder scan.** No TBD, TODO, "implement later", "handle edge cases" or "similar to Task N". Every code step carries the code. Four angle-bracket slots survive on purpose and are all in Task 4 Step 3's PR body — the tip sha and the gate/control counts, which cannot exist before the gate runs; the step says filling them is part of the step. `v1.90 PR 2` is agent1's allocation, named as such and re-stated at HOLD.

**3. Type consistency.** `FacilityBlock` is the type in Task 1's fixture, in `DimensionOriginCard`'s prop and in the manifest keys it reads; `block.facility_name` is `string | undefined` (hence `??`, not `||`), `block.region_code` is `string | undefined`, and `design_origin` / `firmware_origin` are `FacilityBlock | null | undefined`, which is exactly the prop type. `DIMENSION_TEST_ID` (Task 1) and `DIMENSION_CHIP_TEST_ID` (Task 2) are distinct maps in distinct files with distinct key sets (`'Design origin' | 'Firmware origin'` vs `'Design' | 'Firmware'`) — deliberate, since the drawer's label is the card's visible heading and the chip's is a word inside a sentence. `resolvedCountry` keeps its existing signature `(country: string | null | undefined) => string | null` and is not redefined. The test ids used in the tests are the ones the implementations emit: `dimension-origin-design`, `dimension-origin-firmware`, `origin-chip-design`, `origin-chip-firmware`. No `any` anywhere; the two `as ObservationNode['payload']` casts in Task 2 follow that test file's own existing fixture style.

**4. Ambiguities resolved inline.** The drawer's `<dt>` labels are **Entity** and **Site**, not the entry card's Facility/Region, because §2 names the concepts that way and the ladder fields are `design_entity` / `design_site`. `facility_type` is rendered (the spec subtracts only depth, batch, date and subcomponents) but humanised. The chip's visible text is `Design CN`, its title the full sentence `Design origin: CN`. The tree's Origin row now renders when a dimension resolves even if manufacturing does not — a behaviour change, and Task 2's fifth case exists to pin it.
