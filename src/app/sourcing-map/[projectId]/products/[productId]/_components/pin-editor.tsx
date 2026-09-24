'use client';
import { useEffect, useRef, useState } from 'react';
import type { BomLinePin, ClassSuppliersResponse } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { pinShareTotal } from '@/lib/sourcing-map/bom-draft';

/**
 * Supplier pins (spec §6.1, §7.2): a supplier from the seat's trading
 * partners publishing the line's class, a SKU from that supplier's catalog
 * in the class, and a share. Shares total at most 100; the rest is unallocated.
 */
export function PinEditor({ classId, pins, onChange, names = {} }: {
  classId: string | null; pins: BomLinePin[]; onChange(p: BomLinePin[]): void; names?: Record<string, string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<ClassSuppliersResponse['suppliers']>([]);
  const [supplier, setSupplier] = useState('');
  const [sku, setSku] = useState('');
  const [share, setShare] = useState('100');
  const [error, setError] = useState<string | null>(null);
  // Each open is a session; Cancel ends it, so a late answer to an ended session's load is dropped.
  const session = useRef(0);
  // Keyboard focus follows the form (WCAG 2.4.3): into Supplier when it opens, back to Add supplier when it closes.
  const supplierRef = useRef<HTMLSelectElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) supplierRef.current?.focus();
    else if (wasOpen.current) addRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const total = pinShareTotal(pins);
  // A (supplier, SKU) pair is pinned at most once (contract §3.3 `checkLine`: "duplicate pin"), so the line's
  // pins, stored or just added, leave the chosen supplier's SKU options.
  const pinned = new Set(pins.filter((p) => p.supplier_participant_id === supplier).map((p) => p.supplier_sku));
  const skus = (suppliers.find((s) => s.participant_id === supplier)?.skus ?? []).filter((s) => !pinned.has(s.supplier_sku));

  async function start() {
    if (!classId) return;
    setError(null);
    setSuppliers([]);
    const mine = ++session.current;
    setOpen(true);
    const out = await smFetch<ClassSuppliersResponse>(`/api/account/sourcing-map/class-suppliers?class_id=${encodeURIComponent(classId)}`);
    if (mine !== session.current) return;
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setSuppliers(out.data.suppliers);
  }

  // d-G9: the grid resolves stored pins' names (Cycle 24.6); a new pin's name comes from this class's suppliers.
  // A supplier nobody can name reads "Unknown supplier", never an id slice.
  function nameOf(id: string): string {
    return names[id] ?? suppliers.find((s) => s.participant_id === id)?.legal_name ?? 'Unknown supplier';
  }

  return (
    <div className="min-w-48 text-xs">
      {pins.length === 0 ? <span className="sm-muted">Any trading partner</span> : (
        <ul>
          {pins.map((p, i) => (
            <li key={`${p.supplier_participant_id}-${p.supplier_sku}`} className="flex items-center gap-2">
              <span>{nameOf(p.supplier_participant_id)} · {p.supplier_sku} · {p.share_pct}%</span>
              <button
                ref={(el) => {
                  removeRefs.current[i] = el;
                }}
                type="button"
                className="sm-link"
                aria-label={`Remove ${p.supplier_sku}`}
                onClick={() => {
                  // Focus moves before the pin goes, to controls that stay mounted: the next pin's Remove, else Add supplier.
                  (removeRefs.current[i + 1] ?? addRef.current)?.focus();
                  onChange(pins.filter((_, j) => j !== i));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {pins.length > 0 && <p className={total > 100 ? 'sm-error' : 'sm-muted'}>Total {total}%{total < 100 ? ` · ${Math.round((100 - total) * 100) / 100}% unallocated` : ''}</p>}
      {!open ? (
        <button ref={addRef} type="button" className="sm-link mt-1" disabled={!classId} title={classId ? undefined : 'Pick a class first'} onClick={start}>Add supplier</button>
      ) : (
        <div className="mt-1 flex flex-wrap items-end gap-1">
          <label>Supplier
            <select ref={supplierRef} aria-label="Supplier" className="sm-input ml-1 text-xs" value={supplier} onChange={(e) => { setSupplier(e.target.value); setSku(''); }}>
              <option value="">Choose…</option>
              {suppliers.map((s) => <option key={s.participant_id} value={s.participant_id}>{s.legal_name}</option>)}
            </select>
          </label>
          <label>Supplier SKU
            <select aria-label="Supplier SKU" className="sm-input ml-1 text-xs" value={sku} onChange={(e) => setSku(e.target.value)}>
              <option value="">Choose…</option>
              {skus.map((s) => <option key={s.supplier_sku} value={s.supplier_sku}>{s.supplier_sku}</option>)}
            </select>
          </label>
          <label>Share %
            <input aria-label="Share %" type="number" min={0.01} max={100} step="any" className="sm-input ml-1 w-16 text-xs" value={share} onChange={(e) => setShare(e.target.value)} />
          </label>
          <button
            type="button"
            className="sm-btn sm-btn-ghost text-xs"
            disabled={!supplier || !sku || !(Number.parseFloat(share) > 0)}
            onClick={() => {
              onChange([...pins, { supplier_participant_id: supplier, supplier_sku: sku, share_pct: Number.parseFloat(share) }]);
              setOpen(false);
              setSupplier('');
              setSku('');
            }}
          >
            Pin
          </button>
          {/* The way out, also after a failed supplier load; the error goes with the form, so a reopen starts clean. */}
          <button
            type="button"
            className="sm-link text-xs"
            onClick={() => {
              session.current += 1;
              setOpen(false);
              setError(null);
              setSupplier('');
              setSku('');
            }}
          >
            Cancel
          </button>
          {error && <p role="alert" className="sm-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
