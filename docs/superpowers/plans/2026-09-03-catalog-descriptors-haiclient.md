# Catalog descriptors on the origin manifest — haiClient Implementation Plan (v1.85 PR 3, part 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Products carry brand, model and short description; seed packages import them; the manifest sync publishes brand, model, family (= product line) and short description with every manifest and republishes a product when any of them changes.

**Architecture:** Three nullable columns on `products` and one (`last_published_descriptor_hash`) on `origin_manifests`, in the adapter's table templates and its existing `columnMigrations` retrofit. `SeedProductSchema` + the import write the three through. `ManifestSyncService` LEFT JOINs `products`, hashes the five submitted descriptor values (sha256), stores the hash beside `last_published_version`, and publishes a row when its version is newer than the published one (today's rule) or, for the product's latest local version, the hash differs. Central assigns versions; the 15-minute cycle and 50 ms throttle are unchanged.

**Tech Stack:** Node 26, TypeScript, DuckDB (`duckdb` binding) behind `DuckDBAdapter` / `DuckDBDataStore`, zod, vitest 3.2.4 at the repo root (root `vitest.config.ts` aliases the SDK and reference-agent to `src`), the vendored protocol at `haicore-protocol/`.

**Spec:** `docs/superpowers/specs/2026-09-03-catalog-descriptors-on-origin-manifest-design.md` (HaiWeb repo, branch `v1.85-catalog-descriptors`, 5069bc8; owner-approved 2026-09-03). Read §2, §5, §7 first; §8 lists the behaviours the tests pin.

## Global Constraints

