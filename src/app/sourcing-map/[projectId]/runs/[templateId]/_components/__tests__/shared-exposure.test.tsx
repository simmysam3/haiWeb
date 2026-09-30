import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SourcingMapExecutionResult2 } from '@/lib/sourcing-map/types';
import { SharedExposure } from '../shared-exposure';

const mt = multitierDetail.result!;

describe('SharedExposure', () => {
  it('lists each alias under two or more options once, by alias and tier, with the tier-1 option names (spec §14.1, §9.3)', () => {
    render(<SharedExposure result={mt} />);
    const region = screen.getByRole('region', { name: 'Shared exposure' });
    expect(within(region).getByRole('heading', { name: 'Shared exposure' })).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'A · tier 2 — León Cuero, Mekong Tannery',
      'C · tier 3 — León Cuero, Mekong Tannery',
      'D · tier 2 — FlowKnit Mills, Bowline Trim',
    ]);
    // read-only, and nothing below tier 1 carries a participant id
    expect(within(region).queryAllByRole('button')).toHaveLength(0);
    expect(region.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('renders nothing for an SP1 result or an empty list (Review Focus 1)', () => {
    const sp1 = render(<SharedExposure result={vomeroResult} />);
    expect(sp1.container).toBeEmptyDOMElement();
    sp1.unmount();
    const none: SourcingMapExecutionResult2 = { ...mt, shared_exposure: [] };
    expect(render(<SharedExposure result={none} />).container).toBeEmptyDOMElement();
  });
});
