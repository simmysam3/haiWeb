# Design origin and firmware origin on the origin manifest — design

Owner-approved in conversation 2026-09-08 (three clarifying rulings, one approach ruling, three design sections). Counters are all NEXT-FREE and UNALLOCATED: protocol MINOR (3.86.0 next-free after 3.85.0), one PG migration (0049 next-free), one decision number (D-218 next-free), one register revision (v1.73 next-free), one haiClient release, one HaiWeb slot. Nothing below is written until agent1 allocates and the owner releases the lane.

## 1. Problem and rulings

Design origin is not manufacturing origin. A radio SoC designed by a Chinese firm and fabricated in Taiwan resolves to `TW` on today's manifest, because the only origin the manifest carries is the manufacturing facility's `country_code`, and every consumer derives `country_of_origin` from that. For ICT, design and firmware provenance carry the implant risk, and neither is modelled anywhere (verified: zero hits for design origin, firmware origin, IP origin across haiCore, HaiWeb, haiClient, haiGather, haiPublic).

Owner rulings (2026-09-08):
- **Two new dimensions, separate:** design origin and firmware origin. They carry different risk and are often different parties; a buyer may require one without the other.
- **Country on the floor, entity on the ladder.** The two countries join `country_of_origin` as universal-floor fields every traversal returns. The identity details (entity name, site) become permission-ladder fields a provenance key can require or request.
- **Buyer opts in per dimension.** Provenance requirements gain `require_domestic_design` and `require_domestic_firmware`, default off. No existing buyer's verdict changes. Audit results always show the countries.
- **Modelling approach B:** two top-level nullable blocks on the manifest, not new entry types. Existing consumers of `origin_entries` are untouched; a consumer not taught the dimension shows nothing rather than producing a wrong verdict.
- **Naming.** "Provenance key" keeps its existing meaning (the disclosure-permission grant). Nothing new is called a provenance key.

Out of scope in this cycle (§10): the audit run grid, the dashboard geo chart, the fully-domestic badge, the watcher change describers, vendor posture advertising of design/firmware availability, and a design/firmware entry in `fully_resolved_skus_by_country`.

## 2. Semantics

| concept | representation | null means |
|---|---|---|
| design origin | `design_origin: FacilityBlock \| null` on the manifest | vendor declared nothing for design |
| firmware origin | `firmware_origin: FacilityBlock \| null` on the manifest | vendor declared nothing for firmware |
| entity (design house; firmware author or signer) | `facility_name` of the block | — |
| country | `country_code` of the block | — |
| site | `region_code` of the block | — |
| attestation | `verification_method` of the block, mapped as for a plant | — |

- The facility block is reused verbatim. `FacilityTypeSchema` gains `design_center` and `firmware`.
- Every manifest version is a full statement: the agent always sends both blocks, null when undeclared; a version stores exactly what was sent. Readers show the latest version per (participant, product).
- Null (undeclared) is deliberately distinct from the manufacturing `XX` sentinel (manifest unavailable). Under a buyer flag, null is a gap governed by the buyer's gap policy; without a flag it is an ordinary state.
- For on-network subcomponent suppliers the dimensions come from the supplier's own manifest through the traversal, never copied onto the parent. For off-network suppliers the subcomponent reference carries the known countries or null.

## 3. Protocol (`packages/protocol/src`) — one MINOR mint

