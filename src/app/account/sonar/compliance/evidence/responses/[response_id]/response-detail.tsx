'use client';

import { useEffect, useState } from 'react';
import type { EvidenceResponse } from '@haiwave/protocol';
import type { CanonicalNode } from '@haiwave/protocol';
import { Pill } from '@/components/pill';

interface CanonicalDoc {
  tree: CanonicalNode[];
  document_hash: string;
  [key: string]: unknown;
}

function CanonicalNodeRow({ node, depth = 0 }: { node: CanonicalNode; depth?: number }) {
  const indent = depth * 16;
  return (
    <div style={{ marginLeft: indent }} className="border-l border-slate/20 pl-3 mb-2">
      <div className="text-xs font-mono text-charcoal">
        {node.vendor_participant_id ?? '—'} · {node.component_ref ?? '—'}
        <span className="ml-2 text-slate">(depth {node.depth_level})</span>
      </div>
      {node.attestations.map((a, i) => (
        <span key={i} className="inline-flex items-center gap-1 mr-2">
          <Pill category="attestation_kind" value={a.attestation_kind} />
          {a.entry_type && <span className="text-xs text-slate">· {a.entry_type}</span>}
        </span>
      ))}
      {node.annotation && (
        <div className="mt-1 text-xs text-cobalt italic">
          Annotation v{node.annotation.version}: {node.annotation.narrative}
          {node.annotation.attachment_hash && (
            <span className="ml-1 font-mono text-slate">(attachment {node.annotation.attachment_hash.slice(0, 8)}…)</span>
          )}
        </div>
      )}
      {node.components.map((c, i) => (
        <CanonicalNodeRow key={i} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ResponseDetail({ response }: { response: EvidenceResponse }) {
  const [doc, setDoc] = useState<CanonicalDoc | null>(null);
  const [hashMatches, setHashMatches] = useState<boolean | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const docBase = `/api/account/sonar/compliance/evidence/responses/${response.response_id}/document`;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${docBase}?format=json`);
        if (res.ok) {
          const raw = res.headers.get('X-Document-Hash-Matches');
          setHashMatches(raw === null ? null : raw === 'true');
          const text = await res.text();
          try {
            setDoc(JSON.parse(text) as CanonicalDoc);
          } catch {
            setDoc(null);
          }
        } else {
          setFetchError(`Document fetch failed (${res.status})`);
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Failed to load document');
      }
    };
    void load();
  }, [docBase]);

  return (
    <div className="p-6 space-y-6">
      {/* Hash divergence warning */}
      {hashMatches === false && (
        <div className="rounded border border-amber bg-amber/10 px-4 py-3 text-sm text-amber-800">
          <strong>Warning:</strong> Regenerated document hash diverges from the logged hash — the source data may have changed since export.
        </div>
      )}
      {hashMatches === null && doc !== null && (
        <div className="rounded border border-slate/20 bg-slate/5 px-4 py-3 text-sm text-slate">
          Hash verification status unavailable.
        </div>
      )}

      {/* Metadata */}
      <section>
        <h1 className="text-xl font-semibold text-charcoal mb-3">Evidence Response</h1>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-slate">Recipient:</span> <span className="font-medium">{response.recipient_name}</span> ({response.recipient_org}) · {response.recipient_type}</div>
          <div><span className="text-slate">Purpose:</span> {response.purpose_narrative ?? '—'}</div>
          <div><span className="text-slate">Scope:</span> {response.scope_shape} · {response.scope_payload.skus.length} SKU(s)</div>
          <div><span className="text-slate">Dispatch:</span> {response.dispatch_decision}</div>
          <div><span className="text-slate">Exported:</span> {new Date(response.exported_at).toLocaleString()} by <span className="font-mono text-xs">{response.exported_by}</span></div>
          <div><span className="text-slate">Source runs:</span> <span className="font-mono text-xs">{response.source_run_ids.join(', ') || '—'}</span></div>
          <div className="col-span-2">
            <span className="text-slate">Document hash:</span>{' '}
            <code className="font-mono text-xs break-all">{response.document_hash}</code>
          </div>
        </div>
      </section>

      {/* Download links */}
      <section>
        <h2 className="text-base font-semibold text-charcoal mb-2">Downloads</h2>
        <div className="flex gap-3">
          {(['pdf', 'html', 'json'] as const).map((fmt) => (
            <a
              key={fmt}
              href={`${docBase}?format=${fmt}`}
              download
              className="px-3 py-1.5 rounded border border-teal text-teal hover:bg-teal hover:text-white text-sm font-medium transition-colors"
            >
              {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      </section>

      {/* Pinned annotations */}
      {response.annotation_refs.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-charcoal mb-2">Pinned Annotations</h2>
          <div className="space-y-2">
            {response.annotation_refs.map((a) => (
              <div key={a.annotation_id} className="rounded border border-slate/15 px-4 py-3 text-sm">
                <div className="text-xs text-slate mb-1">
                  <span className="font-mono">{a.annotation_id}</span> v{a.version} ·{' '}
                  {a.target_component_ref} depth {a.target_depth}
                </div>
                <div className="text-charcoal">{a.narrative}</div>
                {a.attachment_hash && (
                  <div className="text-xs text-slate mt-1 font-mono">attachment: {a.attachment_hash.slice(0, 16)}…</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Document tree re-render */}
      {fetchError && (
        <div className="text-problem text-sm">{fetchError}</div>
      )}
      {doc && doc.tree && doc.tree.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-charcoal mb-2">Evidence Tree (at time of export)</h2>
          <div className="rounded border border-slate/15 p-3">
            {doc.tree.map((node, i) => (
              <CanonicalNodeRow key={i} node={node} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
