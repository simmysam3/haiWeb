import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SourcingMapExecutionResult2 } from '@/lib/sourcing-map/types';
import { EM_DASH } from '@/lib/sourcing-map/map/selectors';
import { SupplyChainLimits } from '../supply-chain-limits';

const mt = multitierDetail.result!;

describe('SupplyChainLimits', () => {
  it('names every binding node by alias and tier with the option it binds, and a click selects that option (spec §12.3)', () => {
    const onSelect = vi.fn();
    render(<SupplyChainLimits result={mt} onSelect={onSelect} />);
    const region = screen.getByRole('region', { name: 'Supply-chain limits' });
    expect(within(region).getByRole('heading', { name: 'Supply-chain limits' })).toBeInTheDocument();
    const items = within(region).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual([`A · tier 2 ${EM_DASH} binding for León Cuero`]);
    expect(items[0]!.querySelector('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.click(items[0]!);
    expect(onSelect).toHaveBeenCalledWith({ slot: 0, candidate: 0 });
    // nothing below tier 1 is named
    expect(region.textContent).not.toMatch(/Vetta|[0-9a-f]{8}-/);
  });

  it('says "Binding for N options" for a node binding several, listed once, and selects the first option it binds', () => {
    const onSelect = vi.fn();
    const twice: SourcingMapExecutionResult2 = JSON.parse(JSON.stringify(mt));
    const mekong = twice.slots[0]!.candidates[1]!;
    mekong.limit = 'inputs';
    mekong.trace = { nodes: [{ alias: 'A', tier: 2, role: 'binding', band: 'slight', binds_for: 2 }], edges: [{ parent: 'mekong', child: 'A', band: 'slight' }], gaps: [] };
    twice.slots[0]!.candidates[0]!.trace!.nodes[0]!.binds_for = 2;
    render(<SupplyChainLimits result={twice} onSelect={onSelect} />);
    const items = screen.getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual([`A · tier 2 ${EM_DASH} Binding for 2 options`]);
    fireEvent.click(items[0]!);
    expect(onSelect).toHaveBeenCalledWith({ slot: 0, candidate: 0 });
  });

  it('renders nothing when no node binds: an SP1 result, or an SP2 result whose limits are own only (Review Focus 1)', () => {
    const sp1 = render(<SupplyChainLimits result={vomeroResult} onSelect={vi.fn()} />);
    expect(sp1.container).toBeEmptyDOMElement();
    sp1.unmount();
    const ownOnly: SourcingMapExecutionResult2 = JSON.parse(JSON.stringify(mt));
    ownOnly.slots[0]!.candidates[0]!.trace = null;
    ownOnly.slots[0]!.candidates[0]!.limit = 'own';
    expect(render(<SupplyChainLimits result={ownOnly} onSelect={vi.fn()} />).container).toBeEmptyDOMElement();
  });
});
