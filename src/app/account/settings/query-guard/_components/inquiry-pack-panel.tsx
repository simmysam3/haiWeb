'use client';

import { DEFAULT_INQUIRY_PACKS } from '@haiwave/protocol';
import type { InquiryPackConfig, InquiryPackFigures, InquiryPackName } from '@/lib/safe-room-types';

const PACKS: InquiryPackName[] = ['guarded', 'standard', 'open'];
const PACK_LABEL: Record<InquiryPackName, string> = { guarded: 'Guarded', standard: 'Standard', open: 'Open' };

/**
 * One formatter per figure. Each takes the WHOLE pack and reads its own key, so every row is
 * typed against the protocol with no cast — which is what makes the six object-valued figures
 * (sku_repeat, sku_breadth, ad_hoc_cap, volume_band, multi_subject_request, single_order_value)
 * renderable at all (PF P12).
 */
const FIGURE_ROWS: { key: keyof InquiryPackFigures; label: string; fmt: (p: InquiryPackFigures) => string }[] = [
  { key: 'sku_repeat', label: 'SKU repeat', fmt: (p) => `${p.sku_repeat.per_hour}/hr · ${p.sku_repeat.per_day}/day` },
  { key: 'operand_walk_pct', label: 'Operand walk', fmt: (p) => `${p.operand_walk_pct}%` },
  { key: 'enumeration_per_day', label: 'Enumeration', fmt: (p) => `${p.enumeration_per_day}/day` },
  { key: 'sku_breadth', label: 'SKU breadth', fmt: (p) => `${p.sku_breadth.per_hour}/hr · ${p.sku_breadth.per_day}/day` },
  { key: 'ad_hoc_cap', label: 'Ad-hoc cap', fmt: (p) => `${p.ad_hoc_cap.per_six_hours}/6h · ${p.ad_hoc_cap.per_day}/day` },
  { key: 'ad_hoc_cap_evidence_per_six_hours', label: 'Ad-hoc with evidence', fmt: (p) => `${p.ad_hoc_cap_evidence_per_six_hours}/6h` },
  { key: 'volume_band', label: 'Volume band', fmt: (p) => `${p.volume_band.low_pct}–${p.volume_band.high_pct}% → ${p.volume_band.action}` },
  { key: 'multi_subject_request', label: 'Multi-subject request', fmt: (p) => `${p.multi_subject_request.max_subjects} subjects → ${p.multi_subject_request.action}` },
  { key: 'single_order_value', label: 'Single order value', fmt: (p) => `${p.single_order_value.threshold} ${p.single_order_value.currency} → ${p.single_order_value.action}` },
  { key: 'action_at_cap', label: 'Action at cap', fmt: (p) => p.action_at_cap },
];

export function InquiryPackPanel({ current, onSave }: { current: InquiryPackConfig; onSave: (pack: InquiryPackName) => void }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-charcoal">Inquiry-door configuration pack</h2>
      <p className="mb-3 text-sm text-slate">
        Platform ceiling: <strong>{current.ceiling.limit_per_hour}</strong> inquiries / hour / responder
        {' '}({current.ceiling.source === 'participant_override' ? 'your override' : 'platform default'}).
      </p>
      <div role="radiogroup" aria-label="Configuration pack" className="flex gap-4 mb-4">
        {PACKS.map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm text-charcoal">
            <input type="radio" name="inquiry-pack" role="radio" aria-checked={current.pack === p} checked={current.pack === p} onChange={() => onSave(p)} />
            {PACK_LABEL[p]}
          </label>
        ))}
      </div>
      <table className="w-full text-sm border border-slate/15 rounded-md overflow-hidden">
        <thead>
          <tr className="bg-light-gray text-charcoal text-xs font-semibold">
            <th className="p-2 text-left">Rule</th>
            {PACKS.map((p) => <th key={p} className={`p-2 text-left ${current.pack === p ? 'text-navy' : ''}`}>{PACK_LABEL[p]}{current.pack === p ? ' (current)' : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {FIGURE_ROWS.map((r) => (
            <tr key={r.key} className="border-t border-slate/10">
              <td className="p-2 text-charcoal">{r.label}</td>
              {PACKS.map((p) => (
                <td key={p} className={`p-2 ${current.pack === p ? 'text-charcoal font-medium' : 'text-slate'}`}>
                  {r.fmt(p === current.pack ? current.figures : DEFAULT_INQUIRY_PACKS[p])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
