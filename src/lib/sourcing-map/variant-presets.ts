import type { VariantAxis } from './contract';

/** Spec §7.2 presets. Values are display strings; half sizes are "9.5". */
export const VARIANT_PRESETS = [
  { id: 'mens_us_6_15', label: "Men's US 6–15", system: "Men's US", from: 6, to: 15 },
  { id: 'womens_us_5_12', label: "Women's US 5–12", system: "Women's US", from: 5, to: 12 },
] as const;
export type VariantPresetId = (typeof VARIANT_PRESETS)[number]['id'];

function sizeText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function presetAxis(id: VariantPresetId, halfSizes: boolean): VariantAxis {
  const p = VARIANT_PRESETS.find((x) => x.id === id)!;
  const values: string[] = [];
  const step = halfSizes ? 0.5 : 1;
  for (let s = p.from; s <= p.to + 1e-9; s += step) values.push(sizeText(Math.round(s * 2) / 2));
  return { name: 'Size', system: p.system, values };
}
