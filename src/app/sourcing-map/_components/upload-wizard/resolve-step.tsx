// src/app/sourcing-map/_components/upload-wizard/resolve-step.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  ClassSuggestion, ClassSuggestionsResponse, ClassSuppliersResponse, SupplierMatch, SupplierMatchesResponse,
} from '@/lib/sourcing-map/contract';
import type { UploadedBomLine } from '@/lib/sourcing-map/upload/bom-rows';
import { resolveLine, type ResolvedLine } from '@/lib/sourcing-map/upload/resolve';
import { smFetch } from '@/lib/sourcing-map/client';
import { Pill } from '@/components/pill';
import { ClassPicker } from '@/app/sourcing-map/[projectId]/products/[productId]/_components/class-picker';

type Picked = { class_id: string; label: string };

/** The picked class whose supplier SKUs a line waits on: a usable match, and no SKU given in the file. */
function skuClassFor(l: UploadedBomLine, picked: Record<string, Picked>, matches: Record<string, SupplierMatch>): string | null {
  const p = picked[l.key];
  const m = l.supplier_name ? matches[l.supplier_name] : undefined;
  return p && m?.match && m.match.confidence !== 'low' && !l.supplier_sku ? p.class_id : null;
}

/** Spec §7.3 step 3. Only component labels are sent for suggestions ([D-j]); part references never. */
export function ResolveStep({ lines, onBack, onContinue }: {
  lines: UploadedBomLine[]; onBack(): void; onContinue(resolved: ResolvedLine[]): void;
}) {
  const [suggestions, setSuggestions] = useState<Record<string, ClassSuggestion[]>>({});
  const [retrieval, setRetrieval] = useState<'hybrid' | 'text_only' | null>(null);
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [matches, setMatches] = useState<Record<string, SupplierMatch>>({});
  const [catalog, setCatalog] = useState<Record<string, ClassSuppliersResponse['suppliers']>>({});
  const [chosenSku, setChosenSku] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // resolveLine reads a missing match as "not on the network", so until the names are looked up (or after the
  // lookup fails) no supplier verdict is shown and nothing continues to be saved (AC 7).
  const [supplierLookup, setSupplierLookup] = useState<'pending' | 'done' | 'failed'>(() =>
    lines.some((l) => l.supplier_name) ? 'pending' : 'done',
  );
  const requested = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    void (async () => {
      const labels = [...new Set(lines.map((l) => l.component_label))];
      const sug = await smFetch<ClassSuggestionsResponse>('/api/account/sourcing-map/class-suggestions', {
        method: 'POST',
        body: { lines: labels.map((label) => ({ label })) },
      });
      if (!live) return;
      if (sug.ok) {
        setRetrieval(sug.data.retrieval);
        setSuggestions(Object.fromEntries(labels.map((label, i) => [label, sug.data.lines[i]?.suggestions ?? []])));
      } else {
        setError(sug.message);
      }
      const names = [...new Set(lines.flatMap((l) => (l.supplier_name ? [l.supplier_name] : [])))];
      if (names.length === 0) return;
      const m = await smFetch<SupplierMatchesResponse>('/api/account/sourcing-map/supplier-matches', { method: 'POST', body: { names } });
      if (!live) return;
      if (m.ok) {
        setMatches(Object.fromEntries(m.data.matches.map((x) => [x.name, x])));
        setSupplierLookup('done');
      } else {
        setError(m.message);
        setSupplierLookup('failed');
      }
    })();
    return () => {
      live = false;
    };
  }, [lines]);

  // The supplier's SKUs within the picked class, fetched once per class (spec §7.3 step 3).
  useEffect(() => {
    for (const l of lines) {
      const classId = skuClassFor(l, picked, matches);
      if (classId === null || requested.current.has(classId)) continue;
      requested.current.add(classId);
      void smFetch<ClassSuppliersResponse>(`/api/account/sourcing-map/class-suppliers?class_id=${encodeURIComponent(classId)}`).then((out) => {
        if (out.ok) setCatalog((c) => ({ ...c, [classId]: out.data.suppliers }));
        else setError(out.message);
      });
    }
  }, [lines, picked, matches]);

  function skuOptions(l: UploadedBomLine): string[] {
    const p = picked[l.key];
    const m = l.supplier_name ? matches[l.supplier_name] : undefined;
    if (!p || !m?.match) return [];
    const supplierId = m.match.participant_id;
    return catalog[p.class_id]?.find((s) => s.participant_id === supplierId)?.skus.map((s) => s.supplier_sku) ?? [];
  }
  function skuFor(l: UploadedBomLine): string | null {
    if (l.supplier_sku) return l.supplier_sku;
    const options = skuOptions(l);
    return chosenSku[l.key] ?? (options.length === 1 ? options[0]! : null);
  }
  function acceptConfident() {
    setPicked((cur) => {
      const next = { ...cur };
      for (const l of lines) {
        const top = suggestions[l.component_label]?.[0];
        if (!next[l.key] && top?.band === 'high') next[l.key] = { class_id: top.class_id, label: top.label };
      }
      return next;
    });
  }

  // Derived in render, so the pick that starts a lookup disables Continue in the same commit: until the class's SKUs
  // answer, a usable match would be saved unpinned with a "no SKU picked" note (AC 7).
  const skuLookupPending = lines.some((l) => {
    const classId = skuClassFor(l, picked, matches);
    return classId !== null && catalog[classId] === undefined;
  });
  const resolved = lines.map((l) => resolveLine(l, picked[l.key] ?? null, l.supplier_name ? matches[l.supplier_name] ?? null : null, skuFor(l)));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="sm-btn sm-btn-ghost" onClick={acceptConfident}>Accept all confident</button>
        {retrieval === 'text_only' && (
          <p className="sm-warn text-xs">Class suggestions used text search only; the embedding service did not answer.</p>
        )}
      </div>
      <table className="sm-table mt-3">
        <thead><tr><th>Component</th><th>Class</th><th>Supplier</th></tr></thead>
        <tbody>
          {lines.map((l, i) => {
            const p = picked[l.key];
            const m = l.supplier_name ? matches[l.supplier_name] : undefined;
            const options = skuOptions(l);
            const r = resolved[i]!;
            return (
              <tr key={l.key} aria-label={`Row ${l.rows.join(', ')}: ${l.component_label}`}>
                <td>
                  {l.component_label}
                  {l.class_text && <p className="sm-muted text-xs">File says: {l.class_text}</p>}
                </td>
                <td>
                  {/* The picker stays mounted with the pick as its value (as in the BOM grid), so a pick can be changed
                      and focus has somewhere to stay: a chip that picks is removed, so it hands focus to this row's
                      class search; a search result's pick keeps it there itself (ClassPicker). */}
                  <div className="flex flex-wrap items-start gap-2">
                    {!p && (suggestions[l.component_label] ?? []).map((s) => (
                      <button
                        key={s.class_id}
                        type="button"
                        className="sm-btn sm-btn-ghost text-xs"
                        onClick={(e) => {
                          e.currentTarget.closest('td')?.querySelector<HTMLInputElement>('input')?.focus();
                          setPicked((c) => ({ ...c, [l.key]: { class_id: s.class_id, label: s.label } }));
                        }}
                      >
                        {s.label} <Pill themed category="sm_band" value={s.band} />
                      </button>
                    ))}
                    <ClassPicker label={`${l.component_label} (row ${l.rows.join(', ')})`} value={p ?? null} suggestion={null} onChange={(c) => setPicked((cur) => ({ ...cur, [l.key]: c }))} />
                  </div>
                </td>
                <td className="text-xs">
                  {l.supplier_name ? (
                    <>
                      <span>{l.supplier_name}</span>{' '}
                      {m && <Pill themed category="sm_match" value={m.match?.confidence ?? m.note ?? 'not_on_network'} />}
                      {options.length > 1 && !l.supplier_sku && (
                        <select aria-label={`SKU for row ${l.rows[0]}`} className="sm-input ml-2 text-xs" value={chosenSku[l.key] ?? ''} onChange={(e) => setChosenSku((c) => ({ ...c, [l.key]: e.target.value }))}>
                          <option value="">Pick a SKU…</option>
                          {options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {r.note && supplierLookup === 'done' && <p className="sm-warn">{r.note}</p>}
                    </>
                  ) : (
                    <span className="sm-muted">None named</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {supplierLookup === 'pending' && <p className="sm-muted mt-3 text-xs">Matching supplier names to your trading partners…</p>}
      {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
      <div className="mt-4 flex justify-between">
        <button type="button" className="sm-btn sm-btn-ghost" onClick={onBack}>Back</button>
        <button type="button" className="sm-btn sm-btn-primary" disabled={supplierLookup !== 'done' || skuLookupPending} onClick={() => onContinue(resolved)}>Continue to review</button>
      </div>
    </div>
  );
}
