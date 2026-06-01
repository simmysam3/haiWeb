'use client';

// Wraps the P8 TreeView (sonar/watchers/[id]/tree-view.tsx) in a read-only
// configuration.  The TreeView accepts an optional `overlay?: TreeOverlay`.
// When overlay is omitted (or when overlay.onAnnotate is absent), NodeOverlay
// renders attestation pills only — no "Annotate" button appears (the guard in
// NodeOverlay is `isGap && overlay.onAnnotate && node.participant_id && pid`).
// Therefore, omitting `overlay` entirely gives us a fully inert, annotation-
// free tree — no drawer, no annotation calls. §6a scope: DO NOT pass overlay.
//
// v.1.41 Backlog IA: TreeView relocated with the rest of the Watcher
// Management page (posture/runs/[id] → sonar/watchers/[id]).

import { TreeView } from '@/app/account/sonar/watchers/[id]/tree-view';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import type { ObservationNode } from '@haiwave/protocol';
import { FLAG_COMPONENTS } from '../../_lib/country-flags';

// Sentinel value used by haiCore's geo-rollup builder for components that
// couldn't be resolved to an ISO-2 country (see GeoRollupEntrySchema in
// protocol/src/audit/traversal.ts:138).
const UNKNOWN_ORIGIN = '<unknown>';

function isFullyDomestic(
  geoRollup: GeoRollupEntry[],
  auditorCountry: string,
): boolean {
  if (geoRollup.length === 0) return false;
  // Disqualifies on any unresolved entry or any non-domestic entry. The
  // single `every` over the resolved-domestic check covers both cases —
  // '<unknown>' will never equal an ISO-2 country code.
  return geoRollup.every((e) => e.country_of_origin === auditorCountry);
}

interface Props {
  results: AuditRunResult[];
  // ISO-2 (uppercase) country code of the auditor's HQ. When set + a
  // result's geo_rollup resolves entirely to this country, the SKU header
  // row renders a small flag icon. Absent → no badges.
  auditorCountry?: string;
}

export function EvidenceTreePanel({ results, auditorCountry }: Props) {
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-slate/10 bg-slate-50 px-5 py-8 text-center text-sm text-slate italic">
        No results to display.
      </div>
    );
  }

  const FlagComponent = auditorCountry ? FLAG_COMPONENTS[auditorCountry] : undefined;

  return (
    <div className="space-y-4">
      {results.map((result) => {
        const domestic =
          auditorCountry !== undefined &&
          isFullyDomestic(result.geo_rollup, auditorCountry);

        return (
          <section
            key={result.result_id}
            className="rounded-lg border border-slate/10 bg-white"
          >
            <div className="border-b border-slate/10 px-4 py-2.5 flex items-center gap-2">
              <span className="text-xs font-semibold text-charcoal">
                Vendor
              </span>
              {/* Null vendor_participant_id is the sub-tier identity-withheld
                  case (protocol 3.26.0): the orchestrator's disclosure boundary
                  stored NULL rather than leak the real UUID. The redacted
                  observation tree still carries region-level provenance. */}
              {result.vendor_participant_id ? (
                <span className="font-mono text-xs text-slate">
                  {result.vendor_participant_id.slice(0, 8)}
                </span>
              ) : (
                <span
                  className="text-xs italic text-slate/70"
                  title="Sub-tier vendor identity withheld by the disclosure boundary; only region-level provenance is visible on this row."
                >
                  Identity withheld
                </span>
              )}
              <span className="text-slate text-[10px]">·</span>
              <span className="text-xs font-semibold text-charcoal">SKU</span>
              {/*
                An empty product_id on this row is the legitimate multi-tier
                case: the audit walked past your direct supplier into a
                sub-tier vendor you don't have a relationship with, so you
                don't know their internal SKU for the component they ship.
                Protocol §AuditRunResultSchema declares product_id as plain
                `z.string()` (permits ''), so this is shape-valid; we just
                need to communicate the "why" rather than render blank.
              */}
              {result.product_id ? (
                <span className="font-mono text-xs text-slate">{result.product_id}</span>
              ) : (
                <span
                  className="text-xs italic text-slate/70"
                  title="Sub-tier component: your supplier sources this from a vendor you don't have a direct relationship with, so their internal SKU isn't visible to you."
                >
                  Sub-tier component
                </span>
              )}
              {/* Domestic-origin flag badge — right-aligned. Only renders
                  when (a) we know the auditor's country, (b) we have an
                  SVG flag for that country, and (c) every component in
                  this SKU's geo_rollup resolved to that country (no
                  '<unknown>' entries, no foreign entries). */}
              {domestic && FlagComponent && auditorCountry && (
                <span
                  className="ml-auto inline-flex items-center"
                  title={`All components verified ${auditorCountry}-origin`}
                  aria-label={`All components verified ${auditorCountry}-origin`}
                >
                  <FlagComponent className="h-3.5 w-auto rounded-sm shadow-sm" />
                </span>
              )}
            </div>
            <div className="px-2 py-2">
              {/* EvidenceTreeNode is a structural superset of ObservationNode
                  (adds attestations + current_annotation). The run-result tree
                  is an ObservationNode directly, so no cast is needed here.
                  No overlay is passed → fully read-only, no annotation drawer. */}
              <TreeView
                node={result.tree as ObservationNode}
                // overlay deliberately omitted — read-only mode (§6a)
                complianceBar
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
