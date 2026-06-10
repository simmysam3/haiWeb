import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GeoRollupEntry } from '@haiwave/protocol';
import { isFullyDomestic, DomesticFlagBadge } from '../domestic';

const entry = (country: string, count = 1): GeoRollupEntry =>
  ({
    country_of_origin: country,
    component_count: count,
    depth_distribution: { 1: count },
  }) as GeoRollupEntry;

describe('isFullyDomestic', () => {
  it('true when every entry resolves to the auditor country', () => {
    expect(isFullyDomestic([entry('US'), entry('US', 3)], 'US')).toBe(true);
  });
  it('false when any entry is foreign', () => {
    expect(isFullyDomestic([entry('US'), entry('CN')], 'US')).toBe(false);
  });
  it('false when any entry is unresolved (XX sentinel)', () => {
    expect(isFullyDomestic([entry('US'), entry('XX')], 'US')).toBe(false);
  });
  it('false for an empty rollup (nothing verified)', () => {
    expect(isFullyDomestic([], 'US')).toBe(false);
  });
});

describe('<DomesticFlagBadge>', () => {
  it('renders the flag with an accessible label for a known country', () => {
    render(<DomesticFlagBadge country="US" title="All components verified US-origin" />);
    expect(
      screen.getByLabelText('All components verified US-origin'),
    ).toBeInTheDocument();
  });
  it('renders nothing for a country with no flag asset', () => {
    const { container } = render(
      <DomesticFlagBadge country="ZZ" title="whatever" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
