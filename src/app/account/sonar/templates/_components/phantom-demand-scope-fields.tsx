'use client';

import type { RunTemplateScope } from '@haiwave/protocol';
import { CounterpartyPicker } from './counterparty-picker';
import { PartnerSkuPicker } from './partner-sku-picker';

type PdScope = Extract<RunTemplateScope, { kind: 'phantom_demand' }>;

interface Props {
  value: PdScope;
  onChange: (next: PdScope) => void;
}

/** Convert a datetime-local string (YYYY-MM-DDTHH:mm) to a full ISO-8601 string.
 *  Returns null if the input is empty or not a valid date. */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Convert a stored ISO-8601 string back to the YYYY-MM-DDTHH:mm format
 *  required by datetime-local inputs. Uses local date/time components to
 *  match what the browser would display, avoiding UTC-offset display drift. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function PhantomDemandScopeFields({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Hypothetical Quantity</span>
        <input
          type="number"
          aria-label="Hypothetical Quantity"
          min={1}
          value={value.hypothetical_quantity}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange({ ...value, hypothetical_quantity: n });
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-32"
        />
      </label>

      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Target Delivery Date</span>
        <input
          type="datetime-local"
          aria-label="Target Delivery Date"
          value={toLocalInput(value.hypothetical_timeline)}
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
