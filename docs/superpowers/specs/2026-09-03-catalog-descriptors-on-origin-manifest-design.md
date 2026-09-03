# Vendor catalog descriptors on the origin manifest — design (v1.85 PR 3)

Owner-approved in conversation 2026-09-03 (six design sections). Counters ON HOLD with agent1, unspent: decision **D-207** (register row v1.53), protocol **3.81.0**, migration **PG 0047**, haiClient **1.86.0** (conditional on F-23 shipping as 1.85.0 first). Nothing below is written until the owner approves this spec and agent1 releases the hold.

## 1. Problem and rulings

The audit run page (`/account/sonar/audit/[run_id]`) lists each vendor's audited products by bare SKU id — not even the product name. Companies have no way to publish a brand, model, family, or short description for a product, and haiCore has no storage for model or short description at all (the network index carries `brand` and `family_id` columns that nothing writes).

Owner rulings (2026-09-03):
- Add **model** and **short description** as new optional fields; brand and family likewise optional. Companies provide them because they improve findability; nothing is inferred.
- **Family is the product line** the vendor already has on every product. No new vendor column for it.
- **Model is its own field**, distinct from `manufacturer_part_number` (which stays unused).
- **Ride the existing origin-manifest publish** (the owner's "we already have that mechanism"): no new haiCore endpoint, no new agent job, no classifier involvement.
- **Publish + display now; search later.** Feeding the fields into GoFish or catalog search is a separate spec (§10).
- **Accepted caveat:** a product with no origin manifest carries no descriptors — the same limit the product name has today.

## 2. Semantics

| field | type / cap | vendor source | stored on Central | shown |
|---|---|---|---|---|
| `brand` | text ≤ 255, nullable | `products.brand` (new) | `origin_manifests.brand` | audit run SKU sub-head; catalog endpoint |
| `model` | text ≤ 255, nullable | `products.model` (new) | `origin_manifests.model` | same |
| `family` | text ≤ 255, nullable | `products.product_line` (existing) | `origin_manifests.family` | same |
| `short_description` | text ≤ 500, nullable | `products.short_description` (new) | `origin_manifests.short_description` | same, second line |

- Every manifest version is a full statement: the agent always sends all four (null when the product has none); a version stores exactly what was sent. Readers show the **latest version** per (participant, product), as they do for the name today.
- No manifest → no name and no descriptors (accepted). Display parity with the product name holds everywhere.
- Caps match the neighbours: 255 like `product_name`, 500 like `subcomponent_description`.

## 3. Protocol 3.81.0 (`packages/protocol/src`)

- `provenance/origin-manifest.ts`: `OriginManifestSubmitSchema` and `OriginManifestSchema` gain `brand`, `model`, `family` (`z.string().max(255).nullable().optional()`) and `short_description` (`max(500)`, same modifiers). `OriginManifestSummarySchema` unchanged.
- `audit/traversal.ts`: `AuditRunResultSchema` gains `product_name` (`max(255)`) plus the same four, all `.nullable().optional()`, so a result row from a 3.80.0 Central still parses.
- `version.ts`: one 3.81.0 entry in the 3.80.0 shape — two "additive" lines (manifest fields; result fields) and the "next free" line moves to 3.82.0.

## 4. haiCore (`apps/core`)

### 4.1 Migration 0047 (`drizzle/0047_origin_manifest_catalog_descriptors.sql`)
`ALTER TABLE origin_manifests ADD COLUMN brand text NULL, ADD COLUMN model text NULL, ADD COLUMN family text NULL, ADD COLUMN short_description text NULL;` Drizzle schema (`db/schema/origin-manifests.ts`) mirrors it. No backfill, no index — the latest-version lookup already runs on `(participant_id, external_product_id, manifest_version)`. Applied via `db:apply --workspace=apps/core -- status` then `-- migrate` on a lane DB, then dev. **Check prod's constraints before any prod migration** (0046 drift precedent).

### 4.2 Publish (`services/origin-manifest-service.ts`)
`createOrUpdateManifest` copies the four fields onto the new version row it already inserts (`manifest_version = max + 1`, Central-assigned). The manifest mapper returns them on every read (`getManifest`, `getManifestByVersion`, grouped/list views that return full manifests).

### 4.3 Catalog read (`services/catalog-service.ts`, `routes/participant-catalog.ts`)
The existing `LEFT JOIN LATERAL` that fetches the latest manifest's `product_name` also selects the four fields; the catalog product row and the route's response type carry them (`null` when absent). Paging, ordering, and the active-trading-pair guard are unchanged.

### 4.4 Results read (`services/audit-run-service.ts`)
`getResults` gains a `LEFT JOIN LATERAL` to the vendor's latest manifest on `(vendor_participant_id, product_id)`; `mapResultRow` emits `product_name` and the four descriptors, `null` when there is no manifest or the row's `product_id` is null (withheld rows stay withheld). Every emitter of `AuditRunResult` in that service carries the fields or nulls; the plan enumerates them.

### 4.5 Decision record
**D-207** row in `docs/security/security-compliance.md`, in D-206's shape, written from the primary source at PR time: vendor-declared catalog metadata on the vendor's own manifest; served only through doors that already require a trading relationship (counterparty catalog) or already return the same vendor's product ids to the auditor (audit results); no new door; no stock or quantity data; the counterparty disclosure ceiling (D-148) is unchanged. Revision-history row **v1.53**.

## 5. haiClient (`packages/reference-agent`)

### 5.1 Products table (`src/db/duckdb-adapter.ts`)
Three nullable columns: `brand VARCHAR`, `model VARCHAR`, `short_description VARCHAR`. Table creation is create-if-missing, so the adapter also runs `ALTER TABLE products ADD COLUMN IF NOT EXISTS …` for each, idempotent on existing stores. Family is `product_line`; no column.

### 5.2 Seed packages and import (`scripts/lib/seed-package-schema.ts`, `scripts/import-gathered-agent.ts`)
The per-product schema gains the three optional fields; the import writes them through. Packages without them import unchanged. Extracting them during a gather is a follow-up (§10).

### 5.3 Manifest sync (`src/services/manifest-sync.ts`)
- Local `origin_manifests` gains `last_published_descriptor_hash VARCHAR NULL` (adapter DDL + add-column-if-missing).
- `findUnpublishedManifests` joins `products` and selects rows where `manifest_version > last_published_version` (as today) **or** the descriptor hash — over `product_name, brand, model, product_line, short_description` — differs from `last_published_descriptor_hash`.
- The submit carries `brand`, `model`, `family` (= `product_line`), `short_description` from the products row; on success `markPublished` stores the hash beside the version. Central assigns versions, so nothing is bumped locally.
- The inter-publish throttle is unchanged; a bulk descriptor import republishes at the same bounded rate as an origin rollout.

### 5.4 Protocol re-vendor and release
haiClient vendors the protocol; this work waits for 3.81.0 to merge to haiCore main. The re-vendor and the **1.86.0** bump are **agent1's step**, run on the owner's word. Against a 3.80.0 Central the four fields are stripped silently and the publish succeeds; the hash is still stored, so those descriptors republish only on their next change — acceptable because haiCore ships first (§7).

## 6. HaiWeb

- **Types.** `AuditRunResult` is imported from the protocol; during development the worktree's protocol link points at the lane haiCore build (3.81.0), restored to the primary after the merge (PR 2 pattern). The local `CatalogProduct` mirror in `src/lib/haiwave-api.ts` gains the four descriptors (no picker UI change).
- **BFF.** `api/account/audit-runs/[id]/results` passes haiCore's rows through untouched — no change, no extra fetch.
- **Grid** (`src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx`). The normalised SKU row gains `productName`, `brand`, `model`, `family`, `shortDescription` ('' when null). Under the mono SKU id: line 1 joins name · brand · model · family with a middle dot, present parts only; line 2 is the short description, clamped to two lines with the full text as `title`. When all five are absent **no sub-head node renders** — no dashes, no placeholder; today's rows are unchanged. Vendor-level "did not respond" rows are unchanged.
- **Search.** The grid's "Search by product or vendor" box also matches name, brand, model, family (the page's local filter; not the deferred search work).
- **Out of scope.** Audit definition page, watcher pages, catalog picker UI, own-catalog views.
- **Conventions.** No new pill, no chevron; copy is the visible text only.

