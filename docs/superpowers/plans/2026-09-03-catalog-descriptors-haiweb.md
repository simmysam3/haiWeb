# Catalog descriptors on the origin manifest — HaiWeb Implementation Plan (v1.85 PR 3, part 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the audit run page each SKU row says what the product is — name · brand · model · family under the SKU id, the short description on a second line — and the page's search finds products by those words.

**Architecture:** No BFF change (`api/account/audit-runs/[id]/results` forwards haiCore's rows verbatim; `AuditRunResult` is the protocol type, imported as a type only). `tier-gap-grid.tsx`: the normalised `SkuRow` carries the five as `''` when null; `SkuEvidenceRow` renders one sub-head node only when at least one is present and the row is not a vendor-level gap; the local filter also matches name, brand, model, family. The `CatalogProduct` mirror in `src/lib/haiwave-api.ts` gains the four as optional fields (no picker reads them).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (`line-clamp-2` is core), vitest 4.1.4 + Testing Library (jsdom; `retry: 2` configured), `@haiwave/protocol` via the `node_modules/@haiwave/protocol` symlink.

**Spec:** `docs/superpowers/specs/2026-09-03-catalog-descriptors-on-origin-manifest-design.md` (this repo, this branch, 5069bc8; owner-approved 2026-09-03). Read §2, §6, §8 first.

## Global Constraints

- Worktree `/Users/samfleming/dev/hw/haiWeb-v185`, existing branch `v1.85-catalog-descriptors` (base local `v1.85` = 6727590, UNPUSHED; spec 5069bc8; the three plans committed on top before Task 1). Every command starts with `cd /Users/samfleming/dev/hw/haiWeb-v185 &&` or `git -C /Users/samfleming/dev/hw/haiWeb-v185`. Never touch the primary `~/dev/hw/haiWeb` (serves :3001 `master`).
- **The :3002 dev server serves THIS worktree with hot reload** (pid 75417 on 2026-09-03) and is the owner-walk target — do not kill it. If it is gone, restart it with the SAME command line it had (`ps -o command= -p "$(lsof -nP -iTCP:3002 -sTCP:LISTEN -t)"` while it runs; otherwise ask the controller — never guess flags).
- **Protocol link is a BUILD-TIME concern only.** `node_modules/@haiwave/protocol -> ../../../haiCore/packages/protocol` (primary, 3.80.0). `tier-gap-grid.tsx` uses `import type`, `haiwave-api.ts` does no runtime validation, and vitest strips types — so the tests (Task 1 Steps 1–4) and the :3002 walk work at either link. Only `tsc` / `npm run build` (Task 1 Step 5, Task 2 Step 1) need the 3.81.0 types. Repoint ONLY when the controller relays hw-db's word: `cd /Users/samfleming/dev/hw/haiWeb-v185 && ln -sfn ../../../haiCore-v185/packages/protocol node_modules/@haiwave/protocol` then `node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'` → `3.81.0`. Restore (`ln -sfn ../../../haiCore/packages/protocol node_modules/@haiwave/protocol`) after the haiCore PR merges and the primary dist is rebuilt; verify it prints 3.81.0 then too. Never edit anything under `haiCore-v185`.
- Typechecks: `npm run build` (`next build`) is the binding gate for app code but **discards every diagnostic from `__tests__/` and `*.test.*`** (`next/dist/lib/typescript/runTypeCheck.js` `ignoreRegex`). The typecheck that covers test files is `cd /Users/samfleming/dev/hw/haiWeb-v185 && ./node_modules/.bin/tsc --noEmit --incremental false` (baseline 0 errors on 2026-09-03; an error under `.next/dev/types` is stale dev typing, not yours). Run both; read each exit on the next line (`echo "exit=$?"`).
- Tests through agent1's machine-wide mutex: `cd /Users/samfleming/dev/hw/haiWeb-v185 && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run <file> --maxWorkers=3` (vitest 4: **no `--minWorkers`**). `retry: 2` is configured — scan every run for `(retry x`; a retried green is NOT green. Gates FOREGROUND; the controller announces the Task 2 whole-suite gate to `hw-db`.
- **Rendering rule (spec §6, read literally):** line 1 = the present parts of `[product_name, brand, model, family]` joined with ` · ` (U+00B7); line 2 = `short_description`, `line-clamp-2`, `title` = full text. No sub-head node when all five are absent (no dash, no placeholder). A withheld row (`product_id` null) keeps its `—` and gets no sub-head. **A vendor-level "did not respond" row is unchanged: note kept, no sub-head** — descriptors do exist on that row (haiCore emits them from the manifest), so widening is a one-line change the PR body offers the owner.
- **Search rule (spec §6):** the existing box (copy unchanged) matches, case-insensitive substring, `productId` and `vendorName` (today) plus `productName`, `brand`, `model`, `family`; not the short description.
- Out of scope (spec §6): audit definition page, watcher pages, picker UI (`templates/_components/partner-sku-picker.tsx` keeps its own local interface), own-catalog views, the BFF, `e2e/`. Conventions: no new pill, no chevron; `data-testid` is accepted (`in-progress-poller.tsx:102`). Comments dated `v1.85 (2026-09-03)` citing D-207. No `any`.
- Commit after every green task; messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg`. **No push / PR / merge / tag / deploy**; `origin/v1.85` stays behind local by the owner's choice. Re-read `git log --oneline v1.85..HEAD` before packaging (a stop-time hook may add commits).

---

### Task 1: SKU sub-head, search, and the `CatalogProduct` mirror

**Files:**
- Modify: `src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx` — `SkuRow` (`:76-86`), the row header's left column in `SkuEvidenceRow` (`:145-153`, the `<span className="flex items-center gap-2">` around the mono id and `DomesticFlagBadge`) and right column (`:154`), the `rows` / `filtered` memos (`:218-245`)
- Modify: `src/lib/haiwave-api.ts:187-191` (`CatalogProduct`)
- Test: Modify `src/app/account/sonar/audit/[run_id]/_components/__tests__/tier-gap-grid.test.tsx` (`result()` at `:38-50` gains an optional 4th argument; one new `describe`)

**Interfaces:** Consumes `AuditRunResult.product_name / brand / model / family / short_description` (`string | null | undefined`, protocol 3.81.0 — the haiCore plan's Task 2 / Task 5) and haiCore's `CatalogProduct` shape (its Task 4). Produces `SkuRow.productName / brand / model / family / shortDescription: string` (`''` when absent); one `data-testid="sku-descriptors"` node per row that has any of the five and is not a vendor-level gap; `CatalogProduct.brand? / model? / family? / short_description?: string | null`.

- [ ] **Step 1: Failing tests**

Replace `result()` (`:38-50`):
```ts
// v1.85 (2026-09-03), D-207: a result row may carry the vendor's latest manifest
// name + catalog descriptors; the grid reads them, '' when absent.
type Descriptors = Partial<Pick<AuditRunResult, 'product_name' | 'brand' | 'model' | 'family' | 'short_description'>>;

function result(productId: string, vendorId: string, tree: ObservationNode, descriptors: Descriptors = {}): AuditRunResult {
  return {
    result_id: `res-${productId}`,
    product_id: productId,
    vendor_participant_id: vendorId,
    geo_rollup: [],
    tree,
    ...descriptors,
  } as unknown as AuditRunResult;
}
```
Append at the end of the file:
```ts
// v1.85 (2026-09-03), D-207: what the product is, under its SKU id.
describe('TierGapGrid catalog descriptors', () => {
  const full: Descriptors = { product_name: 'Widget', brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget for small jobs.' };

  it('renders name · brand · model · family under the SKU id — present parts only — and the clamped, titled description', () => {
    render(<TierGapGrid run={RUN} results={[
      result('ACME-1', 'p-acme', node(1, false, [], 'Acme'), full),
      result('ACME-2', 'p-acme', node(1, false, [], 'Acme'), { brand: 'Acme', family: 'Widgets' }),
    ]} />);
    expect(screen.getByText('Widget · Acme · W-100 · Widgets')).toBeInTheDocument();
    expect(screen.getByText('Acme · Widgets')).toBeInTheDocument();
    expect(screen.getAllByTestId('sku-descriptors')).toHaveLength(2);
    const desc = screen.getByText('A small widget for small jobs.');
    expect(desc).toHaveAttribute('title', 'A small widget for small jobs.');
    expect(desc.className).toContain('line-clamp-2');
  });

  it('renders no sub-head node when the five are absent; a withheld row keeps its dash and has none', () => {
    const withheld = { ...result('X', 'p-acme', node(1, false, [], 'Acme')), product_id: null, vendor_participant_id: null } as unknown as AuditRunResult;
    render(<TierGapGrid run={RUN} results={[...FIXTURE, withheld]} />);
    expect(screen.queryByTestId('sku-descriptors')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('search matches name, brand, model and family (case-insensitive), not the description', () => {
    render(<TierGapGrid run={RUN} results={[
      result('ACME-1', 'p-acme', node(1, false, [], 'Acme'), full),
      result('BETA-1', 'p-beta', node(1, false, [], 'Beta'), { product_name: 'Bolt', brand: 'Boltco', model: 'B-9', family: 'Bolts' }),
    ]} />);
    const box = screen.getByLabelText('Search by product or vendor');
    const cases: Array<[string, string, string]> = [['w-100', 'ACME-1', 'BETA-1'], ['boltco', 'BETA-1', 'ACME-1'], ['widgets', 'ACME-1', 'BETA-1'], ['bolt', 'BETA-1', 'ACME-1']];
    for (const [q, shown, hidden] of cases) {
      fireEvent.change(box, { target: { value: q } });
      expect(screen.getByText(shown)).toBeInTheDocument();
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
    fireEvent.change(box, { target: { value: 'small jobs' } });
    expect(screen.getByText('No products match your search.')).toBeInTheDocument();
  });

  it('a vendor-level "did not respond" row is unchanged — note kept, no sub-head', () => {
    render(<TierGapGrid run={RUN} results={[result('U-1', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable'), full)]} />);
    expect(screen.getByText('Vendor did not respond')).toBeInTheDocument();
    expect(screen.queryByTestId('sku-descriptors')).toBeNull();
    expect(screen.getAllByText('pts')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Red**

Run: `cd /Users/samfleming/dev/hw/haiWeb-v185 && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run "src/app/account/sonar/audit/[run_id]/_components/__tests__/tier-gap-grid.test.tsx" --maxWorkers=3`
Expected: the first and third new tests FAIL (`getByText('Widget · Acme · W-100 · Widgets')` finds nothing; the `w-100` search hides ACME-1). The second and fourth pass today (nothing renders yet) — they are the guards that keep today's rows unchanged. Every pre-existing test stays green.

- [ ] **Step 3: Green**

`SkuRow` (`:76-86`) gains, after `vendorName: string;`:
```ts
  // v1.85 (2026-09-03), D-207: the vendor's latest manifest name + catalog descriptors
  // (protocol 3.81.0), '' when null or absent.
  productName: string;
  brand: string;
  model: string;
  family: string;
  shortDescription: string;
```
The `rows` memo, after `vendorName: vendorNameOf(r.tree),`:
```ts
          productName: r.product_name ?? '',
          brand: r.brand ?? '',
          model: r.model ?? '',
          family: r.family ?? '',
          shortDescription: r.short_description ?? '',
```
The `filtered` memo's predicate becomes:
```ts
    // v1.85 (2026-09-03), D-207: the box also finds a product by its name, brand, model or family.
    return rows.filter((e) =>
      [e.productId, e.vendorName, e.productName, e.brand, e.model, e.family].some((s) => s.toLowerCase().includes(q)),
    );
```
In `SkuEvidenceRow`, after the `domestic` const:
```ts
  // v1.85 (2026-09-03), D-207: what the product is, under its id — present parts only; no node
  // when the vendor published nothing, and none on a vendor-level gap row (spec §6: unchanged).
  const headline = [row.productName, row.brand, row.model, row.family].filter(Boolean).join(' · ');
  const hasSubhead = (headline !== '' || row.shortDescription !== '') && !isVendorLevelGap(row.result);
```
Replace the left column (`:145-153`) with:
```tsx
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="font-mono text-charcoal">{row.productId || '—'}</span>
            {domestic && auditorCountry && (
              <DomesticFlagBadge country={auditorCountry} title={`All components verified ${auditorCountry}-origin`} />
            )}
          </span>
          {hasSubhead && (
            <span data-testid="sku-descriptors" className="flex flex-col text-xs text-slate">
              {headline && <span>{headline}</span>}
              {row.shortDescription && (
                <span className="line-clamp-2" title={row.shortDescription}>{row.shortDescription}</span>
              )}
            </span>
          )}
        </span>
```
and add `shrink-0` to the right column's `<span className="flex items-center gap-2">` (`:154`) so a long description cannot squeeze the score column. The parent keeps `items-center`.

`CatalogProduct` (`haiwave-api.ts:187-191`) gains, after `primary_class_slug`:
```ts
  // v1.85 (2026-09-03), D-207: the latest manifest's descriptors as haiCore's catalog-service
  // sends them (null when none); optional so rows from a 3.80.0 Central still type. No picker reads them yet.
  brand?: string | null;
  model?: string | null;
  family?: string | null;
  short_description?: string | null;
```

- [ ] **Step 4: Green**

Run the Step 2 command plus `"src/app/account/sonar/audit/[run_id]/__tests__/page.test.tsx"` → PASS, no `(retry x`.

- [ ] **Step 5: Typecheck (link at 3.81.0 — on hw-db's word), commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'    # 3.81.0, else repoint per Global Constraints (or wait)
cd /Users/samfleming/dev/hw/haiWeb-v185 && ./node_modules/.bin/tsc --noEmit --incremental false
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiWeb-v185 && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiWeb-v185 && git add "src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx" "src/app/account/sonar/audit/[run_id]/_components/__tests__/tier-gap-grid.test.tsx" src/lib/haiwave-api.ts && git commit -m "feat(audit): SKU rows show name · brand · model · family and the short description; search matches them (D-207)" -m "Sub-head renders only when the vendor's manifest carries any of the five and the row is not a vendor-level gap. CatalogProduct mirror carries the four as optional." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```
(At a 3.80.0 link `tsc` reports `TS2344` on the test's `Pick<AuditRunResult, 'product_name' | …>` and `TS2339` in the grid — that is the missing 3.81.0, not a defect.)

---

### Task 2: Gate, owner-walk checklist, PR package — HOLD for the owner

Output: `/Users/samfleming/dev/hw/haiWeb-v185/.superpowers/sdd/2026-09-03-catalog-descriptors-haiweb/` (untracked — preserve before any worktree removal).

- [ ] **Step 1: Builds and the gate (controller announces the gate to hw-db first)**

```bash
git -C /Users/samfleming/dev/hw/haiWeb-v185 status --porcelain    # nothing
cd /Users/samfleming/dev/hw/haiWeb-v185 && node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'    # 3.81.0
cd /Users/samfleming/dev/hw/haiWeb-v185 && ./node_modules/.bin/tsc --noEmit --incremental false
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiWeb-v185 && npm run build
echo "exit=$?"
mkdir -p /Users/samfleming/dev/hw/haiWeb-v185/.superpowers/sdd/2026-09-03-catalog-descriptors-haiweb
cd /Users/samfleming/dev/hw/haiWeb-v185 && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 2>&1 | tee .superpowers/sdd/2026-09-03-catalog-descriptors-haiweb/gate.log; echo "pipe-exit=${pipestatus[1]}"
grep -c "(retry x" /Users/samfleming/dev/hw/haiWeb-v185/.superpowers/sdd/2026-09-03-catalog-descriptors-haiweb/gate.log    # 0
```
Expected: all exit 0; `Test Files … passed` (PR 2's gate was 327 files / 2046 tests, plus this plan's four). `e2e/` is untouched, so no Playwright step.

- [ ] **Step 2: Owner walk (spec §8; the controller runs it with hw-db — not an executor step)**

Needs: a Central running haiCore PR 3 with 0047 applied (lane Central on `haiCore-v185` + `haiwave_v185_test`, or dev after merge + deploy); :3002 pointed at it (measure the running env — never guess, never copy an env file: a copied env copies an identity); one vendor with descriptors on a few products and one without — before the haiClient PR ships, publish with the vendor agent's token in the shape the sync will send:
```bash
curl -sS -X POST "$CENTRAL/api/v1/provenance/manifest" -H "Authorization: Bearer $VENDOR_TOKEN" -H "X-HaiWave-Participant-Id: $VENDOR_ID" -H "Content-Type: application/json" \
  -d '{"external_product_id":"<sku>","product_name":"<name>","domestic_context":"US","origin_entries":[<one facility entry>],"brand":"Acme","model":"W-100","family":"Widgets","short_description":"<a genuinely long description, to see the two-line clamp>"}'
```
Then an audit run over that vendor, open `/account/sonar/audit/<run_id>` on :3002: sub-head on the seeded SKUs, none on the others, search by brand. Works at either protocol link (types only).

- [ ] **Step 3: PR body, HOLD**

`git -C /Users/samfleming/dev/hw/haiWeb-v185 log --oneline v1.85..HEAD` → write `pr-body.md`: title `v1.85 PR 3 (HaiWeb) — catalog descriptors on audit-run SKU rows (D-207, protocol 3.81.0)`; `## Summary` (spec + three plans as docs; Task 1); `## Test plan` (gate numbers, `tsc` + build exits, the walk result); `## Requires` ("haiCore v1.85 PR 3 deployed to Central; the build needs the protocol link at a 3.81.0 build; restore the link to the primary after the haiCore merge"); `## For the owner` ("spec §6 read literally: no sub-head on a vendor-level 'did not respond' row, though haiCore does send its descriptors — widening is one condition in `hasSubhead` plus a test flip, on your word"); attribution lines `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg`.

Report branch, HEAD, commits, gate numbers, the protocol version the build ran against, `pr-body.md` path. **Do not push, PR, or merge.** On the owner's word only: `git -C /Users/samfleming/dev/hw/haiWeb-v185 push -u origin v1.85-catalog-descriptors` (and `v1.85` only if the owner says so) then `gh pr create --repo simmysam3/haiWeb --base v1.85 --head v1.85-catalog-descriptors --title "…" --body-file …/pr-body.md`. After the haiCore merge and primary rebuild: restore the link and re-run `tsc` + `npm run build` once.

---

## Self-review (author)

**Spec coverage.** §6 Types → Task 1 (mirror, optional fields; protocol via the link, build-time only); §6 BFF → no change (verified: the route returns `client.getAuditRunResults(...)` verbatim); §6 Grid → Task 1 (five normalised fields, present-parts join, clamped titled second line, no node when absent, withheld unchanged, vendor-level unchanged — literal); §6 Search → Task 1 `filtered`; §6 Out of scope / Conventions → Global Constraints; §8 HaiWeb tests → Task 1's four `it`s (order; no node when absent; brand + model search; withheld and vendor-level unchanged) and the gate shape (build exit direct, full `vitest run --maxWorkers=3`, no `(retry x`); §8 owner walk → Task 2 Step 2; §9 step 3 → base `v1.85`, repoint on agent1's word, restore after merge.

**Placeholders / cannot-fail.** None; the two guard tests are named as guards in Step 2.

**Type consistency.** `SkuRow.productName / brand / model / family / shortDescription` are used identically in `rows`, `filtered` and `SkuEvidenceRow`; wire names match the haiCore plan's protocol Task 2 and results Task 5; `CatalogProduct`'s four match its Task 4. `Descriptors` is derived from `AuditRunResult`, so a protocol rename fails `tsc` (which, unlike `next build`, reads test files).

**Counters.** None spent here; D-207 / 3.81.0 are references to the haiCore PR.
