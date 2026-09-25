'use client';
import { useEffect, useRef, useState } from 'react';
import type { ClassSuggestion, SmBomLine, SmProductDetail, VariantAxis } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { lineProblems, newDraftLine, toDraft, toInput, type BomDraftLine } from '@/lib/sourcing-map/bom-draft';
import { SmButton } from '../../../../_components/sm-button';
import { ClassPicker } from './class-picker';
import { SizeTable } from './size-table';
import { PinEditor } from './pin-editor';

/**
 * BOM grid (spec §7.2). It seeds its draft from `initialLines` once; the body keys it by a revision that only a
 * wholesale replacement (an upload commit, an import) bumps (LW-b), and renders Upload BOM and Import from agent
 * outside it, so those openers outlive the remount.
 */
export function BomGrid({ productId, axis, initialLines, classes, onSaved, suggestions = {}, locked = false }: {
  productId: string; axis: VariantAxis | null; initialLines: SmBomLine[]; classes: SmProductDetail['classes'];
  onSaved(d: SmProductDetail): void; suggestions?: Record<string, ClassSuggestion>;
  /** stale-lock: these lines are older than the server's, so the grid is read-only and Save BOM is inert
   * (aria-disabled, keeping focus: LW-a). */
  locked?: boolean;
}) {
  const [lines, setLines] = useState<BomDraftLine[]>(() => toDraft(initialLines, classes));
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Remove line moves keyboard focus before the row goes (WCAG 2.4.3): to the next row's Component, else Add line.
  const componentRefs = useRef(new Map<string, HTMLInputElement>());
  // A line's class search, where its pin editor hands focus when Add supplier is disabled (L176).
  const classSearchRefs = useRef(new Map<string, HTMLInputElement>());
  const addLineRef = useRef<HTMLButtonElement>(null);

  // d-G9: a stored pin carries only the supplier's id. Each distinct supplier's name is looked up once, from the
  // profile route (src/app/api/account/company/[id]/profile/route.ts:9-11; vendor.ts:8-13). It answers for a pin on a
  // line with no class and for a supplier that has since disconnected. The lookup follows the saved lines (LW-b): it
  // is keyed on the set of pinned supplier ids, so a save that pins a new supplier (whose rows remount under new line
  // ids, taking the pin editor's own names with them) asks for that supplier only, and the answers merge into `names`.
  // No `live` flag: an answer names a supplier, not a state of this product, so a late one is still right.
  const pinnedIds = [...new Set(initialLines.flatMap((l) => l.pins.map((p) => p.supplier_participant_id)))].sort().join(',');
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const ids = pinnedIds === '' ? [] : pinnedIds.split(',').filter((id) => !asked.current.has(id));
    if (ids.length === 0) return;
    for (const id of ids) asked.current.add(id);
    void Promise.all(
      ids.map(async (id) => {
        const out = await smFetch<{ legal_name?: string }>(`/api/account/company/${id}/profile`);
        return [id, out.ok ? out.data.legal_name ?? null : null] as const;
      }),
    ).then((pairs) => setNames((n) => ({ ...n, ...Object.fromEntries(pairs) })));
  }, [pinnedIds]);

  function update(key: string, patch: Partial<BomDraftLine>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function save() {
    // a-G4: a refused save must not leave an earlier save's failure showing beside the current problems.
    setError(null);
    const found = lines.flatMap((l, i) => lineProblems(l, axis).map((p) => `Line ${i + 1}: ${p}`));
    setProblems(found);
    if (found.length > 0) return;
    setBusy(true);
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
        <SmButton ref={addLineRef} className="sm-btn sm-btn-ghost" aria-disabled={locked} onClick={() => setLines((all) => [...all, newDraftLine()])}>Add line</SmButton>
        <SmButton className="sm-btn sm-btn-primary" busy={busy} aria-disabled={locked} onClick={save}>Save BOM</SmButton>
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
                    <input
                      ref={(el) => {
                        if (el) componentRefs.current.set(l.key, el);
                        else componentRefs.current.delete(l.key);
                      }}
                      aria-label={`Component for line ${n}`} className="sm-input w-48" readOnly={locked} value={l.component_label} maxLength={200} onChange={(e) => update(l.key, { component_label: e.target.value })} />
                    {l.note && <p className="sm-warn mt-1 text-xs">{l.note}</p>}
                  </td>
                  <td><input aria-label={`Part ref for line ${n}`} className="sm-input w-28" readOnly={locked} value={l.part_ref ?? ''} maxLength={200} onChange={(e) => update(l.key, { part_ref: e.target.value || null })} /></td>
                  <td>
                    <ClassPicker
                      label={l.component_label || `line ${n}`}
                      value={l.class_id ? { class_id: l.class_id, label: l.class_label ?? l.class_id } : null}
                      suggestion={suggestions[l.key] ?? null}
                      onChange={(c) => update(l.key, { class_id: c.class_id, class_label: c.label })}
                      inputRef={(el) => {
                        if (el) classSearchRefs.current.set(l.key, el);
                        else classSearchRefs.current.delete(l.key);
                      }}
                      locked={locked}
                    />
                  </td>
                  <td><input type="number" step="any" min={0} aria-label={`Qty per unit for line ${n}`} className="sm-input w-20" readOnly={locked} value={l.qty_per_unit} onChange={(e) => update(l.key, { qty_per_unit: Number.parseFloat(e.target.value) })} /></td>
                  <td><input aria-label={`UoM for line ${n}`} className="sm-input w-16" readOnly={locked} value={l.uom} maxLength={20} onChange={(e) => update(l.key, { uom: e.target.value })} /></td>
                  <td>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox" checked={l.variant_bound} disabled={!axis} aria-disabled={locked || undefined}
                        onChange={(e) => {
                          // readOnly does not hold a checkbox; the lock refuses the change, and React restores `checked`.
                          if (locked) return;
                          update(l.key, { variant_bound: e.target.checked, qty_by_variant: e.target.checked ? l.qty_by_variant : null });
                        }}
                      />
                      Size-bound
                    </label>
                    {l.variant_bound && axis && (
                      <SizeTable axis={axis} qtyPerUnit={l.qty_per_unit} value={l.qty_by_variant} locked={locked} onChange={(v) => update(l.key, { qty_by_variant: v })} />
                    )}
                  </td>
                  <td>
                    {/* Keyed by class: an editor opened for the old class must not offer that class's publishers. */}
                    <PinEditor
                      key={l.class_id ?? ''}
                      classId={l.class_id}
                      pins={l.pins}
                      names={names}
                      onChange={(pins) => update(l.key, { pins })}
                      fallbackFocus={() => classSearchRefs.current.get(l.key)?.focus()}
                      locked={locked}
                    />
                  </td>
                  <td>
                    <SmButton
                      className="sm-link text-xs"
                      aria-label={`Remove line ${n}`}
                      aria-disabled={locked}
                      onClick={() => {
                        const next = lines[i + 1];
                        (next ? componentRefs.current.get(next.key) : addLineRef.current)?.focus();
                        setLines((all) => all.filter((x) => x.key !== l.key));
                      }}
                    >
                      Remove
                    </SmButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {problems.length > 0 && (
        <ul role="alert" className="sm-error mt-3 list-disc pl-5 text-sm">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
    </div>
  );
}
