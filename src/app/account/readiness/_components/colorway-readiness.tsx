'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from '@/components/pill';
import { ComponentLineRow } from './component-line-row';
import type { SkuReadiness } from '@haiwave/protocol';

interface ColorwayOption {
  sku_ref: string;
  colorway_name: string;
  rolled_up_state: string;
}

interface ColorwayReadinessProps {
  colorways: ColorwayOption[];
  initialReadiness: SkuReadiness | null;
  initialSkuRef: string | null;
}

/**
 * Client component: colorway selector + four component lines.
 * The selector drives a router navigation to update the selected SKU; the RSC
 * re-fetches fresh readiness data on each navigation. No client-side fetch
 * for readiness data — reads come through the RSC layer via fetchBffJson.
 */
export function ColorwayReadiness({
  colorways,
  initialReadiness,
  initialSkuRef,
}: ColorwayReadinessProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSkuRef ?? colorways[0]?.sku_ref ?? '');

  function handleSelect(skuRef: string) {
    setSelected(skuRef);
    const params = new URLSearchParams({ sku: skuRef });
    router.push(`/account/readiness?${params.toString()}`);
  }

  const readiness = initialReadiness;

  return (
    <div className="space-y-6">
      {/* Colorway selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-slate shrink-0">Colorway:</span>
        {colorways.map((c) => (
          <button
            key={c.sku_ref}
            onClick={() => handleSelect(c.sku_ref)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selected === c.sku_ref
                ? 'bg-navy text-white'
                : 'bg-slate/10 text-slate hover:bg-slate/20 hover:text-charcoal'
            }`}
          >
            {c.colorway_name}
          </button>
        ))}
      </div>

      {/* Component lines */}
      {readiness ? (
        <div className="rounded-md border border-slate/20 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate/10 bg-slate/5">
            <div>
              <h3 className="text-sm font-semibold text-navy">{readiness.colorway_name}</h3>
              <p className="text-xs text-slate mt-0.5">
                Run qty: {readiness.run_qty.toLocaleString()} — {readiness.lines.length} component lines
              </p>
            </div>
            <Pill category="readiness" value={readiness.rolled_up_state === 'ready' ? 'available' : readiness.rolled_up_state === 'at_risk' ? 'lead_time_shift' : 'hard_gap'}>
              {readiness.rolled_up_state.replace('_', ' ')}
            </Pill>
          </div>
          <div>
            {readiness.lines.map((line) => (
              <ComponentLineRow key={`${line.component}-${line.color_code}`} line={line} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-slate/20 bg-slate/5 px-4 py-8 text-center text-sm text-slate">
          Select a colorway to view component lines.
        </div>
      )}
    </div>
  );
}
