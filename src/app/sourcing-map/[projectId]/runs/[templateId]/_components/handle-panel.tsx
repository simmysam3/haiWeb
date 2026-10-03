'use client';
import { useEffect, useRef } from 'react';
import type { SmSubtierNode, SmTraceRole } from '@/lib/sourcing-map/types';
import { NOT_TRACED_NOTE } from './option-card';
import { bandVar, bandWord, EM_DASH } from '@/lib/sourcing-map/map/selectors';

/**
 * The details panel's sub-tier form (spec §12.4): what the seat may know of a node under its suppliers — alias,
 * tier, country, class at its floored level, band, trace role — and which of its options it also supplies. Never
 * an identity, a quantity or a name (requirements §7.3). Focus moves to the heading on open (ruling R1); returning
 * it to the handle on close is the workspace's job. Escape from inside the panel closes it, as Close does.
 */
export function HandlePanel({ node, origin, candidateNames, trace, onClose }: {
  node: SmSubtierNode & { under: string[] };
  origin: string | null;
  candidateNames: Record<string, string>;
  trace: { role: SmTraceRole; binds_for: number } | null;
  onClose(): void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const others = node.under.filter((k) => k !== origin).map((k) => candidateNames[k] ?? k);
  return (
    <aside aria-label={`Details for supplier ${node.alias}`} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} className="sm-surface sticky top-0 z-30 max-h-screen w-full max-w-xl shrink-0 self-start overflow-y-auto border-l border-[var(--sm-line)] p-6 text-sm">
      <div className="flex items-center justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="sm-heading text-lg font-semibold">{`Supplier ${node.alias} · tier ${node.tier}`}</h2>
        <button type="button" aria-label="Close handle details" className="sm-btn sm-btn-ghost text-xs" onClick={onClose}>Close</button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <dt className="sm-muted">Tier</dt><dd>{node.tier}</dd>
        <dt className="sm-muted">Country</dt><dd>{node.country ?? EM_DASH}</dd>
        <dt className="sm-muted">Class</dt><dd>{node.class ? `${node.class.label} · shown at level ${node.class.level} of ${node.class.of_levels}` : EM_DASH}</dd>
        {node.band !== null && (
          <>
            <dt className="sm-muted">Band</dt>
            <dd className="flex items-center gap-2">
              <span role="img" aria-label={bandWord(node.band)} title={bandWord(node.band)} className="inline-block h-2 w-2 rounded-full" style={{ background: bandVar(node.band) }} />
              <span>{bandWord(node.band)}</span>
            </dd>
          </>
        )}
        {trace && (
          <>
            <dt className="sm-muted">Trace</dt>
            <dd>{trace.binds_for > 1 ? `${trace.role} · Binding for ${trace.binds_for} options` : trace.role}</dd>
          </>
        )}
      </dl>
      {node.not_traced_below === true && <p className="sm-warn mt-4">{NOT_TRACED_NOTE}</p>}
      {others.length > 0 && <p className="mt-4">{`Also supplies: ${others.join(', ')}`}</p>}
      <p className="sm-muted mt-6 text-xs">Identity, quantities and names below tier 1 are not disclosed.</p>
    </aside>
  );
}
