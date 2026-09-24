import { describe, it, expect } from 'vitest';
import { presetAxis, VARIANT_PRESETS } from '../variant-presets';

describe('variant presets (spec §7.2)', () => {
  it("expands Men's US 6–15 and Women's US 5–12 with and without half sizes", () => {
    expect(VARIANT_PRESETS.map((p) => p.label)).toEqual(["Men's US 6–15", "Women's US 5–12"]);
    const mens = presetAxis('mens_us_6_15', true);
    expect(mens).toMatchObject({ name: 'Size', system: "Men's US" });
    expect(mens.values).toHaveLength(19);
    expect(mens.values.slice(0, 3)).toEqual(['6', '6.5', '7']);
    expect(mens.values[mens.values.length - 1]).toBe('15');
    expect(presetAxis('mens_us_6_15', false).values).toEqual(['6', '7', '8', '9', '10', '11', '12', '13', '14', '15']);
    expect(presetAxis('womens_us_5_12', true).values).toHaveLength(15);
  });
});