- **Order (spec §9):** haiCore PR 3 merges → agent1 (`hw-db`) re-vendors the protocol at 3.81.0 and later bumps haiClient to 1.86.0 → this plan's Task 3 compiles. This plan CONSUMES both and performs neither: it never edits `haicore-protocol/`, `scripts/sync-protocol.mjs`, the root `package.json` `version` or `CHANGELOG.md`. Measured 2026-09-03: `origin/main` 1f325aba (1.84.8) vendors protocol **3.79.0**. Tasks 1–2 need no protocol change; Task 3 is gated (Step 0) on `haicore-protocol/package.json` reading `3.81.0`.
- Worktree **directly under `~/dev/hw`** (the tracked relative symlink `seed-data/companies.json -> ../../haiCore/seed-data/companies.json` makes depth a dependency): `/Users/samfleming/dev/hw/haiClient-catdesc`, branch `catalog-descriptors` (no version prefix — 1.86.0 is conditional and on hold; precedent `broker-p1-dispatch-door`), cut from `origin/main`. Never edit the primary `~/dev/hw/haiClient` checkout (another branch, dirty); it is named only by `git -C … fetch` / `worktree add`. Every command starts with `cd /Users/samfleming/dev/hw/haiClient-catdesc &&` or `git -C /Users/samfleming/dev/hw/haiClient-catdesc`.
- **Never `npm install`** (hangs on duckdb): APFS-clone `node_modules` from `/Users/samfleming/dev/hw/haiClient-1850` after `shasum -a 1` shows both `package-lock.json` identical (`94471d4c…` on 2026-09-03).
- Tests from the repo ROOT through agent1's machine-wide mutex: `cd /Users/samfleming/dev/hw/haiClient-catdesc && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run <file> --maxWorkers=3 --minWorkers=1` (mkdir lock at `/tmp/hw-vitest.lock`, exit status propagated; two DuckDB gates at once crash workers). In-memory / mkdtemp DuckDB only. Gates FOREGROUND; the controller still announces the Task 4 whole-suite gate to `hw-db`.
- `npm run build` (`tsc -b` + `typecheck:tests`) typechecks `src/` and the two packages incl. their tests — **not `scripts/`** (no tsconfig includes it); for Task 2 the vitest run is the only check. Read exit codes on the next line (`echo "exit=$?"`). `(retry x` in a green run is NOT green.
- DuckDB retrofit rule (adapter comment `duckdb-adapter.ts:876-900`): `ADD COLUMN` cannot carry `NOT NULL`; the four new columns carry no `DEFAULT` — NULL is the honest value for a pre-existing row.
- Semantics (spec §2, §5): `family` IS `products.product_line` (no new column); `model` is its own column (`manufacturer_part_number` untouched); every submit carries all four (null when none); Central assigns versions. Caps (255 / 255 / 500) are enforced at import so the sync never sends what Central refuses; no sync-side clamp (§L in the PR body).
- **Republish rule:** publish when `last_published_version IS NULL`, or `manifest_version > last_published_version` (today), or — the product's LATEST local version only — `last_published_descriptor_hash` differs from sha256 of `[product_name, brand, model, family, short_description]` as submitted. A NULL stored hash always differs, so every product published before this change republishes ONCE after upgrade (spec §5.4 presumes the mechanism; ~800 rows per agent at 20/s ≈ 40 s). Older local versions never republish by hash.
- Comments dated `v1.86 (2026-09-03)` citing D-207, one sentence of why. No `any`. Wire snake_case; seed-package fields camelCase. Commit after every green task; messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg`. **No push / PR / merge / tag / deploy / rig relaunch** — Task 4 HOLDS for the owner.
- Line numbers measured on `origin/main` 1f325aba; re-locate anchors by the quoted text after F-23 lands.

---

### Task 1: Worktree; four columns on fresh and existing stores

**Files:**
- Modify: `packages/reference-agent/src/db/duckdb-adapter.ts` — `products` template (`:60-77`, after `description VARCHAR,` at `:64`), `origin_manifests` template (`:251-264`, after `last_published_at TIMESTAMP,` at `:260`), `columnMigrations` (`:901+`: after the `plant_country_code` entry `:922-923` and after the `last_published_at` entry `:944-945`)
- Test: Modify `packages/reference-agent/src/db/__tests__/duckdb-adapter-migration.test.ts` — append one `it` immediately before the file's final `});` (the top-level describe's close; helpers `openRaw` / `rawRun` / `closeRaw` at `:35-42`, `dbPath` from `beforeEach`)

**Interfaces:**
- Produces: `products.brand`, `products.model`, `products.short_description` (VARCHAR, nullable) and `origin_manifests.last_published_descriptor_hash` (VARCHAR, nullable), present on a fresh store (CREATE) and retrofitted on an older one (ALTER, idempotent). Tasks 2–3 use these names.

- [ ] **Step 1: Worktree**

```bash
git -C /Users/samfleming/dev/hw/haiClient fetch origin
git -C /Users/samfleming/dev/hw/haiClient worktree add /Users/samfleming/dev/hw/haiClient-catdesc -b catalog-descriptors origin/main
shasum -a 1 /Users/samfleming/dev/hw/haiClient-catdesc/package-lock.json /Users/samfleming/dev/hw/haiClient-1850/package-lock.json    # identical, else pick a matching sibling
cp -Rc /Users/samfleming/dev/hw/haiClient-1850/node_modules /Users/samfleming/dev/hw/haiClient-catdesc/node_modules
ls -la /Users/samfleming/dev/hw/haiClient-catdesc/seed-data/companies.json /Users/samfleming/dev/hw/haiClient-catdesc/node_modules/@haiwave/   # symlinks resolve; protocol -> ../../haicore-protocol
grep -n '"version"' /Users/samfleming/dev/hw/haiClient-catdesc/haicore-protocol/package.json    # record; 3.81.0 unblocks Task 3
cd /Users/samfleming/dev/hw/haiClient-catdesc && npm run build
echo "exit=$?"
```

- [ ] **Step 2: Write the failing test**

```ts
  // v1.86 (2026-09-03), D-207: catalog descriptors on products and the sync's
  // descriptor hash on origin_manifests, retrofitted onto a store that
  // predates them. Both tables in one test: columnMigrations batches per table.
  it('retrofits products.brand/model/short_description and origin_manifests.last_published_descriptor_hash', async () => {
    const raw = await openRaw(dbPath);
    await rawRun(raw, `CREATE TABLE products (product_id VARCHAR PRIMARY KEY, product_name VARCHAR NOT NULL, product_line VARCHAR NOT NULL, description VARCHAR)`);
    await rawRun(raw, `INSERT INTO products (product_id, product_name, product_line) VALUES ('P-LEGACY', 'Legacy widget', 'Widgets')`);
    await rawRun(raw, `CREATE TABLE origin_manifests (manifest_id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), participant_id VARCHAR NOT NULL, product_id VARCHAR NOT NULL, product_name VARCHAR(255), manifest_version INTEGER NOT NULL DEFAULT 1, domestic_context VARCHAR(10) NOT NULL, origin_entries VARCHAR NOT NULL, last_published_version INTEGER, last_published_at TIMESTAMP, UNIQUE (participant_id, product_id, manifest_version))`);
    await rawRun(raw, `INSERT INTO origin_manifests (participant_id, product_id, domestic_context, origin_entries, last_published_version) VALUES ('pid-1', 'P-LEGACY', 'US', '[]', 1)`);
    await closeRaw(raw);

    const adapter = createDuckDBAdapter(dbPath);
    await adapter.initialize();
    const store = adapter.getStore();
    // Pre-existing rows read NULL — nothing was declared, nothing was hashed.
    expect(await store.query(`SELECT brand, model, short_description FROM products WHERE product_id = 'P-LEGACY'`))
      .toEqual([{ brand: null, model: null, short_description: null }]);
    expect(await store.query(`SELECT last_published_descriptor_hash FROM origin_manifests WHERE product_id = 'P-LEGACY'`))
      .toEqual([{ last_published_descriptor_hash: null }]);
    // And the columns are writable, not merely present.
    await store.exec(`INSERT INTO products (product_id, product_name, product_line, brand, model, short_description) VALUES ('P-NEW', 'New', 'Widgets', 'Acme', 'W-100', 'A small widget.')`);
    await store.exec(`UPDATE origin_manifests SET last_published_descriptor_hash = 'abc' WHERE product_id = 'P-LEGACY'`);
    expect(await store.query(`SELECT brand, model, short_description FROM products WHERE product_id = 'P-NEW'`))
      .toEqual([{ brand: 'Acme', model: 'W-100', short_description: 'A small widget.' }]);
    await adapter.close();
  });
