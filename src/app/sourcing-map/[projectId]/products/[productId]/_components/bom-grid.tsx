'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { ClassSuggestion, SmBomLine, SmProductDetail, VariantAxis } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { newDraftLine, toDraft, toInput, type BomDraftLine } from '@/lib/sourcing-map/bom-draft';
import { ClassPicker } from './class-picker';
import { SizeTable } from './size-table';
import { PinEditor } from './pin-editor';

/** BOM grid (spec §7.2). `toolbar` carries Upload BOM and Import from agent (Tasks 25, 32). */
export function BomGrid({ productId, axis, initialLines, classes, onSaved, toolbar, suggestions = {} }: {
  productId: string; axis: VariantAxis | null; initialLines: SmBomLine[]; classes: SmProductDetail['classes'];
  onSaved(d: SmProductDetail): void; toolbar?: ReactNode; suggestions?: Record<string, ClassSuggestion>;
}) {
  const [lines, setLines] = useState<BomDraftLine[]>(() => toDraft(initialLines, classes));
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // d-G9: a stored pin carries only the supplier's id. Each distinct supplier's name is looked up once, when the
  // editor opens, from the profile route (src/app/api/account/company/[id]/profile/route.ts:9-11; vendor.ts:8-13).
  // It answers for a pin on a line with no class and for a supplier that has since disconnected.
  useEffect(() => {
    const ids = [...new Set(initialLines.flatMap((l) => l.pins.map((p) => p.supplier_participant_id)))];
    if (ids.length === 0) return;
    let live = true;
    void Promise.all(
      ids.map(async (id) => {
        const out = await smFetch<{ legal_name?: string }>(`/api/account/company/${id}/profile`);
        return [id, out.ok ? out.data.legal_name ?? null : null] as const;
      }),
    ).then((pairs) => {
      if (live) setNames(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
  }, [initialLines]);

  function update(key: string, patch: Partial<BomDraftLine>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const out = await smFetch<SmProductDetail>(`/api/account/sourcing-map/products/${productId}/bom-lines`, { method: 'PUT', body: { lines: toInput(lines) } });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setLines(toDraft(out.data.lines, out.data.classes));
    onSaved(out.data);
  }

  return (
    <div className="sm-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="sm-heading mr-auto text-lg font-semibold">Bill of materials</h2>
        <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setLines((all) => [...all, newDraftLine()])}>Add line</button>
        {toolbar}
        <button type="button" className="sm-btn sm-btn-primary" disabled={busy} onClick={save}>Save BOM</button>
      </div>
      <div className="overflow-x-auto">
        <table className="sm-table">
          <thead>
            <tr><th>Component</th><th>Part ref</th><th>Class</th><th>Qty per unit</th><th>UoM</th><th>Size-bound</th><th>Suppliers</th><th><span className="sr-only">Remove</span></th></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const n = i + 1;
              return (
                <tr key={l.key} aria-label={`Line ${n}: ${l.component_label || 'new line'}`}>
                  <td>
                    <input aria-label={`Component for line ${n}`} className="sm-input w-48" value={l.component_label} maxLength={200} onChange={(e) => update(l.key, { component_label: e.target.value })} />
                    {l.note && <p className="sm-warn mt-1 text-xs">{l.note}</p>}
                  </td>
                  <td><input aria-label={`Part ref for line ${n}`} className="sm-input w-28" value={l.part_ref ?? ''} maxLength={200} onChange={(e) => update(l.key, { part_ref: e.target.value || null })} /></td>
                  <td>
                    <ClassPicker
                      label={l.component_label || `line ${n}`}
                      value={l.class_id ? { class_id: l.class_id, label: l.class_label ?? l.class_id } : null}
                      suggestion={suggestions[l.key] ?? null}
                      onChange={(c) => update(l.key, { class_id: c.class_id, class_label: c.label })}
                    />
                  </td>
                  <td><input type="number" step="any" min={0} aria-label={`Qty per unit for line ${n}`} className="sm-input w-20" value={l.qty_per_unit} onChange={(e) => update(l.key, { qty_per_unit: Number.parseFloat(e.target.value) })} /></td>
                  <td><input aria-label={`UoM for line ${n}`} className="sm-input w-16" value={l.uom} maxLength={20} onChange={(e) => update(l.key, { uom: e.target.value })} /></td>
                  <td>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={l.variant_bound} disabled={!axis} onChange={(e) => update(l.key, { variant_bound: e.target.checked, qty_by_variant: e.target.checked ? l.qty_by_variant : null })} />
                      Size-bound
                    </label>
                    {l.variant_bound && axis && (
                      <SizeTable axis={axis} qtyPerUnit={l.qty_per_unit} value={l.qty_by_variant} onChange={(v) => update(l.key, { qty_by_variant: v })} />
                    )}
                  </td>
                  <td><PinEditor classId={l.class_id} pins={l.pins} names={names} onChange={(pins) => update(l.key, { pins })} /></td>
                  <td><button type="button" className="sm-link text-xs" aria-label={`Remove line ${n}`} onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
    </div>
  );
}
