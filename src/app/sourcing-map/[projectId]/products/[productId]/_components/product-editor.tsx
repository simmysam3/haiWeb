'use client';
import { useState, type ReactNode } from 'react';
import type { SmProductDetail, VariantAxis } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { SM_HOME, smProjectHref } from '@/lib/sourcing-map/routes';
import { Pill } from '@/components/pill';
import { SmHeader } from '../../../../_components/sm-header';
import { VariantAxisEditor } from './variant-axis-editor';

/** Product editor (spec §7.2). `children` is the BOM body (Tasks 24–25). */
export function ProductEditor({ projectName, detail, children }: { projectName: string; detail: SmProductDetail; children?: ReactNode }) {
  const [product, setProduct] = useState(detail);
  const [name, setName] = useState(detail.name);
  const [unitLabel, setUnitLabel] = useState(detail.unit_label);
  const [assemblyDays, setAssemblyDays] = useState(String(detail.assembly_days));
  const [axis, setAxis] = useState<VariantAxis | null>(detail.variant_axis);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const days = Number.parseInt(assemblyDays, 10);
    const out = await smFetch<SmProductDetail>(`/api/account/sourcing-map/products/${product.product_id}`, {
      method: 'PATCH',
      body: { name: name.trim(), unit_label: unitLabel.trim(), assembly_days: Number.isFinite(days) && days >= 0 ? days : 0, variant_axis: axis },
    });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setProduct((p) => ({ ...p, ...out.data, lines: p.lines }));
  }

  return (
    <>
      <SmHeader crumbs={[{ label: 'Projects', href: SM_HOME }, { label: projectName, href: smProjectHref(product.project_id) }, { label: product.name }]} />
      <section className="p-8">
        <div className="sm-card p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">Product name<input className="sm-input ml-2" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
            <label className="text-sm">Unit label<input className="sm-input ml-2 w-28" value={unitLabel} maxLength={40} onChange={(e) => setUnitLabel(e.target.value)} /></label>
            <label className="text-sm">Assembly days<input type="number" min={0} max={365} className="sm-input ml-2 w-24" value={assemblyDays} onChange={(e) => setAssemblyDays(e.target.value)} /></label>
            <Pill themed category="sm_readiness" value={product.readiness.ready ? 'ready' : 'not_ready'} detail={product.readiness.detail} />
          </div>
          <div className="mt-4">
            <VariantAxisEditor axis={axis} onChange={setAxis} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="sm-btn sm-btn-primary" disabled={busy} onClick={save}>Save product</button>
            {error && <p role="alert" className="sm-error text-sm">{error}</p>}
          </div>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </>
  );
}
