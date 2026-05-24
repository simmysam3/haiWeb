'use client';

// Wraps the P8 TreeView (posture/runs/[id]/tree-view.tsx) in a read-only
// configuration.  The TreeView accepts an optional `overlay?: TreeOverlay`.
// When overlay is omitted (or when overlay.onAnnotate is absent), NodeOverlay
// renders attestation pills only — no "Annotate" button appears (the guard in
// NodeOverlay is `isGap && overlay.onAnnotate && node.participant_id && pid`).
// Therefore, omitting `overlay` entirely gives us a fully inert, annotation-
// free tree — no drawer, no annotation calls. §6a scope: DO NOT pass overlay.

import { TreeView } from '@/app/account/sonar/posture/runs/[id]/tree-view';
import type { AuditRunResult } from '@haiwave/protocol';
import type { ObservationNode } from '@haiwave/protocol';

interface Props {
  results: AuditRunResult[];
}

export function EvidenceTreePanel({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-slate/10 bg-slate-50 px-5 py-8 text-center text-sm text-slate italic">
        No results to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <section
          key={result.result_id}
          className="rounded-lg border border-slate/10 bg-white"
        >
          <div className="border-b border-slate/10 px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-charcoal">
              Vendor
            </span>
            <span className="font-mono text-xs text-slate">
              {result.vendor_participant_id.slice(0, 8)}
            </span>
            <span className="text-slate text-[10px]">·</span>
            <span className="text-xs font-semibold text-charcoal">SKU</span>
            {/*
              Protocol §AuditRunResultSchema declares product_id as a plain
              `z.string()`, which permits the empty string — so audit-run
              result rows with a blank product_id (test seeds, or a writer
              that didn't propagate the SKU) used to render as silent
              whitespace. Fall back to a muted "Unknown" so the row still
              communicates SOMETHING about its identity.
            */}
            {result.product_id ? (
              <span className="font-mono text-xs text-slate">{result.product_id}</span>
            ) : (
              <span className="text-xs italic text-slate/70">Unknown</span>
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
            />
          </div>
        </section>
      ))}
    </div>
  );
}