- `provenance/origin-manifest.ts`: `FacilityTypeSchema` + `design_center`, `firmware`. `OriginManifestSchema` and `OriginManifestSubmitSchema` gain `design_origin` and `firmware_origin`, each `FacilityBlockSchema.nullable().optional()`. `SubcomponentReferenceSchema` gains `design_country` and `firmware_country`, `z.string().length(2).nullable().optional()`. `OriginManifestSummarySchema` unchanged.
- `audit/disclosure.ts`: `PUBLIC_ORIGIN_FIELDS` = `country_of_origin`, `design_country_of_origin`, `firmware_country_of_origin`. `OriginDisclosureSchema` gains `design_country_of_origin`, `firmware_country_of_origin` (`z.string().length(2).nullable().optional()`) and the four ladder fields `design_entity`, `design_site`, `firmware_entity`, `firmware_site` (`z.string().nullable().optional()`).
- `provenance/permission-fields.ts`: `CANONICAL_PERMISSION_FIELDS` gains `design_entity`, `design_site`, `firmware_entity`, `firmware_site`. The header comment extends the floor sentence to the three countries. Disjointness refinements on key create/patch need no change.
- `provenance/provenance-config.ts`: `require_domestic_design` and `require_domestic_firmware` (`z.boolean().default(false)`) in `default_requirements`; optional booleans in `category_overrides.requirements` and `ProvenanceQueryOverridesSchema`.
- `provenance/provenance-validation.ts`: `ValidationRequestSchema` gains the two flags as `z.boolean().optional()`. `ValidationSubmissionSchema` gains the two blocks. `ValidationFailureReasonSchema` gains `foreign_design_origin`, `foreign_firmware_origin`. `EvaluationSummarySchema` gains `design_domestic` and `firmware_domestic`, `z.boolean().nullable().optional()`; null = not evaluated.
- `mcp/tools.ts`: `GetOriginManifestOutputSchema` gains `design_origin` and `firmware_origin` as `z.unknown().nullable().optional()` (the existing opaque shape). `ReceiveProvenanceRequirementsInputSchema` gains the two flags as optional booleans.
- `audit/evidence-annotation.ts`: `NodeAttestationSchema` gains `dimension: z.enum(['design','firmware']).nullable().optional()`; null/absent = a manufacturing entry.
- `audit/traversal.ts`: `AuditRunResultSchema` gains `design_geo_rollup` and `firmware_geo_rollup`, `z.array(GeoRollupEntrySchema).optional()`.
- `version.ts`: one MINOR entry in the 3.85.0 shape listing the additive lines; the next-free line moves on.

## 4. haiCore (`apps/core`)

### 4.1 Migration
`ALTER TABLE origin_manifests ADD COLUMN design_origin jsonb NULL, ADD COLUMN firmware_origin jsonb NULL;` Drizzle `db/schema/origin-manifests.ts` mirrors it. No backfill, no index. Applied `db:apply -- status` then `-- migrate` on a lane DB, then dev. Check prod's constraints before any prod migration (0046 drift precedent).

### 4.2 Publish and read (`services/origin-manifest-service.ts`)
`createOrUpdateManifest` copies both blocks onto the new version row. The manifest mapper returns them on every full read (`getManifest`, `getManifestByVersion`, grouped/list/search views that return full manifests). Summaries do not carry them.

### 4.3 Disclosure derivation
The two builders of `OriginDisclosure` from a manifest — `services/audit-mcp-adapter.ts` (`mapToStrategyEnvelope`) and `services/source-audit-service.ts` — set the two countries from the blocks (null when a block is null) and the four ladder fields from `facility_name` and `region_code`. The `XX` sentinel stays manufacturing-only. `disclosure-resolver-service.ts` and `disclosure-redaction.ts` null the four ladder fields unless the key grants them, exactly as `vendor_name` today; the countries pass through as floor fields.

**Rider fix, same lines:** `source-audit-service.ts` searches for `entry_type === 'primary'`, a value not in the enum, so it always resolves `XX`. It becomes `primary_manufacture` with the first entry as fallback, pinned by a test.

### 4.4 Relay checks (`services/privacy-relay-service.ts`)
After the existing four checks, per flagged dimension: block null → gap (`gaps_present`, `gap_count`; `unresolvable_gap_under_fail_policy` under `fail_on_gap`); block country ≠ `domestic_context` → the dimension's `foreign_*` reason, `all_traced_domestic = false`. Flag off → the summary field is null and nothing else changes. With `require_subcomponent_tracing`, the same rule applies to each reference's `design_country` / `firmware_country`. `origin_data_hash` covers the blocks automatically (whole-submission hash). Both builders of a `ValidationRequest` — `POST /provenance/validate` in `routes/provenance.ts` and the renewal path in `services/certification-renewal-scheduler.ts` — carry the flags from the buyer's requirements or query overrides; absent flags are false.