```

- [ ] **Step 3: Red**

Run: `cd /Users/samfleming/dev/hw/haiClient-catdesc && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run packages/reference-agent/src/db/__tests__/duckdb-adapter-migration.test.ts --maxWorkers=3 --minWorkers=1`
Expected: the new test FAILS on the first `store.query` (`Binder Error: … column "brand" not found`); every existing test stays green.

- [ ] **Step 4: Green — templates and retrofit entries**

`products` template, after `description VARCHAR,`:
```sql
          -- v1.86 (2026-09-03), D-207: catalog descriptors published on the origin manifest; family is product_line.
          brand VARCHAR,
          model VARCHAR,
          short_description VARCHAR,
```
`origin_manifests` template, after `last_published_at TIMESTAMP,`:
```sql
          -- v1.86 (2026-09-03), D-207: sha256 of the descriptors last published (manifest-sync.ts); NULL = republish once.
          last_published_descriptor_hash VARCHAR,
```
`columnMigrations`, after the `plant_country_code` entry:
```ts
        // v1.86 (2026-09-03), D-207: no DEFAULT — NULL is the honest value for a row that predates the columns.
        { table: 'products', col: 'brand', ddl: 'ALTER TABLE products ADD COLUMN brand VARCHAR;' },
        { table: 'products', col: 'model', ddl: 'ALTER TABLE products ADD COLUMN model VARCHAR;' },
        { table: 'products', col: 'short_description', ddl: 'ALTER TABLE products ADD COLUMN short_description VARCHAR;' },
```
and after the `last_published_at` entry:
```ts
        { table: 'origin_manifests', col: 'last_published_descriptor_hash',
          ddl: 'ALTER TABLE origin_manifests ADD COLUMN last_published_descriptor_hash VARCHAR;' },
```

- [ ] **Step 5: Green, build, commit**

Run the Step 3 command → PASS (whole file). Then:
```bash
cd /Users/samfleming/dev/hw/haiClient-catdesc && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiClient-catdesc && git add packages/reference-agent/src/db/duckdb-adapter.ts packages/reference-agent/src/db/__tests__/duckdb-adapter-migration.test.ts && git commit -m "feat(db): products.brand/model/short_description + origin_manifests.last_published_descriptor_hash, created and retrofitted (D-207)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 2: Seed packages carry the descriptors; the import writes them through

**Files:**
- Modify: `scripts/lib/seed-package-schema.ts:13-22` (`SeedProductSchema`), `scripts/import-gathered-agent.ts:56-65` (the products `INSERT OR REPLACE`)
- Test: Modify `scripts/__tests__/seed-package-schema.test.ts` (append one `it` inside `describe('seed-package contract')`), `scripts/__tests__/import-gathered-agent.test.ts` (append one `it` inside `describe('importGatheredAgent')`; `work`, `join`, `mkdirSync`, `writeFileSync`, `duckdb` are module-level there)

**Interfaces:**
- Consumes: Task 1's columns. Produces: `SeedProduct.brand?` / `model?` / `shortDescription?` (`string | null`, min 1 / max 255, 255, 500); the import writes them to `products.brand` / `model` / `short_description`, NULL when absent.

- [ ] **Step 1: Write the failing tests**

