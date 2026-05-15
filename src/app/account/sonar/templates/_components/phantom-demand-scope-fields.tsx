'use client';

import { useState } from 'react';
import type { RunTemplateScope } from '@haiwave/protocol';
import { CounterpartyPicker } from './counterparty-picker';
import { PartnerSkuPicker } from './partner-sku-picker';

type PdScope = Extract<RunTemplateScope, { kind: 'phantom_demand' }>;

interface Props {
  value: PdScope;
  onChange: (next: PdScope) => void;
}

export function PhantomDemandScopeFields({ value, onChange }: Props) {
  const [qtyInput, setQtyInput] = useState<string>(String(value.hypothetical_quantity));

  return (
    <div className="space-y-4">
      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Hypothetical Quantity</span>
        <input
          type="number"
          aria-label="Hypothetical Quantity"
          min={1}
          value={qtyInput}
          onChange={(e) => {
            setQtyInput(e.target.value);
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
          value={value.hypothetical_timeline ?? ''}
          onChange={(e) =>
            onChange({ ...value, hypothetical_timeline: e.target.value || null })
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