### 4.5 GoFish
The two flags ride `provenanceFilters` beside `require_domestic_origin` (`gofish-engine.ts`, `gofish-ranking-scorer.ts` read them where the existing flag is read). No posture pre-filter change (§10).

### 4.6 Attestation (`services/evidence-tree-service.ts`)
One attestation per declared block, mapped from the block's `verification_method` through `VERIFICATION_TO_ATTESTATION`, with `dimension` set and `entry_type` null. An undeclared block produces no attestation. `lib/evidence-canonical-model.ts` includes `dimension` in the attestation projection and sort; the report renderers label the pill with the dimension.

### 4.7 Rollups and hashes (`services/audit-run-service.ts`)
`aggregateGeoRollup` takes the origin field to bucket on and runs for the three fields; nodes with null design/firmware country are bucketed `<unknown>` in those rollups. `resolveFullyResolvedCountry` and `fully_resolved_skus_by_country` stay manufacturing-only. Evidence documents built from now on hash the new `geo` fields; stored `document_hash` values are never recomputed (the hash is a record of what was exported, not a cache key). `audit_runs.result_hash` shape unchanged.

### 4.8 Decision record
One D row in `docs/security/security-compliance.md`, D-207's shape, written from the primary source at PR time: design and firmware origin are vendor-declared dimensions beside manufacturing origin; countries on the universal floor with manufacturing country; entity and site on the permission ladder; a buyer's verdict changes only by opting in; no new door; the D-148 disclosure ceiling unchanged. One revision row.

## 5. haiClient (`packages/reference-agent`, `src`)

