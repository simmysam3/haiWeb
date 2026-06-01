'use client';

import { useEffect, useState } from 'react';
import type { OriginManifest, OriginEntry, SubcomponentReference } from '@haiwave/protocol';
import { Drawer } from '@/components/drawer';
import { IdChip } from '@/components/id-chip';
import { StatusBadge } from '@/components/status-badge';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; manifest: OriginManifest }
  | { kind: 'error'; message: string };

interface ManifestDetailDrawerProps {
  productId: string | null;
  productName: string | null;
  onClose: () => void;
}

export function ManifestDetailDrawer({ productId, productName, onClose }: ManifestDetailDrawerProps) {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!productId) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    fetch(`/api/account/provenance/manifests/${encodeURIComponent(productId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${res.status}: ${body.slice(0, 200)}`);
        }
        return res.json() as Promise<OriginManifest>;
      })
      .then((manifest) => {
        if (!cancelled) setState({ kind: 'ok', manifest });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ kind: 'error', message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <Drawer
      open={productId !== null}
      onClose={onClose}
      title={productName ?? 'Origin manifest'}
      width="max-w-2xl"
    >
      {state.kind === 'loading' && (
        <p className="text-sm text-slate">Loading manifest…</p>
      )}
      {state.kind === 'error' && (
        <p className="text-sm text-problem">Couldn&apos;t load manifest. {state.message}</p>
      )}
      {state.kind === 'ok' && <ManifestBody manifest={state.manifest} />}
    </Drawer>
  );
}

function ManifestBody({ manifest }: { manifest: OriginManifest }) {
  return (
    <div className="space-y-6">
      <section>
        <dl className="grid grid-cols-[max-content,1fr] items-baseline gap-x-4 gap-y-2 text-sm">
          <dt className="text-[11px] font-bold uppercase tracking-widest text-slate">Product</dt>
          <dd className="text-charcoal">{manifest.product_name}</dd>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-slate">External product ID (SKU)</dt>
          <dd className="font-mono text-xs text-charcoal">{manifest.external_product_id}</dd>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-slate">Manifest ID</dt>
          <dd><IdChip id={manifest.origin_manifest_id} /></dd>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-slate">Version</dt>
          <dd className="text-charcoal">v{manifest.manifest_version}</dd>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-slate">Domestic context</dt>
          <dd className="text-charcoal">{manifest.domestic_context}</dd>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-slate">Updated</dt>
          <dd className="text-charcoal">{new Date(manifest.updated_at).toLocaleString()}</dd>
        </dl>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-navy mb-3">
          Origin entries ({manifest.origin_entries.length})
        </h3>
        <div className="space-y-3">
          {manifest.origin_entries.map((entry) => (
            <OriginEntryCard key={entry.entry_id} entry={entry} />
          ))}
        </div>
      </section>
    </div>
  );
}

function OriginEntryCard({ entry }: { entry: OriginEntry }) {
  const [open, setOpen] = useState(true);
  const subcount = entry.subcomponent_origins.length;

  return (
    <div className="rounded-md border border-slate/15 bg-light-gray/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-navy capitalize">
            {entry.entry_type.replace(/_/g, ' ')}
          </p>
          <p className="mt-0.5 text-xs text-slate">
            Depth: {entry.provenance_depth}
            {entry.facility.country_code && ` • ${entry.facility.country_code}`}
          </p>
        </div>
        <StatusBadge status={entry.facility.verified ? 'verified' : 'unverified'} />
      </div>

      <dl className="mt-3 grid grid-cols-[max-content,1fr] items-baseline gap-x-4 gap-y-1 text-xs">
        <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Facility</dt>
        <dd className="text-charcoal">
          {entry.facility.facility_name ?? entry.facility.facility_id}
          <span className="ml-1 text-slate">({entry.facility.facility_type})</span>
        </dd>
        {entry.facility.region_code && (
          <>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Region</dt>
            <dd className="text-charcoal">{entry.facility.region_code}</dd>
          </>
        )}
        <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Verification</dt>
        <dd className="text-charcoal capitalize">
          {entry.facility.verification_method.replace(/_/g, ' ')}
          {entry.facility.last_verified_at && (
            <span className="ml-1 text-slate">
              ({new Date(entry.facility.last_verified_at).toLocaleDateString()})
            </span>
          )}
        </dd>
        {entry.batch && (
          <>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Batch</dt>
            <dd className="font-mono text-charcoal">
              {entry.batch.batch_number}
              {entry.batch.quantity_in_batch != null && (
                <span className="ml-1 text-slate">qty {entry.batch.quantity_in_batch}</span>
              )}
            </dd>
          </>
        )}
        {entry.manufacturing_date && (
          <>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate">Manufactured</dt>
            <dd className="text-charcoal">
              {entry.manufacturing_date.start_date}
              {entry.manufacturing_date.end_date && ` – ${entry.manufacturing_date.end_date}`}
              <span className="ml-1 text-slate">({entry.manufacturing_date.precision})</span>
            </dd>
          </>
        )}
      </dl>

      {subcount > 0 && (
        <div className="mt-3 border-t border-slate/15 pt-3">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs font-medium text-teal hover:text-navy transition-colors"
          >
            <span>{open ? '▾' : '▸'}</span>
            Subcomponent origins ({subcount})
          </button>
          {open && (
            <ul className="mt-2 space-y-2">
              {entry.subcomponent_origins.map((sub, i) => (
                <li
                  key={`${sub.subcomponent_type}-${i}`}
                  className="rounded border border-slate/15 bg-white px-3 py-2 text-xs"
                >
                  <SubcomponentRow sub={sub} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SubcomponentRow({ sub }: { sub: SubcomponentReference }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-charcoal">{sub.subcomponent_type}</p>
        {sub.subcomponent_description && (
          <p className="mt-0.5 text-slate">{sub.subcomponent_description}</p>
        )}
        <p className="mt-1 text-slate">
          Origin: {sub.origin_country ?? '—'} • Depth: {sub.provenance_depth}
        </p>
      </div>
      <div className="text-right text-slate">
        {sub.origin_manifest_ref && (
          <span className="block font-mono">ref {sub.origin_manifest_ref.slice(0, 8)}…</span>
        )}
        {sub.supplier_participant_id && (
          <span className="block font-mono">supplier {sub.supplier_participant_id.slice(0, 8)}…</span>
        )}
      </div>
    </div>
  );
}
