'use client';
import { useState } from 'react';
import { SM_LIMITS, type DemandDrop, type DemandSchedule, type SmProduct } from '@/lib/sourcing-map/contract';
import { generateDrops, type DropsGeneratorInput } from '@/lib/sourcing-map/demand-math';
import { DropsChart } from './drops-chart';
import { SizeMixEditor } from './size-mix-editor';

/** Per-product demand (spec §7.4): generator, editable drops, chart, size mix, per-drop overrides. */
export function DemandEditor({ product, demand, onChange }: { product: SmProduct; demand: DemandSchedule; onChange(d: DemandSchedule): void }) {
  const g0 = demand.generator;
  const name = product.name;
  const [total, setTotal] = useState(String(g0?.total ?? demand.drops.reduce((a, d) => a + d.qty, 0)));
  const [first, setFirst] = useState(g0?.first_due_date ?? demand.drops[0]?.due_date ?? '');
  const [spacing, setSpacing] = useState<DropsGeneratorInput['spacing']>(g0?.spacing ?? 'monthly');
  const [count, setCount] = useState(String(g0?.count ?? demand.drops.length));
  const [shape, setShape] = useState<DropsGeneratorInput['shape']>(g0?.shape ?? 'flat');
  const [error, setError] = useState<string | null>(null);
  const axis = product.variant_axis;
  const totalQty = demand.drops.reduce((a, d) => a + d.qty, 0);
  const outOfOrder = demand.drops.some((d, i) => i > 0 && d.due_date <= demand.drops[i - 1]!.due_date);

  function generate() {
    const input: DropsGeneratorInput = { total: Number(total), first_due_date: first, spacing, count: Number(count), shape };
    const out = generateDrops(input);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setError(null);
    onChange({ ...demand, drops: out.drops, generator: { ...input, curve: demand.generator?.curve ?? null } });
  }
  // A Generate refusal names the inputs it was given; changing any of them answers it, so it clears (as the tray's edits do).
  function input<T>(set: (v: T) => void, v: T) {
    setError(null);
    set(v);
  }
  function setDrop(i: number, patch: Partial<DemandDrop>) {
    onChange({ ...demand, drops: demand.drops.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>Total<input aria-label={`Total for ${name}`} type="number" min={1} className="sm-input ml-2 w-28" value={total} onChange={(e) => input(setTotal, e.target.value)} /></label>
        <label>First due<input aria-label={`First due date for ${name}`} type="date" className="sm-input ml-2" value={first} onChange={(e) => input(setFirst, e.target.value)} /></label>
        <label>Spacing
          <select aria-label={`Spacing for ${name}`} className="sm-input ml-2" value={spacing} onChange={(e) => input(setSpacing, e.target.value as DropsGeneratorInput['spacing'])}>
            <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </select>
        </label>
        <label>Drops<input aria-label={`Drops for ${name}`} type="number" min={1} max={SM_LIMITS.DROPS_PER_PRODUCT} className="sm-input ml-2 w-20" value={count} onChange={(e) => input(setCount, e.target.value)} /></label>
        <label>Shape
          <select aria-label={`Shape for ${name}`} className="sm-input ml-2" value={shape} onChange={(e) => input(setShape, e.target.value as DropsGeneratorInput['shape'])}>
            <option value="flat">Flat</option><option value="ramp">Ramp</option><option value="front_loaded">Front-loaded</option>
          </select>
        </label>
        <button type="button" aria-label={`Generate drops for ${name}`} className="sm-btn sm-btn-ghost" onClick={generate}>Generate drops</button>
      </div>
      {error && <p role="alert" className="sm-error mt-2 text-sm">{error}</p>}
      <DropsChart drops={demand.drops} unit={product.unit_label} />
      <table className="sm-table mt-3">
        <thead><tr><th>Drop</th><th>Due date</th><th>Quantity</th><th>Mix</th></tr></thead>
        <tbody>
          {/* Keyed by position: a key on the date would remount the row, and the input being typed in, on every date
              edit. No drop state outlives its drop: an override's editor unmounts when Generate clears it, and an
              uploaded schedule remounts this whole editor (R1). */}
          {demand.drops.map((d, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td><input aria-label={`Due date of drop ${i + 1} for ${name}`} type="date" className="sm-input" value={d.due_date} onChange={(e) => setDrop(i, { due_date: e.target.value })} /></td>
              <td><input aria-label={`Quantity of drop ${i + 1} for ${name}`} type="number" min={1} className="sm-input w-28" value={d.qty} onChange={(e) => { const n = Number.parseInt(e.target.value, 10); if (Number.isInteger(n) && n > 0) setDrop(i, { qty: n }); }} /></td>
              <td>
                {axis && (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      aria-label={`Override the mix for drop ${i + 1} of ${name}`}
                      checked={d.mix_override !== null}
                      onChange={(e) => setDrop(i, { mix_override: e.target.checked ? { ...(demand.mix ?? {}) } : null })}
                    />
                    Override
                  </label>
                )}
                {axis && d.mix_override && (
                  <SizeMixEditor axis={axis} mix={d.mix_override} totalQty={d.qty} curve={null} label={`${name} drop ${i + 1}`} onChange={(m) => setDrop(i, { mix_override: m })} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {outOfOrder && <p role="alert" className="sm-error mt-2 text-sm">Drops must be in date order, with no date repeated.</p>}
      {axis && (
        <SizeMixEditor
          axis={axis}
          mix={demand.mix}
          totalQty={totalQty}
          curve={demand.generator?.curve ?? null}
          label={name}
          onChange={(mix, curve) => onChange({ ...demand, mix, generator: demand.generator ? { ...demand.generator, curve } : null })}
        />
      )}
    </div>
  );
}
