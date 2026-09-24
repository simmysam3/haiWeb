'use client';
import { useEffect, useRef, useState } from 'react';
import type { Cadence } from '@haiwave/protocol';
import type { SmProduct, SmRunTemplate, SourcingMapScope } from '@/lib/sourcing-map/contract';
import { SM_LIMITS } from '@/lib/sourcing-map/contract';
import { addProduct, moveProduct, removeProduct, replaceDemand } from '@/lib/sourcing-map/scope-draft';
import { smFetch } from '@/lib/sourcing-map/client';
import { DemandEditor } from './demand-editor';

function nextFirstDue(scope: SourcingMapScope): string {
  const latest = scope.products.flatMap((p) => p.demand.drops.map((d) => d.due_date)).sort().at(-1);
  return latest ?? new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
}

/** The Configure tray (spec §7.4): "Products & demand" and "Run settings"; Apply saves through the template PATCH. */
export function ConfigureTray({ template, library, onApplied, onClose }: {
  template: SmRunTemplate; library: SmProduct[]; onApplied(t: SmRunTemplate): void; onClose(): void;
}) {
  const [scope, setScope] = useState<SourcingMapScope>(template.scope);
  const [cadence] = useState<Cadence>(template.cadence);
  const [tab, setTab] = useState<'demand' | 'settings'>('demand');
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const byId = new Map(library.map((p) => [p.product_id, p]));
  const dirty = JSON.stringify({ scope, cadence }) !== JSON.stringify({ scope: template.scope, cadence: template.cadence });
  const available = library.filter((p) => !scope.products.some((x) => x.product_id === p.product_id));

  // WCAG 2.1 AA (R3): opening the tray moves focus into it; returning focus to the opener is the page's (Task 39).
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function apply() {
    setBusy(true);
    setError(null);
    const out = await smFetch<{ template: SmRunTemplate }>(`/api/account/sourcing-map/runs/${template.template_id}`, { method: 'PATCH', body: { scope, cadence } });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    onApplied(out.data.template);
  }

  return (
    <aside aria-label="Configure run" className="sm-surface fixed right-0 top-0 z-40 h-full w-full max-w-3xl overflow-y-auto border-l border-[var(--sm-line)] p-6">
      <div className="flex items-center justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="sm-heading text-lg font-semibold outline-none">Configure</h2>
        <button type="button" className="sm-btn sm-btn-ghost text-xs" onClick={onClose}>Close</button>
      </div>
      <div role="tablist" aria-label="Configure" className="mt-4 flex gap-2 border-b border-[var(--sm-line)]">
        <button role="tab" type="button" aria-selected={tab === 'demand'} onClick={() => setTab('demand')} className="px-3 py-2 text-sm">Products &amp; demand</button>
        <button role="tab" type="button" aria-selected={tab === 'settings'} onClick={() => setTab('settings')} className="px-3 py-2 text-sm">Run settings</button>
      </div>
      {tab === 'demand' && (
        <div role="tabpanel" className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Add a product" className="sm-input" value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">Add a product from the library…</option>
              {available.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
            </select>
            <button
              type="button"
              className="sm-btn sm-btn-ghost"
              disabled={!adding || scope.products.length >= SM_LIMITS.PRODUCTS_PER_RUN}
              onClick={() => {
                const p = byId.get(adding);
                if (p) setScope((s) => addProduct(s, p, nextFirstDue(s)));
                setAdding('');
              }}
            >
              Add
            </button>
          </div>
          {scope.products.map((rp, i) => {
            const p = byId.get(rp.product_id);
            const name = p?.name ?? rp.product_id;
            return (
              <section key={rp.product_id} className="sm-card mt-4 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="sm-heading mr-auto font-semibold">{name}</h3>
                  <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => setScope((s) => moveProduct(s, rp.product_id, -1))}>Up</button>
                  <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Move ${name} down`} disabled={i === scope.products.length - 1} onClick={() => setScope((s) => moveProduct(s, rp.product_id, 1))}>Down</button>
                  <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Remove ${name}`} onClick={() => setScope((s) => removeProduct(s, rp.product_id))}>Remove</button>
                </div>
                {p && <DemandEditor product={p} demand={rp.demand} onChange={(d) => setScope((s) => replaceDemand(s, rp.product_id, d))} />}
              </section>
            );
          })}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="sm-btn sm-btn-primary" disabled={!dirty || busy} onClick={apply}>Apply</button>
        {error && <p role="alert" className="sm-error text-sm">{error}</p>}
      </div>
    </aside>
  );
}
