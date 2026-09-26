'use client';
import { useState } from 'react';
import { mixTotalsHundred, type SmMix, type VariantAxis } from '@haiwave/protocol';
import { curveMix, mixFromPairs, mixTotal, normalizeMix, pairsFromMix } from '@/lib/sourcing-map/demand-math';

type Curve = { center: string; spread: number; half_sizes: boolean };
type PairsDraft = { pairs: Record<string, number>; mix: SmMix; totalQty: number };

function sameMix(a: SmMix, b: SmMix, order: readonly string[]): boolean {
  return order.every((v) => (a[v] ?? 0) === (b[v] ?? 0));
}

/**
 * The prototype's size-mix controls (spec §7.4): center, spread, half sizes,
 * Generate curve, and edit by % and edit by pairs. Validity uses
 * the contract's own mixTotalsHundred — the predicate the server applies (Review Focus 3, d-G7).
 */
export function SizeMixEditor({ axis, mix, totalQty, curve, label, onChange }: {
  axis: VariantAxis; mix: SmMix | null; totalQty: number; curve: Curve | null; label: string; onChange(mix: SmMix, curve: Curve | null): void;
}) {
  const [center, setCenter] = useState(curve?.center ?? axis.values[Math.floor(axis.values.length / 2)]!);
  const [spread, setSpread] = useState(String(curve?.spread ?? 1.5));
  const [half, setHalf] = useState(curve?.half_sizes ?? axis.values.some((v) => v.includes('.')));
  const [mode, setMode] = useState<'pct' | 'pairs'>('pct');
  // Edit by pairs (spec §7.4): a typed count stays as typed. The draft keeps the pairs as typed with the mix they
  // produced, and shows only while that mix, at this total, is still the prop. A mix from anywhere else (Generate
  // curve, Normalize, a % edit, an upload) or a new total re-seeds the pairs from the mix; entering pairs mode drops it.
  const [draft, setDraft] = useState<PairsDraft | null>(null);
  const current: SmMix = mix ?? Object.fromEntries(axis.values.map((v) => [v, 0]));
  const ownDraft = draft !== null && draft.totalQty === totalQty && sameMix(draft.mix, current, axis.values) ? draft : null;
  const pairs = ownDraft ? ownDraft.pairs : pairsFromMix(totalQty, current, axis.values);
  const valid = mixTotalsHundred(current);
  const curveNow: Curve = { center, spread: Number(spread) || 1.5, half_sizes: half };

  return (
    <fieldset aria-label={`Size mix for ${label}`} className="mt-3">
      <legend className="sm-muted text-xs uppercase tracking-wide">Size mix</legend>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>Center
          <select aria-label="Curve center" className="sm-input ml-2" value={center} onChange={(e) => setCenter(e.target.value)}>
            {axis.values.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>Spread
          <input aria-label="Curve spread" type="number" min={0.3} step={0.1} className="sm-input ml-2 w-20" value={spread} onChange={(e) => setSpread(e.target.value)} />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} />Half sizes</label>
        <button type="button" className="sm-btn sm-btn-ghost" onClick={() => onChange(curveMix(axis.values, curveNow), curveNow)}>Generate curve</button>
        <div role="radiogroup" aria-label="Edit the mix by" className="flex gap-2">
          <label className="flex items-center gap-1"><input type="radio" name={`mix-mode-${label}`} checked={mode === 'pct'} onChange={() => setMode('pct')} />Edit by %</label>
          <label className="flex items-center gap-1"><input type="radio" name={`mix-mode-${label}`} checked={mode === 'pairs'} onChange={() => { setDraft(null); setMode('pairs'); }} />Edit by pairs</label>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {axis.values.map((v) => (
          <label key={v} className="flex flex-col text-xs">
            <span className="sm-muted">{v}</span>
            {mode === 'pct' ? (
              <input
                type="number" step="0.01" min={0} max={100} aria-label={`${v} share %`} className="sm-input w-16 text-xs"
                value={current[v] ?? 0}
                onChange={(e) => {
                  const n = Number.parseFloat(e.target.value);
                  if (Number.isFinite(n) && n >= 0 && n <= 100) onChange({ ...current, [v]: n }, curve);
                }}
              />
            ) : (
              <input
                type="number" step={1} min={0} aria-label={`${v} pairs`} className="sm-input w-20 text-xs"
                value={pairs[v] ?? 0}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(n) || n < 0) return;
                  const typed = { ...pairs, [v]: n };
                  const next = mixFromPairs(typed, axis.values);
                  setDraft({ pairs: typed, mix: next, totalQty });
                  onChange(next, curve);
                }}
              />
            )}
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-sm">
        {valid ? (
          <p className="sm-muted">Total {mixTotal(current)}%</p>
        ) : (
          <p role="alert" className="sm-error">Total {mixTotal(current)}% — the mix must total 100%</p>
        )}
        <button type="button" className="sm-btn sm-btn-ghost text-xs" onClick={() => onChange(normalizeMix(current, axis.values), curve)}>Normalize to 100%</button>
      </div>
    </fieldset>
  );
}