- `db/duckdb-adapter.ts`: `origin_manifests` gains `design_origin VARCHAR` and `firmware_origin VARCHAR` (JSON text, as `origin_entries`), plus `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for each, idempotent on existing stores.
- `services/manifest-sync.ts`: `CandidateRow` and the submit carry both blocks (parsed from JSON, null when absent). No new republish hash: a block change is manifest content and bumps `manifest_version` locally, the existing trigger.
- `src/mcp/tools/get-origin-manifest.ts`: returns both blocks beside the entries. `receive-provenance-requirements.ts`: accepts the flags; the answer logic is unchanged.
- `src/services/manifest-handler.ts` / client-sdk `ProvenanceRequirementsConfig`: the two flags.
- Seed fixture for the walk (extend `scripts/seed-multilevel-origins.ts` or a sibling): one radio product whose SoC subcomponent is off-network with `origin_country TW`, `design_country CN`, `firmware_country CN`; one vendor product with both blocks declared and `third_party_audit`-verified; one product with both null (control).
- Protocol re-vendor and the version bump are agent1's step on the owner's word. Against an older Central the blocks are stripped silently and the publish succeeds.

## 6. HaiWeb

- `app/account/provenance/manifest-detail-drawer.tsx`: two cards above the entries, "Design origin" and "Firmware origin", rendering entity (`facility_name ?? facility_id`), country, region, verification, the verified badge — the entry card's fields minus depth, batch, date, subcomponents. No card when the block is null; no placeholder.
- `app/account/sonar/watchers/[id]/tree-view.tsx`: design and firmware country chips beside the manufacturing country when present; nothing when null.
- `app/account/provenance-keys/_shared/permission-field-checklist.tsx`: the inline mirror gains the four fields; its sync comment cites the new protocol version.
- Types come from `@haiwave/protocol`; during development the worktree's protocol link points at the lane haiCore build, restored after the merge (the D-207 pattern).
- Copy = sentences and labels, no raw codes; no vendor names.

## 7. Compatibility, security, rollout

- **Wire.** All new fields optional + nullable; zod strips unknown keys. Older Central drops a newer agent's blocks (publish succeeds); older HaiWeb ignores new result fields; newer HaiWeb on an older Central renders no cards. Existing keys with the five-field ladder stay valid. Order: **haiCore → haiClient → HaiWeb**.
- **Verdicts.** Unchanged for every buyer until a flag is set.
- **Security.** §4.8. No new door. Countries inherit the floor's always-visible posture by the owner's ruling; entity and site are key-gated.
- **Gates.** One vitest gate at a time on this machine (`vitest-lock.sh`, quiet machine, no orphaned workers); haiCore gates on a lane DB only; retry-0 is the only green.
- **Counters.** All next-free, none spent; ask agent1 before writing any; report each use by message.

## 8. Testing (red then green per behaviour, one at a time)

- **Protocol.** Submit with and without blocks parses; old-shape disclosure parses; disclosure with the new fields parses; a key with the new ladder fields parses and disjointness still refines; requirements with and without flags parse; validation request with and without flags parses; failure reasons include the two new codes.
- **haiCore (lane DB).** Publish stores both blocks; a later publish without them stores nulls on the next version, history intact; full reads carry them, summaries do not. Disclosure derivation sets the countries and nulls (both builders). Redaction nulls the four ladder fields without a grant and passes them with one; countries pass either way. Relay: flag off → summary null, verdict unchanged (control); flag on + foreign design → `foreign_design_origin`; flag on + null block → gap under `permit_gap`, fail under `fail_on_gap`; firmware mirrors; subcomponent country under tracing. Attestation per declared block with `dimension`; none for null. Three rollups. Migration proven status-then-migrate. The source-audit `primary` fix pinned (RED: a manifest with `primary_manufacture` resolved `XX`).
- **haiClient.** Add-column idempotent on an existing store; sync submits both blocks; MCP tool returns them; posture config parses the flags; seed writes the fixture.
- **HaiWeb.** Cards render with a block and do not render without; tree chips; checklist lists nine fields. Gate: `npm run build` exit read directly; full vitest; no `(retry x`.
- **Owner walk.** The seeded radio on :3002 against the lane Central: drawer shows CN design / CN firmware over TW manufacture; a buyer posture with the design flag on fails the SoC with the named reason, with it off passes as today.

## 9. Delivery

1. haiCore PR on a lane worktree with a lane DB: protocol MINOR + migration + §4 + the D row. Owner merges.
2. agent1: haiClient protocol re-vendor + version bump (its step); then the haiClient PR: §5. Owner merges; rig relaunch is agent1's.
3. HaiWeb PR: §6, protocol link repointed for development and restored after merge.
Each PR: its own SDD run (plan → tasks → per-task review → final review → one fix wave → gate); a spec-only reviewer sees this spec + the diff, nothing else.

## 10. §L (deferred, not forgotten)

- **FUTURE TASK (owner, 2026-09-08): audit display in the console carrying this scope.** A follow-on lane, its own spec: the audit run grid (`tier-gap-grid.tsx`) shows design and firmware country beside manufacturing country per SKU; the dashboard geo chart and partner-compliance weights take a dimension toggle; the fully-domestic badge and `fully_resolved_skus_by_country` become per-dimension; the audit report CSV/HTML/PDF carry the two countries (this cycle only labels the attestation pill, §4.6). Data is available from this cycle's `design_geo_rollup` / `firmware_geo_rollup` and the floor fields; the follow-on is display and rollup semantics only.
- Watcher change describers (`describe-change.ts`, `summarize-change.ts`) naming a design or firmware country change.
- Vendor posture advertising design/firmware availability, and a GoFish posture pre-filter on it.
- Gather skill and Epicor mapping for design/firmware data.
- haiClient `get_origin_manifest` still returns `subcomponent_references: []` (pre-existing; the relay's subcomponent checks see nothing from this agent).
