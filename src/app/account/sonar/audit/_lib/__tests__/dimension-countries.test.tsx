import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import { DimensionCountryChips } from '../dimension-countries';

const entry = (country_of_origin: string, component_count = 1): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
const result = (r: Partial<AuditRunResult>): AuditRunResult => ({ geo_rollup: [], ...r } as unknown as AuditRunResult);

// D-219 (2026-09-08): design/firmware country chips on a SKU row; nothing when undeclared (spec R3).
describe('DimensionCountryChips', () => {
  it('renders a labelled group per dimension with one chip per resolved country, most components first', () => {
    render(<DimensionCountryChips result={result({ design_geo_rollup: [entry('US', 1), entry('CN', 3)], firmware_geo_rollup: [entry('CN')] })} />);
    const row = screen.getByTestId('dimension-countries');
    expect(row).toHaveTextContent(/^Design.*Firmware/);
    const chips = screen.getAllByRole('img', { name: /origin:/ });
    expect(chips.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Design origin: China (CN)', 'Design origin: United States (US)', 'Firmware origin: China (CN)',
    ]);
  });
  it('an unresolved-only dimension renders no group; both unresolved renders nothing at all', () => {
    render(<DimensionCountryChips result={result({ design_geo_rollup: [entry('<unknown>')], firmware_geo_rollup: [entry('DE')] })} />);
    expect(screen.getByTestId('dimension-countries')).not.toHaveTextContent('Design');
    expect(screen.getByRole('img', { name: 'Firmware origin: Germany (DE)' })).toBeInTheDocument();
  });
  it('renders null when neither dimension has a resolved country (undeclared, or a pre-3.86.0 row)', () => {
    const { container } = render(<DimensionCountryChips result={result({ design_geo_rollup: [entry('<unknown>')] })} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('a code without a flag asset renders as the code', () => {
    render(<DimensionCountryChips result={result({ firmware_geo_rollup: [entry('ZZ')] })} />);
    expect(screen.getByRole('img', { name: 'Firmware origin: ZZ (ZZ)' })).toHaveTextContent('ZZ');
  });
});
