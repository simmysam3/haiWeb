'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SmProductInUseSchema, type SmProduct } from '@/lib/sourcing-map/contract';
import { smProductHref } from '@/lib/sourcing-map/routes';
import { smFetch } from '@/lib/sourcing-map/client';
import { Pill } from '@/components/pill';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { SmDialog } from '../../_components/sm-dialog';

/** The Product library tab (spec §7.1): products and "+ New product". Cycle 22.8 adds delete. */
export function LibraryTab({ projectId, initialProducts }: { projectId: string; initialProducts: SmProduct[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [unitLabel, setUnitLabel] = useState('pairs');
  const [assemblyDays, setAssemblyDays] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    const days = Number.parseInt(assemblyDays, 10);
    const out = await smFetch<SmProduct>(`/api/account/sourcing-map/projects/${projectId}/products`, {
      method: 'POST',
      body: {
        name: name.trim(), unit_label: unitLabel.trim(), bom_source: 'workbench', agent_root_sku: null,
        variant_axis: null, assembly_days: Number.isFinite(days) && days >= 0 ? days : 0,
      },
    });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    router.push(smProductHref(projectId, out.data.product_id));
  }

  async function remove(p: SmProduct) {
    setBusy(true);
    setError(null);
    const out = await smFetch(`/api/account/sourcing-map/products/${p.product_id}`, { method: 'DELETE' });
    setBusy(false);
    if (out.ok) {
      setProducts((all) => all.filter((x) => x.product_id !== p.product_id));
      return;
    }
    // a-G5: the 409 is the Doc 4 envelope; SmProductInUseSchema parses its error.details.
    const inUse = SmProductInUseSchema.safeParse((out.body as { error?: { details?: unknown } } | null)?.error?.details);
    setError(
      inUse.success
        ? `${p.name} is used by ${inUse.data.runs.map((r) => r.template_name).join(', ')}. Remove it from those runs first.`
        : out.message,
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="sm-heading text-lg font-semibold">Product library</h2>
        <button type="button" className="sm-btn sm-btn-primary" onClick={() => setCreating(true)}>+ New product</button>
      </div>
      {error && !creating && <p role="alert" className="sm-error mb-3 text-sm">{error}</p>}
      <table className="sm-table">
        <thead>
          <tr><th>Product</th><th>Source</th><th>Variants</th><th>Lines</th><th>Ready</th><th><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.product_id} aria-label={p.name}>
              <td>
                <Link href={smProductHref(projectId, p.product_id)} aria-label={`Open ${p.name}`} className="group inline-flex items-center gap-2">
                  {p.name}
                  <DetailChevron />
                </Link>
              </td>
              <td><Pill themed category="sm_bom_source" value={p.bom_source} /></td>
              <td>{p.variant_axis ? `${p.variant_axis.values.length} · ${p.variant_axis.system ?? p.variant_axis.name}` : '—'}</td>
              <td>{p.line_count}</td>
              <td>
                <Pill themed category="sm_readiness" value={p.readiness.ready ? 'ready' : 'not_ready'} detail={p.readiness.detail} />
              </td>
              <td>
                <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Delete ${p.name}`} disabled={busy} onClick={() => void remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SmDialog
        title="New product"
        open={creating}
        onClose={() => setCreating(false)}
        footer={
          <>
            <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button type="button" className="sm-btn sm-btn-primary" disabled={busy || name.trim() === '' || unitLabel.trim() === ''} onClick={create}>Create product</button>
          </>
        }
      >
        <label className="block text-sm">Product name<input className="sm-input mt-1 w-full" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
        <label className="mt-3 block text-sm">Unit label<input className="sm-input mt-1 w-full" value={unitLabel} maxLength={40} onChange={(e) => setUnitLabel(e.target.value)} /></label>
        <label className="mt-3 block text-sm">Assembly days<input type="number" min={0} max={365} className="sm-input mt-1 w-full" value={assemblyDays} onChange={(e) => setAssemblyDays(e.target.value)} /></label>
        {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
      </SmDialog>
    </div>
  );
}