```ts
  // v1.86 (2026-09-03), D-207: optional catalog descriptors, capped like the
  // manifest wire (255 / 255 / 500) and never empty.
  it('accepts brand / model / shortDescription (absent, null, or within caps) and rejects over-cap or empty', () => {
    const base = { productId: 'BETA-1', productName: 'Beta Coupler', productLine: 'Silicone Coupler', description: 'x' };
    expect(SeedProductSchema.parse({ ...base, brand: 'Beta', model: 'SC1-14', shortDescription: 'Reinforced.' }))
      .toMatchObject({ brand: 'Beta', model: 'SC1-14', shortDescription: 'Reinforced.' });
    expect(SeedProductSchema.parse({ ...base, brand: null, model: null, shortDescription: null })).toMatchObject({ brand: null, model: null, shortDescription: null });
    expect(SeedProductSchema.safeParse({ ...base, brand: 'x'.repeat(256) }).success).toBe(false);
    expect(SeedProductSchema.safeParse({ ...base, model: '' }).success).toBe(false);
    expect(SeedProductSchema.safeParse({ ...base, shortDescription: 'x'.repeat(501) }).success).toBe(false);
  });
```
```ts
  // v1.86 (2026-09-03), D-207: the three write through (apostrophe exercises esc); absent → NULL.
  it('writes brand / model / short_description through, NULL when the package has none', async () => {
    const dir = join(work, 'desc');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      schemaVersion: '1.0.0', mode: 'catalog', identity: { key: 'beta', name: 'Beta Manufacturing' },
      sourceUrl: 'https://hpsperformanceproducts.com', productModelType: 'parametric', capOverride: true, productCount: 2,
    }));
    writeFileSync(join(dir, 'products.json'), JSON.stringify([
      { productId: 'BETA-DESC', productName: 'Beta Coupler', productLine: 'Silicone Coupler', description: 'x',
        brand: "O'Brien", model: 'SC1-14', shortDescription: "Reinforced coupler, 1/4\" bore." },
      { productId: 'BETA-PLAIN', productName: 'Beta Plain', productLine: 'Silicone Coupler', description: 'x' },
    ]));
    writeFileSync(join(dir, 'pricing.json'), '[]');
    const dbFile = join(work, 'desc.duckdb');
    await importGatheredAgent({ packageDir: dir, dataPath: dbFile, seedDataDir: join(work, 'sd-desc') });
    const db = new duckdb.Database(dbFile);
    const products = await new Promise<any[]>((res, rej) =>
      db.all('SELECT product_id, brand, model, short_description FROM products ORDER BY product_id', (e, r) => { db.close(); e ? rej(e) : res(r); }));
    expect(products).toEqual([
      { product_id: 'BETA-DESC', brand: "O'Brien", model: 'SC1-14', short_description: "Reinforced coupler, 1/4\" bore." },
      { product_id: 'BETA-PLAIN', brand: null, model: null, short_description: null },
    ]);
  });
```

- [ ] **Step 2: Red**

Run: `cd /Users/samfleming/dev/hw/haiClient-catdesc && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run scripts/__tests__/seed-package-schema.test.ts scripts/__tests__/import-gathered-agent.test.ts --maxWorkers=3 --minWorkers=1`
Expected: schema test FAILS at its first `toMatchObject` (zod strips the unknown keys); import test FAILS with `brand: null` on `BETA-DESC`. Existing tests stay green.

- [ ] **Step 3: Green**

`SeedProductSchema`, after `dimensions`:
```ts
  // v1.86 (2026-09-03), D-207: catalog descriptors for the origin manifest; family is productLine.
  brand: z.string().min(1).max(255).nullable().optional(),
  model: z.string().min(1).max(255).nullable().optional(),
  shortDescription: z.string().min(1).max(500).nullable().optional(),
```
The products INSERT: add `brand, model, short_description` to the column list after `is_active` and, after `${p.isActive ?? true}`:
```ts
        ${p.brand ? `'${esc(p.brand)}'` : 'NULL'}, ${p.model ? `'${esc(p.model)}'` : 'NULL'}, ${p.shortDescription ? `'${esc(p.shortDescription)}'` : 'NULL'}
```
(same `esc` idiom as `material` / `dimensions`; `.min(1)` above is what keeps the truthiness test honest).

- [ ] **Step 4: Green, commit**

