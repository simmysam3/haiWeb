'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence } from '@haiwave/protocol';
import type { SmProduct, SmRunTemplate, SourcingMapScope } from '@/lib/sourcing-map/contract';
import { SM_LIMITS } from '@/lib/sourcing-map/contract';
import { addProduct, applyUploadedDemand, moveProduct, removeProduct, replaceDemand } from '@/lib/sourcing-map/scope-draft';
import { smFetch } from '@/lib/sourcing-map/client';
import { smRunHref } from '@/lib/sourcing-map/routes';
import { UploadWizard } from '@/app/sourcing-map/_components/upload-wizard/upload-wizard';
import { DemandEditor } from './demand-editor';

/** Where focus goes once a press has re-rendered the list (R3): a product's control, or the product picker. */
type FocusTarget = { productId: string; control: 'heading' | 'up' | 'down' | 'remove' } | { productId: null; control: 'add-select' };

function nextFirstDue(scope: SourcingMapScope): string {
  const latest = scope.products.flatMap((p) => p.demand.drops.map((d) => d.due_date)).sort().at(-1);
  return latest ?? new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
}

/** The Configure tray (spec §7.4): "Products & demand" and "Run settings"; Apply saves through the template PATCH. */
export function ConfigureTray({ template, library, onApplied, onClose }: {
  template: SmRunTemplate; library: SmProduct[]; onApplied(t: SmRunTemplate): void; onClose(): void;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<SourcingMapScope>(template.scope);
  const [cadence, setCadence] = useState<Cadence>(template.cadence);
  const [tab, setTab] = useState<'demand' | 'settings'>('demand');
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // R1: a DemandEditor seeds its generator inputs from its schedule once, so an upload that replaces a schedule
  // wholesale bumps that product's revision, and the editor's key, to remount it. Edits never bump it (focus stays).
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const byId = new Map(library.map((p) => [p.product_id, p]));
  const dirty = JSON.stringify({ scope, cadence }) !== JSON.stringify({ scope: template.scope, cadence: template.cadence });
  const available = library.filter((p) => !scope.products.some((x) => x.product_id === p.product_id));

  // WCAG 2.1 AA (R3): opening the tray moves focus into it; returning focus to the opener is the page's (Task 39).
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // A press that removes its own control would drop focus to <body> (R3). The handler names the control that
  // takes focus instead; after the re-render, it is found by its data attributes (ids compared, never put in a selector).
  const trayRef = useRef<HTMLElement | null>(null);
  const focusAfterRender = useRef<FocusTarget | null>(null);
  useEffect(() => {
    const target = focusAfterRender.current;
    const tray = trayRef.current;
    if (!target || !tray) return;
    focusAfterRender.current = null;
    const root = target.productId === null
      ? tray
      : Array.from(tray.querySelectorAll<HTMLElement>('section[data-product-id]')).find((el) => el.dataset.productId === target.productId);
    const control = root?.querySelector<HTMLElement>(`[data-control="${target.control}"]`);
    // A move to the top or bottom disables the pressed button; its sibling in the same section takes focus.
    const sibling = target.control === 'up' ? 'down' : target.control === 'down' ? 'up' : null;
    if (control instanceof HTMLButtonElement && control.disabled && sibling) {
      root?.querySelector<HTMLElement>(`[data-control="${sibling}"]`)?.focus();
      return;
    }
    control?.focus();
  });

  // Every change to the draft comes through here. A refused Apply's message named the draft before the change, so
  // the change clears it (as the upload wizard's edits clear its refusal, Ruling M2).
  function edit(update: (s: SourcingMapScope) => SourcingMapScope) {
    setError(null);
    setScope(update);
  }
  function editCadence(next: Cadence) {
    setError(null);
    setCadence(next);
  }

  function add() {
    const p = byId.get(adding);
    if (p) {
      // Add is disabled again once the picker resets, so the new product's heading takes focus.
      focusAfterRender.current = { productId: p.product_id, control: 'heading' };
      edit((s) => addProduct(s, p, nextFirstDue(s)));
    }
    setAdding('');
  }

  function move(productId: string, dir: -1 | 1) {
    focusAfterRender.current = { productId, control: dir === -1 ? 'up' : 'down' };
    edit((s) => moveProduct(s, productId, dir));
  }

  function remove(productId: string) {
    const i = scope.products.findIndex((p) => p.product_id === productId);
    const neighbour = scope.products[i + 1] ?? scope.products[i - 1];
    focusAfterRender.current = neighbour ? { productId: neighbour.product_id, control: 'remove' } : { productId: null, control: 'add-select' };
    edit((s) => removeProduct(s, productId));
  }

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

  async function duplicate() {
    setBusy(true);
    setError(null);
    const out = await smFetch<{ template: SmRunTemplate }>(`/api/account/sourcing-map/runs/${template.template_id}/duplicate`, { method: 'POST' });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    router.push(smRunHref(scope.project_id, out.data.template.template_id));
  }

  return (
    <aside ref={trayRef} aria-label="Configure run" className="sm-surface fixed right-0 top-0 z-40 h-full w-full max-w-3xl overflow-y-auto border-l border-[var(--sm-line)] p-6">
      <div className="flex items-center justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="sm-heading text-lg font-semibold outline-none">Configure</h2>
        {/* An Apply or Duplicate in flight answers in this tray: a close then would lose a failure's message (R2). */}
        <button type="button" className="sm-btn sm-btn-ghost text-xs" disabled={busy} onClick={onClose}>Close</button>
      </div>
      <div role="tablist" aria-label="Configure" className="mt-4 flex gap-2 border-b border-[var(--sm-line)]">
        <button role="tab" type="button" aria-selected={tab === 'demand'} onClick={() => setTab('demand')} className="px-3 py-2 text-sm">Products &amp; demand</button>
        <button role="tab" type="button" aria-selected={tab === 'settings'} onClick={() => setTab('settings')} className="px-3 py-2 text-sm">Run settings</button>
      </div>
      {tab === 'demand' && (
        <div role="tabpanel" className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Add a product" data-control="add-select" className="sm-input" value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">Add a product from the library…</option>
              {available.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
            </select>
            <button
              type="button"
              className="sm-btn sm-btn-ghost"
              disabled={!adding || scope.products.length >= SM_LIMITS.PRODUCTS_PER_RUN}
              onClick={add}
            >
              Add
            </button>
            <button type="button" className="sm-btn sm-btn-ghost" disabled={scope.products.length === 0} onClick={() => setUploading(true)}>Upload schedule</button>
          </div>
          {scope.products.map((rp, i) => {
            const p = byId.get(rp.product_id);
            const name = p?.name ?? rp.product_id;
            return (
              <section key={rp.product_id} data-product-id={rp.product_id} className="sm-card mt-4 p-4">
                <div className="flex items-center gap-2">
                  <h3 tabIndex={-1} data-control="heading" className="sm-heading mr-auto font-semibold outline-none">{name}</h3>
                  <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Move ${name} up`} data-control="up" disabled={i === 0} onClick={() => move(rp.product_id, -1)}>Up</button>
                  <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Move ${name} down`} data-control="down" disabled={i === scope.products.length - 1} onClick={() => move(rp.product_id, 1)}>Down</button>
                  <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Remove ${name}`} data-control="remove" onClick={() => remove(rp.product_id)}>Remove</button>
                </div>
                {p && (
                  <DemandEditor
                    key={`${rp.product_id}:${revisions[rp.product_id] ?? 0}`}
                    product={p}
                    demand={rp.demand}
                    onChange={(d) => edit((s) => replaceDemand(s, rp.product_id, d))}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
      {tab === 'settings' && (
        <div role="tabpanel" className="mt-4 grid max-w-md gap-4 text-sm">
          <label>Depth cap
            <input
              aria-label="Depth cap" type="number" min={SM_LIMITS.DEPTH_CAP_MIN} max={SM_LIMITS.DEPTH_CAP_MAX} className="sm-input ml-2 w-20"
              value={scope.depth_cap}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isInteger(n) && n >= SM_LIMITS.DEPTH_CAP_MIN && n <= SM_LIMITS.DEPTH_CAP_MAX) edit((s) => ({ ...s, depth_cap: n }));
              }}
            />
          </label>
          <label>Seat weekly capacity (units per week, optional)
            <input
              aria-label="Seat weekly capacity (units per week, optional)" type="number" min={1} className="sm-input ml-2 w-32"
              value={scope.seat_weekly_capacity ?? ''}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                edit((s) => ({ ...s, seat_weekly_capacity: Number.isInteger(n) && n > 0 ? n : null }));
              }}
            />
          </label>
          <label>Cadence
            <select
              aria-label="Cadence" className="sm-input ml-2"
              value={cadence.kind === 'manual_only' || cadence.kind === 'weekly' || cadence.kind === 'monthly' ? cadence.kind : 'current'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'manual_only') editCadence({ kind: 'manual_only' });
                if (v === 'weekly') editCadence({ kind: 'weekly', day_of_week: 'mon', time_of_day: '06:00' });
                if (v === 'monthly') editCadence({ kind: 'monthly', day_of_month: 1, time_of_day: '06:00' });
              }}
            >
              <option value="manual_only">Manual only</option>
              <option value="weekly">Weekly (Mondays, 06:00 UTC)</option>
              <option value="monthly">Monthly (the 1st, 06:00 UTC)</option>
              {!['manual_only', 'weekly', 'monthly'].includes(cadence.kind) && <option value="current">{`Current: ${cadence.kind}`}</option>}
            </select>
          </label>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="sm-btn sm-btn-ghost" disabled={busy} onClick={duplicate}>Duplicate run</button>
        <button type="button" className="sm-btn sm-btn-primary" disabled={!dirty || busy} onClick={apply}>Apply</button>
        {error && <p role="alert" className="sm-error text-sm">{error}</p>}
      </div>
      {uploading && (
        <UploadWizard
          kind="demand"
          products={scope.products.map((rp) => ({
            product_id: rp.product_id,
            name: byId.get(rp.product_id)?.name ?? rp.product_id,
            variant_values: byId.get(rp.product_id)?.variant_axis?.values ?? [],
          }))}
          onApply={(build) => {
            const next = applyUploadedDemand(scope, build, library);
            // applyUploadedDemand returns an untouched product as the same object.
            const replaced = next.products.filter((p, i) => p !== scope.products[i]).map((p) => p.product_id);
            edit(() => next);
            setRevisions((r) => ({ ...r, ...Object.fromEntries(replaced.map((id) => [id, (r[id] ?? 0) + 1])) }));
            setUploading(false);
          }}
          onClose={() => setUploading(false)}
        />
      )}
    </aside>
  );
}
