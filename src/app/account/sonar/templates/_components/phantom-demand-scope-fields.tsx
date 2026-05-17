'use client';

import { useEffect, useState } from 'react';
import type { RunTemplateScope } from '@haiwave/protocol';
import { CounterpartyPicker } from './counterparty-picker';
import { PartnerSkuPicker } from './partner-sku-picker';

type PdScope = Extract<RunTemplateScope, { kind: 'phantom_demand' }>;

interface Props {
  value: PdScope;
  onChange: (next: PdScope) => void;
}

/** Convert a date input string (YYYY-MM-DD) to a full ISO-8601 string,
 *  anchored to UTC midnight so it round-trips with toDateInput without
 *  timezone drift. Returns null if the input is empty or not a valid date.
 *  The protocol stores hypothetical_timeline as a datetime; a delivery date
 *  has no meaningful time-of-day, so we normalize to 00:00:00Z. */
function toIso(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Convert a stored ISO-8601 string back to the YYYY-MM-DD format required by
 *  date inputs. Uses UTC components to mirror toIso's UTC anchoring. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function PhantomDemandScopeFields({ value, onChange }: Props) {
  // The quantity field keeps its own string draft so the user can fully clear
  // and retype it. The parent scope must always hold a positive integer
  // (protocol: hypothetical_quantity is z.number().int().positive()), so we
  // only propagate valid values upward and never let the field hold NaN/empty
  // in the parent. Resync the draft whenever the quantity changes externally.
  const [qtyDraft, setQtyDraft] = useState(String(value.hypothetical_quantity));
  useEffect(() => {
    setQtyDraft(String(value.hypothetical_quantity));
  }, [value.hypothetical_quantity]);

  return (
    <div className="space-y-4">
      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Hypothetical Quantity</span>
        <input
          type="number"
          aria-label="Hypothetical Quantity"
          min={1}
          value={qtyDraft}
          onChange={(e) => {
            const raw = e.target.value;
            setQtyDraft(raw);
            const n = Number.parseInt(raw, 10);
            if (Number.isInteger(n) && n > 0) {
              onChange({ ...value, hypothetical_quantity: n });
            }
          }}
          onBlur={() => {
            // If the user left the field empty/invalid, snap back to the last
            // valid quantity rather than displaying a value that was never saved.
            const n = Number.parseInt(qtyDraft, 10);
            if (!Number.isInteger(n) || n <= 0) {
              setQtyDraft(String(value.hypothetical_quantity));
            }
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-32"
        />
      </label>

      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Target Delivery Date</span>
        <input
          type="date"
          aria-label="Target Delivery Date"
          value={toDateInput(value.hypothetical_timeline)}
          onChange={(e) =>
            onChange({ ...value, hypothetical_timeline: toIso(e.target.value) })
          }
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="block text-xs text-slate mt-1">Empty = as soon as possible</span>
      </label>

      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Counterparty</span>
        <CounterpartyPicker
          value={value.counterparty}
          onChange={(participantId) =>
            onChange({ ...value, counterparty: participantId, skus: [] })
          }
        />
        {value.counterparty && value.skus.length === 0 && (
          <span className="block text-xs text-slate mt-1">
            SKU selection resets when you change the counterparty.
          </span>
        )}
      </div>

      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">SKUs</span>
        <PartnerSkuPicker
          counterpartyId={value.counterparty}
          value={value.skus}
          onChange={(skus) => onChange({ ...value, skus })}
        />
      </div>
    </div>
  );
}