Run the Step 2 command → PASS. (`npm run build` does not cover `scripts/`; the test run is the check.)
```bash
cd /Users/samfleming/dev/hw/haiClient-catdesc && git add scripts/lib/seed-package-schema.ts scripts/import-gathered-agent.ts scripts/__tests__/seed-package-schema.test.ts scripts/__tests__/import-gathered-agent.test.ts && git commit -m "feat(seed): brand / model / shortDescription on seed packages, written through by the import (D-207)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 3: Manifest sync — submit carries the four; republish on a descriptor change

**Files:**
- Modify: `packages/reference-agent/src/services/manifest-sync.ts` (140 lines; whole file replaced below)
- Test: Modify `packages/reference-agent/src/services/__tests__/manifest-sync.test.ts` — extend the harness (`setupSchema` `:12-31`, `insertManifest` `:33-55`), fix one existing line (`:73`), append one `describe`

**Interfaces:**
- Consumes: Task 1's columns; `OriginManifestSubmit.brand / model / family / short_description` from the vendored protocol at **3.81.0** (Step 0).
- Produces: `export function descriptorHash(d: ManifestDescriptors): string` and `export interface ManifestDescriptors { product_name: string; brand: string | null; model: string | null; family: string | null; short_description: string | null }`; `runSync()` per the republish rule; `SyncResult` unchanged.

- [ ] **Step 0: Prerequisite gate**

Run: `grep -n '"version"' /Users/samfleming/dev/hw/haiClient-catdesc/haicore-protocol/package.json && grep -c short_description /Users/samfleming/dev/hw/haiClient-catdesc/haicore-protocol/dist/provenance/origin-manifest.d.ts`
Expected: `3.81.0` and ≥ 1. Otherwise STOP, report "Task 3 waits on agent1's 3.81.0 re-vendor"; when it lands: `git -C /Users/samfleming/dev/hw/haiClient-catdesc fetch origin && git -C /Users/samfleming/dev/hw/haiClient-catdesc rebase origin/main`, re-compare the lock with a sibling and re-clone `node_modules` only if it changed, `npm run build`, re-run this step.

- [ ] **Step 1: Write the failing tests**

Harness edits in `manifest-sync.test.ts`:
- Import: `import { ManifestSyncService, descriptorHash } from '../manifest-sync.js';`
- `setupSchema`: add `last_published_descriptor_hash VARCHAR,` after `last_published_at TIMESTAMP,`; after the `origin_manifests` `db.run` add a second one creating `products (product_id VARCHAR PRIMARY KEY, product_name VARCHAR NOT NULL, product_line VARCHAR NOT NULL, brand VARCHAR, model VARCHAR, short_description VARCHAR)`, same promise idiom.
- `insertManifest`: fifth parameter `publishedHash: string | null = null`; the INSERT lists `last_published_descriptor_hash` after `last_published_version` and binds `publishedHash` after `publishedVersion` (`VALUES (?, ?, ?, ?, 'US', ?, ?, ?)`).
- New helper, same idiom:
```ts
async function insertProduct(db: duckdb.Database, productId: string, productLine: string,
  d: { brand?: string | null; model?: string | null; shortDescription?: string | null } = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    db.run(`INSERT INTO products (product_id, product_name, product_line, brand, model, short_description) VALUES (?, ?, ?, ?, ?, ?)`,
      productId, `Product ${productId}`, productLine, d.brand ?? null, d.model ?? null, d.shortDescription ?? null,
      (err: Error | null) => (err ? reject(err) : resolve()));
  });
}
```
- Line 73 (the "already current" P3 row, which has no products row): `await insertManifest(db, 'P3', 1, 1, descriptorHash({ product_name: 'Product P3', brand: null, model: null, family: null, short_description: null }));`

Append inside `describe('ManifestSyncService')`:
```ts
  // ─── v1.86 (2026-09-03), D-207: catalog descriptors ─────────────────────────
  // Expected hashes are spelled out from the exact values inserted, so the
  // test cannot drift from what the service reads.
  const client = (spy: ReturnType<typeof vi.fn>) => ({ publishOriginManifest: spy } as unknown as HaiWaveClient);

  it('the submit carries brand / model / family (= product_line) / short_description; nulls without a products row', async () => {
    await insertProduct(db, 'P1', 'Widgets', { brand: 'Acme', model: 'W-100', shortDescription: 'A small widget.' });
    await insertManifest(db, 'P1', 1, null);
    await insertManifest(db, 'P2', 1, null); // no products row
    const spy = vi.fn().mockResolvedValue({});
    await new ManifestSyncService(makeAdapter(db), client(spy), 'pid-1').runSync();
    const byId = Object.fromEntries(spy.mock.calls.map((c) => [(c[0] as { external_product_id: string }).external_product_id, c[0]]));
    expect(byId['P1']).toMatchObject({ product_name: 'Product P1', brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget.' });
    expect(byId['P2']).toMatchObject({ brand: null, model: null, family: null, short_description: null });
  });

  it('a descriptor-only change republishes the latest version and stores the new hash; the local version is not bumped', async () => {
    await insertProduct(db, 'P1', 'Widgets', { brand: 'New Brand' });
    await insertManifest(db, 'P1', 1, 1, descriptorHash({ product_name: 'Product P1', brand: 'Old Brand', model: null, family: 'Widgets', short_description: null }));
    const spy = vi.fn().mockResolvedValue({});
    const result = await new ManifestSyncService(makeAdapter(db), client(spy), 'pid-1').runSync();
    expect(result).toEqual({ published: 1, skipped: 0, failed: 0 });
    expect(spy.mock.calls[0][0]).toMatchObject({ external_product_id: 'P1', brand: 'New Brand' });
    const rows = await new Promise<Array<{ last_published_version: number; last_published_descriptor_hash: string }>>((resolve, reject) =>
      db.all('SELECT last_published_version, last_published_descriptor_hash FROM origin_manifests WHERE product_id = ?', 'P1',
        (err: Error | null, r: unknown) => (err ? reject(err) : resolve(r as Array<{ last_published_version: number; last_published_descriptor_hash: string }>))));
    expect(rows[0]).toEqual({ last_published_version: 1,
      last_published_descriptor_hash: descriptorHash({ product_name: 'Product P1', brand: 'New Brand', model: null, family: 'Widgets', short_description: null }) });
  });

  it('an unchanged product does not publish; a NULL stored hash republishes once, then is current', async () => {
    await insertProduct(db, 'P1', 'Widgets', { brand: 'Acme' });
    await insertManifest(db, 'P1', 1, 1, descriptorHash({ product_name: 'Product P1', brand: 'Acme', model: null, family: 'Widgets', short_description: null }));
    await insertProduct(db, 'P2', 'Widgets');
    await insertManifest(db, 'P2', 1, 1, null); // published before the hash existed
    const spy = vi.fn().mockResolvedValue({});
    const service = new ManifestSyncService(makeAdapter(db), client(spy), 'pid-1');
    expect(await service.runSync()).toEqual({ published: 1, skipped: 1, failed: 0 });
    expect((spy.mock.calls[0][0] as { external_product_id: string }).external_product_id).toBe('P2');
    expect(await service.runSync()).toEqual({ published: 0, skipped: 2, failed: 0 });
  });

  it('only the LATEST local version republishes by hash; an older published version with a stale hash stays put', async () => {
    await insertProduct(db, 'P1', 'Widgets', { brand: 'Acme' });
    await insertManifest(db, 'P1', 1, 1, 'stale');
    await insertManifest(db, 'P1', 2, 2, descriptorHash({ product_name: 'Product P1', brand: 'Acme', model: null, family: 'Widgets', short_description: null }));
    const spy = vi.fn().mockResolvedValue({});
    expect(await new ManifestSyncService(makeAdapter(db), client(spy), 'pid-1').runSync()).toEqual({ published: 0, skipped: 2, failed: 0 });
    expect(spy).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Red**

Run: `cd /Users/samfleming/dev/hw/haiClient-catdesc && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run packages/reference-agent/src/services/__tests__/manifest-sync.test.ts --maxWorkers=3 --minWorkers=1`
Expected (vite-node loads the file; a missing named export is `undefined`, not a load error): the first existing test and the three new tests that call `descriptorHash` throw `TypeError: descriptorHash is not a function`; the submit test fails on `toMatchObject` (no `brand` on the wire). The three existing tests that touch no descriptor (`updates last_published_version…`, `continues past a single publish failure…`, `reentrancy guard…`) stay GREEN — correctly.

- [ ] **Step 3: Green — the service**

Replace `packages/reference-agent/src/services/manifest-sync.ts` with:
```ts
import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type { OriginEntry, OriginManifestSubmit } from '@haiwave/protocol';
import type { DuckDBAdapter } from '../db/duckdb-adapter.js';
import type { HaiWaveClient, IManifestSyncService, SyncResult } from '@haiwave/client-sdk';
export type { IManifestSyncService, SyncResult };

/** v1.86 (2026-09-03), D-207: the five descriptor values a submit carries, exactly as sent; family is product_line. */
export interface ManifestDescriptors {
  product_name: string;
  brand: string | null;
  model: string | null;
  family: string | null;
  short_description: string | null;
}

/** sha256 over the submitted descriptors; nulls are part of the statement. */
export function descriptorHash(d: ManifestDescriptors): string {
  return createHash('sha256')
    .update(JSON.stringify([d.product_name, d.brand, d.model, d.family, d.short_description]), 'utf8')
    .digest('hex');
}

interface CandidateRow {
  product_id: string;
  product_name: string | null;
  manifest_version: number;
  domestic_context: string;
  origin_entries: string;
  last_published_version: number | null;
  last_published_descriptor_hash: string | null;
  brand: string | null;
  model: string | null;
  product_line: string | null;
  short_description: string | null;
}

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Inter-publish throttle. Without this, ~800 awaited publishes complete in a
 * 2-second burst (~3ms each on the wire) and overwhelm haiCore's request
 * pipeline — empirically, ~93% returned 500 INTERNAL_ERROR during the v.1.26
 * rollout (see v1.26-changelog "Burst-publish concurrency"). 50ms caps
 * effective throughput at 20 publishes/sec, well within haiCore's headroom
 * even when several agents publish concurrently.
 */
const INTER_PUBLISH_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** What this row would submit — the same five values the hash is taken over. */
function descriptorsOf(row: CandidateRow): ManifestDescriptors {
  return {
    product_name: row.product_name ?? row.product_id,
    brand: row.brand ?? null,
    model: row.model ?? null,
    family: row.product_line ?? null,
    short_description: row.short_description ?? null,
  };
}

export class ManifestSyncService implements IManifestSyncService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private dbAdapter: DuckDBAdapter,
    private haiWaveClient: HaiWaveClient,
    private participantId: string,
    private logger?: Logger,
  ) {}

  start(): void {
    void this.runSync();
    this.intervalHandle = setInterval(() => {
      void this.runSync();
    }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async runSync(): Promise<SyncResult> {
    if (this.running) {
      this.logger?.debug('[ManifestSync] sync already in progress, skipping');
      return { published: 0, skipped: 0, failed: 0 };
    }
    this.running = true;
    let published = 0;
    let skipped = 0;
    let failed = 0;
    try {
      const { rows, byHash } = await this.findUnpublishedManifests();
      // A version-current row republishing for changed descriptors is not "already current".
      skipped = (await this.countSkipped()) - byHash;

      if (rows.length === 0) {
        this.logger?.debug('[ManifestSync] no manifests need publishing');
        return { published: 0, skipped, failed: 0 };
      }

      this.logger?.info(
        `[ManifestSync] ${rows.length} manifest(s) need publishing (${byHash} for changed descriptors, ${skipped} already current)`,
      );

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (i > 0) await sleep(INTER_PUBLISH_DELAY_MS);
        try {
          const d = descriptorsOf(row);
          const submit: OriginManifestSubmit = {
            external_product_id: row.product_id,
            product_name: d.product_name,
            domestic_context: row.domestic_context,
            origin_entries: JSON.parse(row.origin_entries) as OriginEntry[],
            // v1.86 (2026-09-03), D-207: every submit is a full statement.
            brand: d.brand,
            model: d.model,
            family: d.family,
            short_description: d.short_description,
          };
          await this.haiWaveClient.publishOriginManifest(submit);
          await this.markPublished(row.product_id, row.manifest_version, descriptorHash(d));
          published += 1;
        } catch (err) {
          failed += 1;
          this.logger?.warn(
            { err, productId: row.product_id, version: row.manifest_version },
            '[ManifestSync] publish failed; will retry next cycle',
          );
        }
      }
    } catch (err) {
      this.logger?.error({ err }, '[ManifestSync] sync failed');
    } finally {
      this.running = false;
    }
    return { published, skipped, failed };
  }

  /**
   * Rows to publish, in (product, version) order: never published or a newer
   * local version (as before); plus — v1.86 (2026-09-03), D-207 — the product's
   * LATEST local version when the descriptors it would send differ from the
   * ones last published (a NULL stored hash always differs → one republish
   * after upgrade). Older versions never republish by hash. Central assigns
   * versions, so a hash republish bumps nothing locally.
   */
  private async findUnpublishedManifests(): Promise<{ rows: CandidateRow[]; byHash: number }> {
    const store = this.dbAdapter.getStore();
    const candidates = await store.query<CandidateRow>(
      `SELECT m.product_id, m.product_name, m.manifest_version, m.domestic_context, m.origin_entries,
              m.last_published_version, m.last_published_descriptor_hash,
              p.brand, p.model, p.product_line, p.short_description
       FROM origin_manifests m
       LEFT JOIN products p ON p.product_id = m.product_id
       WHERE m.participant_id = ?
         AND (m.last_published_version IS NULL
              OR m.manifest_version > m.last_published_version
              OR m.manifest_version = (SELECT MAX(x.manifest_version) FROM origin_manifests x
                                       WHERE x.participant_id = m.participant_id AND x.product_id = m.product_id))
       ORDER BY m.product_id, m.manifest_version`,
      [this.participantId],
    );
    const rows: CandidateRow[] = [];
    let byHash = 0;
    for (const row of candidates) {
      if (row.last_published_version === null || row.manifest_version > row.last_published_version) {
        rows.push(row);
      } else if (row.last_published_descriptor_hash !== descriptorHash(descriptorsOf(row))) {
        rows.push(row);
        byHash += 1;
      }
    }
    return { rows, byHash };
  }

  private async countSkipped(): Promise<number> {
    const store = this.dbAdapter.getStore();
    const rows = await store.query<{ n: number }>(
      `SELECT COUNT(*)::INTEGER AS n FROM origin_manifests
       WHERE participant_id = ?
         AND last_published_version IS NOT NULL
         AND manifest_version <= last_published_version`,
      [this.participantId],
    );
    return rows[0]?.n ?? 0;
  }

  private async markPublished(productId: string, version: number, hash: string): Promise<void> {
    const store = this.dbAdapter.getStore();
    await store.exec(
      `UPDATE origin_manifests
       SET last_published_version = ?, last_published_at = now(), last_published_descriptor_hash = ?
       WHERE participant_id = ? AND product_id = ? AND manifest_version = ?`,
      [version, hash, this.participantId, productId, version],
    );
  }
}
```

- [ ] **Step 4: Green, build, commit**

Run the Step 2 command → PASS (all eight). Then:
```bash
cd /Users/samfleming/dev/hw/haiClient-catdesc && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiClient-catdesc && git add packages/reference-agent/src/services/manifest-sync.ts packages/reference-agent/src/services/__tests__/manifest-sync.test.ts && git commit -m "feat(manifest-sync): publish brand / model / family / short_description; republish on a descriptor change via a stored hash (D-207)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```
(An `Object literal may only specify known properties … 'brand'` build error means the vendored protocol is not 3.81.0 — back to Step 0.)

---

### Task 4: Gate and PR package — HOLD for the owner

Output: `/Users/samfleming/dev/hw/haiClient-catdesc/.superpowers/sdd/2026-09-03-catalog-descriptors-haiclient/pr-body.md` (gitignored; preserve before any worktree removal).

- [ ] **Step 1: Re-base check, build, gate (controller announces the gate to hw-db first)**

```bash
git -C /Users/samfleming/dev/hw/haiClient-catdesc fetch origin && git -C /Users/samfleming/dev/hw/haiClient-catdesc log --oneline HEAD..origin/main   # non-empty → rebase, re-run Task 3 Step 0
git -C /Users/samfleming/dev/hw/haiClient-catdesc status --porcelain    # nothing
cd /Users/samfleming/dev/hw/haiClient-catdesc && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiClient-catdesc && mkdir -p .superpowers/sdd/2026-09-03-catalog-descriptors-haiclient && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 --minWorkers=1 2>&1 | tee .superpowers/sdd/2026-09-03-catalog-descriptors-haiclient/gate.log; echo "pipe-exit=${pipestatus[1]}"
grep -c "(retry x" /Users/samfleming/dev/hw/haiClient-catdesc/.superpowers/sdd/2026-09-03-catalog-descriptors-haiclient/gate.log    # 0
```
(`frontend/` is outside the root suite and untouched.)

- [ ] **Step 2: PR body, then HOLD**

`git -C /Users/samfleming/dev/hw/haiClient-catdesc log --oneline origin/main..HEAD` → write `pr-body.md`: title `haiClient — catalog descriptors on the origin manifest (D-207; protocol 3.81.0; for 1.86.0)`; `## Summary` (one line per task); `## Test plan` (gate numbers, build exit); `## Changelog text for agent1` (placed under the 1.86.0 heading at the bump — this PR touches neither `CHANGELOG.md` nor the version):
```
### Added
- Products carry a brand, a model and a short description (nullable; existing stores gain the columns on first boot). Seed packages may carry `brand`, `model`, `shortDescription` per product (255 / 255 / 500) and the import writes them through; packages without them import unchanged. Family is the product line the product already has.
- The origin-manifest sync publishes brand, model, family and short description with every manifest and republishes a product when any of them changes (the last-published descriptors are remembered as a hash beside the published version). Central assigns versions; the 15-minute cycle and 20/s throttle are unchanged.
### Changed
- On the first sync after this upgrade every already-published manifest republishes once, so products already on Central receive their descriptors (~800 rows per agent at 20/s). Against a Central below protocol 3.81.0 the four fields are dropped at the door (`PROTOCOL_STRICT_VALIDATION` default `warn`) and the publish succeeds; under `enforce` it is refused and retried each cycle — haiCore ships first.
```
`## Prerequisites`: vendored protocol 3.81.0 (agent1's re-vendor sha); haiCore v1.85 PR 3 deployed; **stagger the 12-agent rig relaunch (agent1) so the one-time republish stays near 20–40/s aggregate, not 12 × 20/s**; the 1.86.0 bump + heading are agent1's. `## §L`: no sync-side clamp — a >255 value written by a future non-import path would 400 every cycle. Attribution lines: `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg`.

Report branch, HEAD, commits, gate numbers, vendored protocol version, `pr-body.md` path. **Do not push, PR, merge, or relaunch the rig.** On the owner's word only: `git -C /Users/samfleming/dev/hw/haiClient-catdesc push -u origin catalog-descriptors` then `gh pr create --repo simmysam3/haiClient --base main --head catalog-descriptors --title "…" --body-file …/pr-body.md`; report the PR URL to hw-db.

---

## Self-review (author)

**Spec coverage.** §5.1 → Task 1; §5.2 → Task 2 (gather extraction deferred, §10); §5.3 → Tasks 1 (hash column) + 3 (join, rule, submit, `markPublished`, nothing bumped, throttle unchanged); §5.4 → Global Constraints + Task 3 Step 0 (consumed, never performed); §7 → the changelog text; §8's six haiClient behaviours → Task 1 (adapter idempotent on an existing store), Task 3 (descriptor-only republish + hash stored; unchanged does not publish; submit carries the four; family = product line), Task 2 (import with and without); §9 step 2 → Task 4 HOLD. Two rulings the spec leaves implicit — NULL hash republishes once; latest version only — follow from §2 / §5.4 and are pinned by tests and stated in the changelog text.

**Placeholders.** None. **Cannot-fail assertions.** None (the `min(1)` and cap checks each flip on the schema change).

**Type consistency.** `descriptorHash` / `ManifestDescriptors` field order `product_name, brand, model, family, short_description` is the same in the service, `descriptorsOf`, and every expected hash in the tests, which are spelled out from the exact inserted values (no helper defaults to drift). Column names match Task 1's DDL, Task 2's INSERT and Task 3's SQL. `SyncResult` / `IManifestSyncService` unchanged.

**Counters.** 1.86.0 appears only as the heading agent1 creates. Branch `catalog-descriptors` carries no counter.