## 7. Compatibility, security, rollout

- **Wire.** All new fields optional + nullable. 3.80.0 Central strips a 3.81.0 agent's fields (publish succeeds); 3.80.0 HaiWeb ignores 3.81.0 result fields; 3.81.0 HaiWeb on a 3.80.0 Central renders no sub-head. No order breaks; the chosen order is **haiCore → haiClient → HaiWeb**.
- **Republish after upgrade.** Stated in §5.4; no version-aware retry is built.
- **Security.** §4.5. No new door; catalog-tier data only.
- **Gates.** One vitest gate at a time on this machine — tell agent1 before any haiCore or HaiWeb gate. haiCore gates on a lane DB only.
- **Counters.** All on hold with agent1 (header). Ask again before writing any; report each use by message.

## 8. Testing (red/green per behaviour)

- **Protocol.** Submit with all four parses; without them parses with nulls; result row with and without the five fields parses.
- **haiCore (lane DB).** Publish stores the four on the new version; a later publish without them stores nulls on the next version, history intact; catalog query returns the latest version's values only; results carry name + descriptors for a vendor with a manifest, nulls without one, nulls on a withheld row; route tests pin both response shapes; migration proven by status-then-migrate.
- **haiClient.** Adapter add-column idempotent on an existing store; sync publishes on a descriptor-only change and stores the hash; unchanged product does not publish; submit carries the four; family equals product line; import with and without the fields.
- **HaiWeb.** Sub-head renders in the stated order; no sub-head node when all absent; search matches brand and model; withheld and vendor-level rows unchanged. Gate: `npm run build` exit read directly; full `npx vitest run --maxWorkers=3`; no `(retry x`.
- **Owner walk.** One seeded vendor with descriptors on a few products and one without, on :3002 against the lane Central.

## 9. Delivery

1. haiCore PR on a lane branch/worktree (`haiCore-v185`, lane DB): protocol 3.81.0 + migration 0047 + §4 services + D-207 row. Owner merges.
2. agent1: haiClient protocol re-vendor + 1.86.0 (its step); then the haiClient PR: §5. Owner merges; rig relaunch is agent1's.
3. HaiWeb PR on `v1.85-catalog-descriptors` (base `v1.85`): §6. Dev-time protocol link repoint per agent1's message; restore after merge.
Each PR: its own SDD run (plan → tasks → per-task review → final review → one fix wave → gate), counters spent only when written and reported to agent1.

## 10. §L (deferred, not forgotten)

- GoFish candidate retrieval and catalog/audit-scope search over brand, model, family, short description (owner: separate spec once data exists).
- Gather skill: extract the three fields from scraped catalogs.
- Own-catalog views and the catalog picker showing the descriptors.
- Epicor connector mapping once a live product sync exists (today: Swagger captures only).
- Version-aware republish after an agent-before-Central upgrade.
- `network_index.brand` / `family_id` remain unwritten; retire or repurpose in a later cleanup.
