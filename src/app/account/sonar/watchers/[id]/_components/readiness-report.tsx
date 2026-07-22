'use client';

import { useState } from 'react';
import { DetailChevron } from '@/components/sonar/observations';
import type { ReadinessSku, ReadinessVendor } from '../_lib/pivot-readiness';
import { OrderStateTable } from './order-state-table';
import { LeadTimeHistoryTable } from './lead-time-history-table';

// Readiness watcher run-detail view. The hierarchy is Watcher -> SKU -> vendor:
// each watched SKU shows its forward-demand ask, then one collapsible block per
// supplier with that supplier's current order state and its per-run lead-time
// history. Assembled upstream by pivotReadiness(); this component is purely
// presentational.

interface VendorBlockProps {
  vendor: ReadinessVendor;
  askQuantity: number;
}

function VendorBlock({ vendor, askQuantity }: VendorBlockProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-medium text-charcoal">{vendor.vendor_name}</span>
        <DetailChevron expanded={open} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {vendor.order_state ? (
            <OrderStateTable payload={vendor.order_state} />
          ) : (
            <p className="italic text-slate">No order history reported.</p>
          )}
          <LeadTimeHistoryTable rows={vendor.lead_time_rows} askQuantity={askQuantity} />
        </div>
      )}
    </div>
  );
}

interface Props {
  skus: ReadinessSku[];
}

export function ReadinessReport({ skus }: Props) {
  return (
    <div className="divide-y-2 divide-slate-200">
      {skus.map((sku) => (
        <section key={sku.sku} className="space-y-4 py-8 first:pt-0 last:pb-0">
          <header className="border-b border-slate-100 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-teal">
              Watched SKU
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-charcoal">
              {sku.product_name}
              <span className="ml-2 font-mono text-xs font-normal text-slate-500">{sku.sku}</span>
            </h3>
            {sku.ask && (
              <p className="mt-1 text-sm text-slate">
                Ask: {sku.ask.ask_quantity} units within {sku.ask.target_days} calendar days
              </p>
            )}
          </header>

          <div className="space-y-3">
            {sku.vendors.map((vendor) => (
              <VendorBlock
                key={vendor.vendor_id}
                vendor={vendor}
                askQuantity={sku.ask?.ask_quantity ?? 0}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
