'use client';
import { useState } from 'react';
import type { VariantAxis } from '@haiwave/protocol';
import { presetAxis, VARIANT_PRESETS, type VariantPresetId } from '@/lib/sourcing-map/variant-presets';

function presetOf(axis: VariantAxis | null): VariantPresetId | 'none' | 'custom' {
  if (!axis) return 'none';
  for (const p of VARIANT_PRESETS) {
    for (const half of [true, false]) {
      const x = presetAxis(p.id, half);
      if (x.system === axis.system && x.values.join('|') === axis.values.join('|')) return p.id;
    }
  }
  return 'custom';
}

/** Spec §7.2 variant axis editor: name, system, values; presets; half sizes. */
export function VariantAxisEditor({ axis, onChange }: { axis: VariantAxis | null; onChange(a: VariantAxis | null): void }) {
  const [half, setHalf] = useState(axis ? axis.values.some((v) => v.endsWith('.5')) : true);
  const preset = presetOf(axis);
  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <legend className="sm-muted text-xs uppercase tracking-wide">Variant axis</legend>
      <label className="text-sm">
        Variant preset
        <select
          aria-label="Variant preset"
          className="sm-input ml-2"
          value={preset}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'none') onChange(null);
            else if (v === 'custom') onChange({ name: axis?.name ?? 'Variant', system: axis?.system ?? null, values: axis?.values ?? ['A'] });
            else onChange(presetAxis(v as VariantPresetId, half));
          }}
        >
          <option value="none">No variants</option>
          {VARIANT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={half}
          onChange={(e) => {
            setHalf(e.target.checked);
            if (preset !== 'none' && preset !== 'custom') onChange(presetAxis(preset, e.target.checked));
          }}
        />
        Half sizes
      </label>
      {preset === 'custom' && axis && (
        <>
          <label className="text-sm">Axis name<input className="sm-input ml-2" value={axis.name} maxLength={60} onChange={(e) => onChange({ ...axis, name: e.target.value })} /></label>
          <label className="text-sm">System<input className="sm-input ml-2" value={axis.system ?? ''} maxLength={60} onChange={(e) => onChange({ ...axis, system: e.target.value || null })} /></label>
          <label className="text-sm">
            Values (comma separated)
            <input
              className="sm-input ml-2 w-80"
              value={axis.values.join(', ')}
              onChange={(e) => onChange({ ...axis, values: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </label>
        </>
      )}
    </fieldset>
  );
}
