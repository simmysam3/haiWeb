'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { BomLinePin, ClassSuppliersResponse } from '@haiwave/protocol';
import { smFetch } from '@/lib/sourcing-map/client';
import { pinShareTotal } from '@/lib/sourcing-map/bom-draft';
import { SmButton } from '../../../../_components/sm-button';

/**
 * A pinned supplier's share, edited where it stands. The field keeps what is typed, so it can be cleared to type a
 * new number; only a share (above 0, at most 100) reaches the pin, and leaving the field shows the stored share again.
 */
function ShareField({ sku, share, locked, onShare }: { sku: string; share: number; locked: boolean; onShare(n: number): void }) {
  const [text, setText] = useState(String(share));
  // The stored share changed from outside (a save's answer, another pin list): show it, unless it is what was typed.
  const [shown, setShown] = useState(share);
  if (shown !== share) {
    setShown(share);
    if (Number.parseFloat(text) !== share) setText(String(share));
  }
  return (
    <label className="ml-1 whitespace-nowrap">
      <input
        type="number" min={0.01} max={100} step="any"
        aria-label={`Share % for ${sku}`}
        className="sm-input w-16 text-xs"
        readOnly={locked}
        value={text}
        onChange={(e) => {
          // readOnly holds a person's typing; the lock also refuses a change that arrives another way.
          if (locked) return;
          setText(e.target.value);
          const n = Number.parseFloat(e.target.value);
          if (Number.isFinite(n) && n > 0 && n <= 100) onShare(n);
        }}
        onBlur={() => setText(String(share))}
      />
      {' %'}
    </label>
  );
}

/**
 * Supplier pins (spec §6.1, §7.2): a supplier from the seat's trading
 * partners publishing the line's class, a SKU from that supplier's catalog
 * in the class, and a share. Shares total at most 100; the rest is unallocated.
 */
export function PinEditor({ classId, pins, onChange, names = {}, fallbackFocus, locked = false }: {
  classId: string | null; pins: BomLinePin[]; onChange(p: BomLinePin[]): void; names?: Record<string, string | null>;
  /** Takes focus when a removed pin leaves nothing here to take it: Add supplier is disabled without a class (L176). */
  fallbackFocus?(): void;
  /** stale-lock: the grid is read-only; its controls are inert through aria-disabled, which keeps focus (LW-a). */
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const whyId = useId();
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
    // A new supplier is offered what is still unallocated (owner's walk A5, 2026-09-29), and nothing on a line
    // that is fully allocated: a share must first be freed.
    const left = Math.round((100 - total) * 100) / 100;
    setShare(left > 0 ? String(left) : '');
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
      {pins.length === 0 ? <p className="sm-muted">Any trading partner</p> : (
        <ul>
          {pins.map((p, i) => (
            <li key={`${p.supplier_participant_id}-${p.supplier_sku}`} className="flex items-start justify-between gap-2">
              <span>
                {nameOf(p.supplier_participant_id)} · {p.supplier_sku}
                {/* The share is edited where it stands (owner's walk A5, 2026-09-29): a total over 100% is brought
                    back by changing a share, with nobody removed. */}
                <ShareField
                  sku={p.supplier_sku}
                  share={p.share_pct}
                  locked={locked}
                  onShare={(n) => onChange(pins.map((x, j) => (j === i ? { ...x, share_pct: n } : x)))}
                />
              </span>
              <SmButton
                ref={(el) => {
                  removeRefs.current[i] = el;
                }}
                className="sm-link whitespace-nowrap"
                aria-label={`Remove supplier ${p.supplier_sku}`}
                aria-disabled={locked}
                onClick={() => {
                  // Focus moves before the pin goes, to controls that stay mounted: the next pin's Remove, else Add
                  // supplier, else (no class, so Add supplier is disabled) the line's class search.
                  const target = removeRefs.current[i + 1] ?? (classId ? addRef.current : null);
                  if (target) target.focus();
                  else fallbackFocus?.();
                  onChange(pins.filter((_, j) => j !== i));
                }}
              >
                Remove supplier
              </SmButton>
            </li>
          ))}
        </ul>
      )}
      {pins.length > 0 && (
        <p className={total > 100 ? 'sm-error' : 'sm-muted'}>
          {`Total ${total}%${total < 100 ? ` · ${Math.round((100 - total) * 100) / 100}% unallocated` : total > 100 ? ` · ${Math.round((total - 100) * 100) / 100}% over 100%` : ''}`}
        </p>
      )}
      {!open ? (
        <>
          <SmButton ref={addRef} className="sm-link mt-1 block" disabled={!classId} aria-disabled={locked} aria-describedby={classId ? undefined : whyId} onClick={start}>Add supplier</SmButton>
          {/* Suppliers are offered by class, so a line with no class has none to offer. The reason is on the page,
              in words (owner's walk, 2026-09-29): a tooltip on a disabled button is not shown by every browser. */}
          {!classId && <p id={whyId} className="sm-muted">Pick a class for this line first.</p>}
        </>
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
            <input aria-label="Share %" type="number" min={0.01} max={100} step="any" className="sm-input ml-1 w-16 text-xs" readOnly={locked} value={share} onChange={(e) => setShare(e.target.value)} />
          </label>
          <SmButton
            className="sm-btn sm-btn-ghost text-xs"
            disabled={!supplier || !sku || !(Number.parseFloat(share) > 0)}
            aria-disabled={locked}
            onClick={() => {
              onChange([...pins, { supplier_participant_id: supplier, supplier_sku: sku, share_pct: Number.parseFloat(share) }]);
              setOpen(false);
              setSupplier('');
              setSku('');
            }}
          >
            Pin
          </SmButton>
          {/* The way out, also after a failed supplier load; the error goes with the form, so a reopen starts clean. */}
          <button
            type="button"
            className="sm-btn sm-btn-ghost text-xs"
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
