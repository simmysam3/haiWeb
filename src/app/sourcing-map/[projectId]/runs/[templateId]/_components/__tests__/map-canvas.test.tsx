import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroResult, zeroSlotResult, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SM_UNCLASSIFIED_CLASS_PREFIX, type SourcingMapExecutionResult } from '@/lib/sourcing-map/contract';
import { isUnclassifiedSlot, slotTitle } from '@/lib/sourcing-map/map/selectors';
import { MapCanvas } from '../map-canvas';

const SEAT = { name: 'CSG Footwear Vietnam', country: 'VN', classLabel: 'Athletic footwear', productCount: 3, slotCount: 5, assemblyDays: '21', capacity: 18000 };
const NAMES = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };
const UNAVAILABLE = "Nothing to map: every product's BOM was unavailable from the agent.";
const NO_LINES = 'Nothing to map: the products in this run have no BOM lines yet.';

function mount(result: SourcingMapExecutionResult, extra: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
  return render(
    <MapCanvas result={result} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={null}
      onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} {...extra} />,
  );
}

describe('MapCanvas', () => {
  it('draws the seat, a rail per slot with its requirement and coverage, the cards, the heat links and the legend, and records its render (R-9)', () => {
    const withCap = structuredCloneSafe(vomeroResult);
    withCap.slots[4]!.not_probed_count = 2;
    performance.clearMeasures('sm-map-render');
    mount(withCap);
    expect(screen.getByRole('region', { name: 'Sourcing map' })).toBeInTheDocument();
    expect(screen.getByText('CSG Footwear Vietnam')).toBeInTheDocument();
    expect(screen.getByText('VN · Athletic footwear')).toBeInTheDocument();
    const leather = screen.getByRole('group', { name: 'Full grain leather hides' });
    // Lane pre-empt: the rail's collapse toggle is a button that exposes its state.
    expect(within(leather).getByRole('button', { name: 'Full grain leather hides' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(leather).getByText('12,000 sq ft by Feb 22')).toBeInTheDocument();
    expect(within(leather).getByText('Covered 81% by this drop · not fully observed')).toBeInTheDocument();
    expect(within(leather).getByText("Size-bound · Men's US")).toBeInTheDocument();
    expect(within(leather).getAllByRole('button', { name: /,/ })).toHaveLength(3);
    const eyelets = screen.getByRole('group', { name: 'Metal eyelets' });
    expect(within(eyelets).getByText('No trading partner publishes this class')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Flat laces' })).getByText('+2 not probed')).toBeInTheDocument();
    expect(screen.getByText('Direct suppliers only; nothing below tier 1 has been traced.')).toBeInTheDocument();
    const svg = document.querySelector('svg[data-map-links]')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // D9, AC 18: links carry the 90 / 70 heat. Paths are drawn lane by lane, the lane link first: leather's lane
    // covers 81% (mid), then its cards' links, León 41% (bad), Mekong 100% (good) and Arno, who timed out (neutral).
    const strokes = Array.from(svg.querySelectorAll('path')).slice(0, 4).map((p) => p.style.stroke);
    expect(strokes).toEqual(['var(--sm-heat-mid)', 'var(--sm-heat-bad)', 'var(--sm-heat-good)', 'var(--sm-line-2)']);
    // R-9 (S8, ruling 10): each render records the measure that the SP1-e walk reads in a real browser (Task 41).
    const measures = performance.getEntriesByName('sm-map-render', 'measure');
    expect(measures).toHaveLength(1);
    expect(Number.isFinite(measures[0]!.duration)).toBe(true);
  });

  it('keeps R-9 safe under StrictMode: no throw, exactly one measure, and one start mark left however often it renders (ruling F03, amended)', () => {
    performance.clearMarks('sm-map-render:start');
    performance.clearMeasures('sm-map-render');
    // StrictMode (App Router's default) renders twice and re-runs the layout effect without a re-render.
    expect(() => render(
      <StrictMode>
        <MapCanvas result={vomeroResult} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={null}
          onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} />
      </StrictMode>,
    )).not.toThrow();
    expect(performance.getEntriesByName('sm-map-render', 'measure')).toHaveLength(1);
    // Each render clears the previous start mark before setting its own, so marks never pile up (a server render
    // never runs the effect at all).
    expect(performance.getEntriesByName('sm-map-render:start', 'mark')).toHaveLength(1);
  });

  it('keeps R-9 safe for two sibling canvases in one render: no throw and exactly one measure (ruling F03, amended)', () => {
    performance.clearMarks('sm-map-render:start');
    performance.clearMeasures('sm-map-render');
    const canvas = () => (
      <MapCanvas result={vomeroResult} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={null}
        onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} />
    );
    expect(() => render(<>{canvas()}{canvas()}</>)).not.toThrow();
    expect(performance.getEntriesByName('sm-map-render', 'measure')).toHaveLength(1);
  });

  it('renders an honest empty state naming the reason when there are no slots (Review Focus 5)', () => {
    const { unmount } = mount(zeroSlotResult(), { asOfDrop: null });
    expect(screen.getByRole('status')).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('status')).not.toHaveTextContent(NO_LINES);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    unmount();
    // Every product composed but none has a BOM line: the other reason, said as itself.
    const noLines = zeroSlotResult();
    noLines.products = noLines.products.map((p) => ({ ...p, status: 'composed' as const, failure: null }));
    const second = mount(noLines, { asOfDrop: null });
    expect(screen.getByRole('status')).toHaveTextContent(NO_LINES);
    expect(screen.getByRole('status')).not.toHaveTextContent(UNAVAILABLE);
    second.unmount();
    // No products at all: nothing failed, so only the no-lines reason.
    mount({ ...zeroSlotResult(), products: [] }, { asOfDrop: null });
    expect(screen.getByRole('status')).toHaveTextContent(NO_LINES);
    expect(screen.getByRole('status')).not.toHaveTextContent(UNAVAILABLE);
  });

  it('names both reasons when a zero-slot run has some failed BOMs and the rest have no lines (Review Focus 5)', () => {
    const mixed = zeroSlotResult();
    mixed.products = mixed.products.map((p, i) => (i === 0 ? p : { ...p, status: 'composed' as const, failure: null }));
    mount(mixed, { asOfDrop: null });
    expect(screen.getByRole('status')).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('status')).toHaveTextContent(NO_LINES);
  });

  it("dims slots the filtered product does not use and shows that product's share of the others (d-G8)", () => {
    mount(vomeroResult, { productFilter: VOMERO_IDS.metcon });
    expect(screen.getByRole('group', { name: 'Metal eyelets' }).className).toContain('opacity-40');
    const leather = screen.getByRole('group', { name: 'Full grain leather hides' });
    expect(leather.className).not.toContain('opacity-40');
    expect(within(leather).getByText('Metcon Iron: 3,750 of 12,000 sq ft (31%)')).toBeInTheDocument();
  });

  it('shows a size-bound slot’s per-size strip at the as-of drop, in size order, each size with its percentage (Zephyr sizes 9 and 10 bind)', () => {
    mount(vomeroResult);
    const outsole = screen.getByRole('group', { name: 'Rubber outsoles' });
    const strip = within(outsole).getByRole('list', { name: 'Coverage by size' });
    const cells = within(strip).getAllByRole('listitem');
    expect(cells).toHaveLength(13);
    expect(cells.slice(0, 3).map((c) => c.textContent)).toEqual(['7 100%', '7.5 100%', '8 100%']);
    expect(within(strip).getByLabelText('Size 9: 79% covered')).toHaveTextContent('9 79%');
    expect(within(strip).getByLabelText('Size 10: 79% covered')).toBeInTheDocument();
    expect(within(strip).getByLabelText('Size 9.5: 100% covered')).toBeInTheDocument();
    // Ruling F-c: a name on a generic <span> is prohibited; each cell is an image, as the pips are.
    expect(within(strip).getAllByRole('img')).toHaveLength(13);
    expect(within(strip).getByRole('img', { name: 'Size 9: 79% covered' })).toHaveTextContent('9 79%');
    expect(within(screen.getByRole('group', { name: 'Metal eyelets' })).queryByRole('list', { name: 'Coverage by size' })).toBeNull();
  });

  it("keys rails by slot index: one class in Men's US and Women's US is two rails, each naming its size system (b-G12)", async () => {
    const user = userEvent.setup();
    const twoSystems = structuredCloneSafe(vomeroResult);
    const mens = twoSystems.slots[2]!; // the outsole slot
    twoSystems.slots.push({ ...structuredCloneSafe(mens), slot_key: { ...mens.slot_key, variant_system: "Women's US" } });
    const womensIndex = twoSystems.slots.length - 1;
    const onToggle = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mount(twoSystems, { onToggle });
      const rails = screen.getAllByRole('group', { name: 'Rubber outsoles' });
      expect(rails).toHaveLength(2);
      expect(within(rails[0]!).getByText("Size-bound · Men's US")).toBeInTheDocument();
      expect(within(rails[1]!).getByText("Size-bound · Women's US")).toBeInTheDocument();
      await user.click(within(rails[1]!).getByRole('button', { name: /^Rubber outsoles/ }));
      expect(onToggle).toHaveBeenCalledWith(womensIndex);
      expect(consoleError.mock.calls.flat().map(String).join(' ')).not.toMatch(/same key/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('renders an unclassified agent-line slot as "Unclassified · <component>", never "No trading partner publishes this class" (contract §10)', () => {
    const r = structuredCloneSafe(vomeroResult);
    const eyelets = r.slots[3]!;
    eyelets.slot_key = { ...eyelets.slot_key, class_id: `${SM_UNCLASSIFIED_CLASS_PREFIX}${VOMERO_IDS.bowline}:BW-EYE-8` };
    eyelets.class_label = 'Eyelets, antique brass';
    eyelets.class_path = [];
    // no_publisher stays true, as the eyelets fixture sets it, so the absence assertion below can fail
    expect(eyelets.no_publisher).toBe(true);
    mount(r);
    const rail = screen.getByRole('group', { name: 'Unclassified · Eyelets, antique brass' });
    expect(within(rail).getByRole('button', { name: /^Unclassified · Eyelets, antique brass/ })).toBeInTheDocument();
    expect(within(rail).queryByText('No trading partner publishes this class')).toBeNull();
    expect(isUnclassifiedSlot(eyelets)).toBe(true);
    expect(slotTitle(vomeroResult.slots[0]!)).toBe('Full grain leather hides');
  });

  it('draws no card for a cap_reached candidate: the lane counts it in "+N not probed" instead (contract §3.6)', () => {
    const r = structuredCloneSafe(vomeroResult);
    const leather = r.slots[0]!;
    leather.candidates.push({ ...structuredCloneSafe(leather.candidates[1]!), supplier_name: 'Capped Tannery', supplier_country: 'PT', status: 'cap_reached' });
    leather.not_probed_count = 1;
    mount(r);
    const lane = screen.getByRole('group', { name: 'Full grain leather hides' });
    expect(within(lane).getAllByRole('button', { name: /,/ })).toHaveLength(3);
    expect(within(lane).queryByRole('button', { name: /^Capped Tannery/ })).toBeNull();
    expect(within(lane).getByText('+1 not probed')).toBeInTheDocument();
  });
});

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
