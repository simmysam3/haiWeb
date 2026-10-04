import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroResult, zeroSlotResult, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SM_UNCLASSIFIED_CLASS_PREFIX, type SourcingMapExecutionResult } from '@haiwave/protocol';
import { isUnclassifiedSlot, slotTitle } from '@/lib/sourcing-map/map/selectors';
import { layoutMap } from '@/lib/sourcing-map/map/layout';
import { multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { compareDetail } from '@/app/sourcing-map/__fixtures__/lf';
import { MapCanvas } from '../map-canvas';

const SEAT = { name: 'CSG Footwear Vietnam', country: 'VN', classLabel: 'Athletic footwear', productCount: 3, slotCount: 5, assemblyDays: '21', capacity: 18000 };
const NAMES = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };
const UNAVAILABLE = "Nothing to map: every product's BOM was unavailable from the agent.";
const NO_LINES = 'Nothing to map: the products in this run have no BOM lines yet.';
const SOME_UNAVAILABLE = "Nothing to map: some products' BOMs were unavailable from the agent, and the others have no BOM lines yet.";

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
    expect(within(leather).getByText('Covered 81% by this drop · not fully observed · stated capacity could cover it')).toBeInTheDocument();
    expect(within(leather).getByText("Size-bound · Men's US")).toBeInTheDocument();
    expect(within(leather).getAllByRole('button', { name: /,/ })).toHaveLength(3);
    const eyelets = screen.getByRole('group', { name: 'Metal eyelets' });
    expect(within(eyelets).getByText('No trading partner publishes this class')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Flat laces' })).getByText('+2 not probed')).toBeInTheDocument();
    expect(screen.getByText('Direct suppliers only; nothing below tier 1 has been traced.')).toBeInTheDocument();
    const svg = document.querySelector('svg[data-map-links]')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // D9, AC 18: the cards' drops carry the 90 / 70 heat. Paths are drawn lane by lane: leather's main line (seat
    // link, then bus), orange because the plan is short while stated capacity could cover it (owner's walk rulings,
    // 2026-09-29), then its cards' drops, León 41% (bad), Mekong 100% (good) and Arno, who timed out (neutral).
    const strokes = Array.from(svg.querySelectorAll('path')).slice(0, 5).map((p) => p.style.stroke);
    expect(strokes).toEqual(['var(--sm-heat-mid)', 'var(--sm-heat-mid)', 'var(--sm-heat-bad)', 'var(--sm-heat-good)', 'var(--sm-line-2)']);
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

  it('says so in one sentence when a zero-slot run has some failed BOMs and the rest have no lines (Review Focus 5, M2 amended)', () => {
    const mixed = zeroSlotResult();
    mixed.products = mixed.products.map((p, i) => (i === 0 ? p : { ...p, status: 'composed' as const, failure: null }));
    mount(mixed, { asOfDrop: null });
    expect(screen.getByRole('status')).toHaveTextContent(SOME_UNAVAILABLE);
    expect(screen.getByRole('status')).not.toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('status')).not.toHaveTextContent(NO_LINES);
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

  it("routes every link below its lane's rail text, so no link strikes through a header line (walk B1, 2026-09-29)", () => {
    mount(vomeroResult);
    const lay = layoutMap(vomeroResult.slots, new Set());
    const points = Array.from(document.querySelectorAll('svg[data-map-links] path')).flatMap((p) => {
      const n = (p.getAttribute('d')!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      return n.flatMap((x, i) => (i % 2 === 0 ? [{ x, y: n[i + 1]! }] : []));
    });
    // The rails start at lanesX: a link point at or right of it lies in a lane's column, under or over its header.
    const inLanes = points.filter((pt) => pt.x >= lay.lanesX);
    expect(inLanes.length).toBeGreaterThan(0);
    for (const pt of inLanes) {
      const lane = lay.lanes.find((l) => pt.y >= l.y && pt.y <= l.y + l.h);
      expect(lane, `a link point at y ${pt.y} lies in no lane`).toBeDefined();
      expect(pt.y, `lane ${lane!.slotIndex}: a link at y ${pt.y} crosses rail text that ends at ${lane!.y + lane!.textH}`).toBeGreaterThanOrEqual(lane!.y + lane!.textH);
    }
  });

  it("draws a lane's main line once, in one of three colours: cyan when the plan as allocated meets the requirement, orange when it is short while stated capacity could cover it, red when stated capacity cannot; each card's drop keeps its own heat (owner's walk rulings, 2026-09-29)", () => {
    const links = (kind: string) => Array.from(document.querySelectorAll<SVGPathElement>(`svg[data-map-links] path[data-link="${kind}"][data-slot="0"]`));
    const strokes = (kind: string) => links(kind).map((p) => p.style.stroke);
    // Leather at the March drop is covered 81% as allocated, and Mekong states the full requirement: orange.
    const reallocate = mount(vomeroResult);
    expect(strokes('trunk')).toEqual(['var(--sm-heat-mid)']);
    expect(strokes('bus')).toEqual(['var(--sm-heat-mid)']);
    // León 41% (bad), Mekong 100% (good), Arno timed out (neutral).
    expect(strokes('drop')).toEqual(['var(--sm-heat-bad)', 'var(--sm-heat-good)', 'var(--sm-line-2)']);
    // A drop is the vertical piece alone, so no two links of different heat lie on the bus.
    for (const drop of links('drop')) {
      const [x1, , x2] = (drop.getAttribute('d')!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(x1).toBe(x2);
    }
    reallocate.unmount();
    // The plan as allocated covers it in full: cyan.
    const met = structuredCloneSafe(vomeroResult);
    for (const c of met.slots[0]!.coverage) c.coverage = 1;
    const full = mount(met);
    expect(strokes('trunk')).toEqual(['var(--sm-heat-good)']);
    expect(strokes('bus')).toEqual(['var(--sm-heat-good)']);
    full.unmount();
    // Without Mekong's answer León's 41% is all that is stated: the requested volume cannot be met, so red.
    const short = structuredCloneSafe(vomeroResult);
    short.slots[0]!.candidates[1] = { ...short.slots[0]!.candidates[1]!, status: 'timeout', weeks: [] };
    mount(short);
    expect(strokes('trunk')).toEqual(['var(--sm-heat-bad)']);
    expect(strokes('bus')).toEqual(['var(--sm-heat-bad)']);
    expect(strokes('drop')).toEqual(['var(--sm-heat-bad)', 'var(--sm-line-2)', 'var(--sm-line-2)']);
  });

  it('places the "+N not probed" note beside the cards, 8 px below their top edge', () => {
    const r = structuredCloneSafe(vomeroResult);
    r.slots[4]!.not_probed_count = 2;
    mount(r);
    const lane = layoutMap(r.slots, new Set()).lanes[4]!;
    const note = within(screen.getByRole('group', { name: 'Flat laces' })).getByText('+2 not probed');
    expect(note.style.top).toBe(`${lane.cards[0]!.y + 8}px`);
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

  const mt = multitierDetail.result!;
  function mount2(extra: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
    return render(
      <MapCanvas result={mt} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={null}
        onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} selectedHandle={null} onSelectAlias={vi.fn()} {...extra} />,
    );
  }

  it('an SP2 result: the disclosure caption, the Supply-chain limits list at the top under the seat bar, tier rows under the cards, card boxes as tall as their rows, the card anchored by its key; an SP1 result keeps the SP1 caption and none of it (spec §12.1, §12.3, Review Focus 1)', () => {
    const sp2 = mount2();
    expect(screen.getByText('Identity, quantities and names below tier 1 are not disclosed.')).toBeInTheDocument();
    expect(screen.queryByText('Direct suppliers only; nothing below tier 1 has been traced.')).toBeNull();
    const map = screen.getByRole('region', { name: 'Sourcing map' });
    const limits = screen.getByRole('region', { name: 'Supply-chain limits' });
    expect(map.contains(limits)).toBe(true);
    expect(screen.getByRole('region', { name: 'Shared exposure' })).toBeInTheDocument();
    const leatherLane = screen.getByRole('group', { name: 'Full grain leather hides' });
    expect(limits.compareDocumentPosition(leatherLane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(leatherLane).getByRole('group', { name: 'Tier 2 under León Cuero' })).toBeInTheDocument();
    expect(within(leatherLane).getByRole('group', { name: 'Tier 3 under León Cuero' })).toBeInTheDocument();
    const lay = layoutMap(mt.slots, new Set());
    const leonButton = within(leatherLane).getByRole('button', { name: /^León Cuero, MX/ });
    expect(leonButton).toHaveAttribute('data-anchor', 'leon');
    const wrapper = leonButton.closest<HTMLElement>('.sm-card')!.parentElement!;
    expect(wrapper.style.height).toBe(`${lay.lanes[0]!.cardH}px`);
    expect(lay.lanes[0]!.cardH).toBeGreaterThan(212);
    expect(screen.queryByRole('img', { name: /^Shortfall trace/ })).toBeNull();
    sp2.unmount();
    mount(vomeroResult);
    expect(screen.getByText('Direct suppliers only; nothing below tier 1 has been traced.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Supply-chain limits' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Shared exposure' })).toBeNull();
    expect(screen.queryByRole('group', { name: /^Tier \d/ })).toBeNull();
  });

  it('puts the toolbar at the top of the map section, after the caption and above Supply-chain limits, and offers Hide all paths only while a card is selected', () => {
    const { rerender, unmount } = mount2();
    const map = screen.getByRole('region', { name: 'Sourcing map' });
    const toolbar = within(map).getByRole('group', { name: 'Map tools' });
    const caption = within(map).getByText('Identity, quantities and names below tier 1 are not disclosed.');
    expect(caption.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toolbar.compareDocumentPosition(within(map).getByRole('region', { name: 'Supply-chain limits' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // no card selected: nothing is open, so Hide all paths is unavailable
    expect(within(toolbar).getByRole('button', { name: 'Hide all paths' })).toHaveAttribute('aria-disabled', 'true');
    // no heat prop: the heat is on, and the switch says so (§6.6)
    expect(within(toolbar).getByRole('button', { name: 'Heat on links: on' })).toHaveAttribute('aria-pressed', 'true');
    // a card selected: a path is open, and a press reports it
    const onHideAll = vi.fn();
    rerender(
      <MapCanvas result={mt} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={{ slot: 0, candidate: 0 }}
        onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} selectedHandle={null} onSelectAlias={vi.fn()} onHideAll={onHideAll} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide all paths' }));
    expect(onHideAll).toHaveBeenCalledTimes(1);
    unmount();
    // a result with no slots has no paths: no toolbar
    mount(zeroSlotResult(), { asOfDrop: null });
    expect(screen.getByRole('region', { name: 'Sourcing map' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Map tools' })).toBeNull();
  });

  it('heat off draws every trunk, bus and drop neutral; pips and the trace line keep their colours (§6.6)', () => {
    const strokes = (kind: string) => Array.from(document.querySelectorAll<SVGPathElement>(`svg[data-map-links] path[data-link="${kind}"]`)).map((p) => p.style.stroke);
    const pips = () => Array.from(document.querySelectorAll<HTMLElement>('ol[aria-label="Coverage by drop"] [role="img"]')).map((el) => el.style.background);
    const on = mount2({ selected: { slot: 0, candidate: 0 } });
    const pipsOn = pips();
    // the comparison means something only while the pips carry heat colours
    expect(pipsOn.some((b) => b.startsWith('var(--sm-heat-'))).toBe(true);
    on.unmount();
    mount2({ selected: { slot: 0, candidate: 0 }, heat: false });
    for (const kind of ['trunk', 'bus', 'drop']) {
      expect(strokes(kind).length).toBeGreaterThan(0);
      expect(strokes(kind).filter((s) => s !== 'var(--sm-line-2)'), `${kind} links still drawn in heat colours`).toEqual([]);
    }
    expect(pips()).toEqual(pipsOn);
    const edge = document.querySelector<SVGPathElement>('svg path[data-trace-edge]');
    expect(edge?.style.stroke).toBe('var(--sm-heat-mid)');
  });

  it('selecting a traced card mounts the overlay above the cards with its edge and gap and marks that card’s binding handle; an untraced card, no card, or a collapsed traced lane mounts nothing (spec §12.3, Review Focus 2)', () => {
    const { rerender, unmount } = mount2({ selected: { slot: 0, candidate: 0 } });
    const overlay = screen.getByRole('img', { name: /^Shortfall trace: León Cuero → A \(moderate\)/ });
    expect(overlay.querySelectorAll('path[data-trace-edge]')).toHaveLength(1);
    expect(overlay.querySelectorAll('g[data-trace-gap][data-status="not_connected"]')).toHaveLength(1);
    const leonButton = screen.getByRole('button', { name: /^León Cuero, MX/ });
    expect(leonButton.compareDocumentPosition(overlay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const leonT2 = screen.getByRole('group', { name: 'Tier 2 under León Cuero' });
    const mekongT2 = screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' });
    expect(within(within(leonT2).getByRole('button', { name: /^A · IT/ })).getByRole('img', { name: 'binding' })).toBeInTheDocument();
    expect(within(within(mekongT2).getByRole('button', { name: /^A · IT/ })).queryByRole('img', { name: 'binding' })).toBeNull();
    rerender(
      <MapCanvas result={mt} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={{ slot: 0, candidate: 1 }}
        onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} selectedHandle={null} onSelectAlias={vi.fn()} />,
    );
    expect(screen.queryByRole('img', { name: /^Shortfall trace/ })).toBeNull();
    // León is neither selected nor pinned now: its handles carry no trace role (the marker is a traced card's alone)
    expect(within(within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT/ })).queryByRole('img', { name: 'binding' })).toBeNull();
    rerender(
      <MapCanvas result={mt} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={{ slot: 0, candidate: 0 }}
        onSelect={vi.fn()} collapsed={new Set([0])} onToggle={vi.fn()} selectedHandle={null} onSelectAlias={vi.fn()} />,
    );
    expect(screen.queryByRole('img', { name: /^Shortfall trace/ })).toBeNull();
    unmount();
    mount2({ selected: null });
    expect(screen.queryByRole('img', { name: /^Shortfall trace/ })).toBeNull();
  });

  it('re-measures the trace’s anchors when a handle is pressed: its 2 px border and bold weight move the handles after it in the row (#38)', () => {
    // León's trace edge runs to B here, so pressing A (before B in the row) moves the edge's end
    const viaB = structuredCloneSafe(mt);
    const leonTrace = viaB.slots[0]!.candidates[0]!.trace!;
    leonTrace.edges[0]!.child = 'B';
    leonTrace.nodes[0]!.alias = 'B';
    let shift = 0;
    const rect = (x: number, y: number, width: number, height: number) =>
      ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.anchor === 'leon') return rect(40, 100, 200, 20);
      if (this.dataset.anchor === 'leon/B') return rect(150 + shift, 300, 60, 22);
      return rect(0, 0, 0, 0);
    });
    try {
      // one collapsed set, result and drop for both renders: only the pressed handle changes
      const collapsed = new Set<number>();
      const selected = { slot: 0, candidate: 0 };
      const at = (selectedHandle: { alias: string; origin: string } | null) => (
        <MapCanvas result={viaB} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={selected}
          onSelect={vi.fn()} collapsed={collapsed} onToggle={vi.fn()} selectedHandle={selectedHandle} onSelectAlias={vi.fn()} />
      );
      const { rerender } = render(at(null));
      const edge = () => document.querySelector('path[data-trace-edge]')!.getAttribute('d');
      expect(edge()).toMatch(/L 150 311$/);
      shift = 7;
      rerender(at({ alias: 'A', origin: 'leon' }));
      expect(edge()).toMatch(/L 157 311$/);
    } finally {
      spy.mockRestore();
    }
  });

  it('hovering a handle lights every handle of that alias across cards; a click reports the alias; the limits list selects the first option a node binds', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSelectAlias = vi.fn();
    mount2({ onSelect, onSelectAlias });
    const leonA = within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT/ });
    const mekongA = within(screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^A · IT/ });
    await user.hover(leonA);
    expect(leonA).toHaveAttribute('data-lit', 'true');
    expect(mekongA).toHaveAttribute('data-lit', 'true');
    expect(within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^B · US/ })).not.toHaveAttribute('data-lit');
    await user.unhover(leonA);
    expect(mekongA).not.toHaveAttribute('data-lit');
    await user.click(leonA);
    expect(onSelectAlias).toHaveBeenCalledWith('A', 'leon');
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'A · tier 2 — binding for León Cuero' }));
    expect(onSelect).toHaveBeenCalledWith({ slot: 0, candidate: 0 });
  });

  // LF (§6.3): the compare fixture, where D binds both FlowKnit (lane 1) and Bowline (lane 2); one open set unless a test collapses
  const cd = compareDetail.result!;
  const BOWLINE = { slot: 2, candidate: 0 };
  const FLOWKNIT = { slot: 1, candidate: 0 };
  const OPEN = new Set<number>();
  const held = (selected: { slot: number; candidate: number } | null, pinned: { slot: number; candidate: number } | null, collapsed: ReadonlySet<number> = OPEN) => (
    <MapCanvas result={cd} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={selected}
      onSelect={vi.fn()} collapsed={collapsed} onToggle={vi.fn()} selectedHandle={null} onSelectAlias={vi.fn()} pinned={pinned} />
  );
  const traces = () => document.querySelectorAll('svg[data-trace]');

  it('draws the pinned card’s trace beside the active card’s, each named for itself; an untraced or doubly-held card draws one (§6.3)', () => {
    const { rerender } = render(held(BOWLINE, FLOWKNIT));
    expect(traces()).toHaveLength(2);
    expect(screen.getByRole('img', { name: /^Shortfall trace \(pinned\): FlowKnit Mills → D \(severe\)/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Shortfall trace: Bowline Trim → D \(severe\)/ })).toBeInTheDocument();
    const dUnder = (supplier: string) => within(screen.getByRole('group', { name: `Tier 2 under ${supplier}` })).getByRole('button', { name: /^D · TW/ });
    expect(within(dUnder('FlowKnit Mills')).getByRole('img', { name: 'binding' })).toBeInTheDocument();
    expect(within(dUnder('Bowline Trim')).getByRole('img', { name: 'binding' })).toBeInTheDocument();
    // León active, Mekong pinned: Mekong has no trace of its own, so one
    rerender(held({ slot: 0, candidate: 0 }, { slot: 0, candidate: 1 }));
    expect(traces()).toHaveLength(1);
    // the pinned card is the active card: one
    rerender(held(BOWLINE, { ...BOWLINE }));
    expect(traces()).toHaveLength(1);
    expect(screen.getByRole('img', { name: /^Shortfall trace: Bowline Trim → D \(severe\)/ })).toBeInTheDocument();
    // the active card's lane collapsed, the pin kept (the workspace keeps a pin from another lane): the pinned trace alone
    const named = () => Array.from(traces(), (t) => t.getAttribute('aria-label')!.split(':')[0]);
    rerender(held(BOWLINE, FLOWKNIT, new Set([BOWLINE.slot])));
    expect(named()).toEqual(['Shortfall trace (pinned)']);
    // the pinned card's lane collapsed (the workspace unpins it first; this is the canvas's own guard): the active trace alone
    rerender(held(BOWLINE, FLOWKNIT, new Set([FLOWKNIT.slot])));
    expect(named()).toEqual(['Shortfall trace']);
  });

  it('measures each traced card’s own anchors: two cards that share alias D end their edges at their own handles', () => {
    const rect = (x: number, y: number, width: number, height: number) =>
      ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;
    // each card's header and its D, the two cards apart; the frame and every other element at (0, 0)
    const rects: Record<string, DOMRect> = {
      flowknit: rect(100, 100, 200, 20), 'flowknit/D': rect(150, 300, 60, 22),
      bowline: rect(400, 500, 200, 20), 'bowline/D': rect(450, 700, 60, 22),
    };
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return rects[this.dataset.anchor ?? ''] ?? rect(0, 0, 0, 0);
    });
    try {
      render(held(BOWLINE, FLOWKNIT));
      const edges = (name: RegExp) => Array.from(screen.getByRole('img', { name }).querySelectorAll('path[data-trace-edge]')).map((p) => p.getAttribute('d'));
      expect(edges(/^Shortfall trace \(pinned\): FlowKnit Mills/)).toEqual([expect.stringMatching(/ L 150 311$/)]);
      expect(edges(/^Shortfall trace: Bowline Trim/)).toEqual([expect.stringMatching(/ L 450 711$/)]);
    } finally {
      spy.mockRestore();
    }
  });

  it('records one sm-trace-draw measure for the canvas, from one start mark a render, however many traces it draws; none when it draws none', () => {
    performance.clearMeasures('sm-trace-draw');
    const mark = vi.spyOn(performance, 'mark');
    try {
      const { rerender } = render(held(BOWLINE, FLOWKNIT));
      const marks = (name: string) => mark.mock.calls.filter(([n]) => n === name).length;
      expect(marks('sm-trace-draw:start')).toBe(marks('sm-map-render:start'));
      expect(performance.getEntriesByName('sm-trace-draw', 'measure')).toHaveLength(1);
      // no card active or pinned: no trace drawn, so no measure, and no start mark either
      performance.clearMeasures('sm-trace-draw');
      const traceMarks = marks('sm-trace-draw:start');
      rerender(held(null, null));
      expect(performance.getEntriesByName('sm-trace-draw', 'measure')).toHaveLength(0);
      expect(marks('sm-trace-draw:start')).toBe(traceMarks);
    } finally {
      mark.mockRestore();
    }
  });
});

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
