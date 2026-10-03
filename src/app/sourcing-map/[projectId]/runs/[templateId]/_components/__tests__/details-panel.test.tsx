import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vomeroResult, runningDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SM_UNCLASSIFIED_CLASS_PREFIX } from '@haiwave/protocol';
import { multitierDetail, withRealKeys } from '@/app/sourcing-map/__fixtures__/sp2';
import { DetailsPanel } from '../details-panel';

const NAMES = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };

const EXEC = 'e1000000-0000-4000-8000-000000000001';
const fetchMock = vi.fn();

describe('DetailsPanel', () => {
  // The option panel reads on mount; nothing here asserts on its answer.
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows coverage per drop and per size, lead time, utilization, allocation and the products using the slot', () => {
    const onClose = vi.fn();
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={onClose} />);
    const panel = screen.getByRole('complementary', { name: 'Details for León Cuero' });
    const perDrop = within(panel).getByRole('table', { name: 'Coverage by drop' });
    expect(within(perDrop).getByRole('row', { name: /Mar 15/ })).toHaveTextContent('Mar 15Feb 2212,0005,00041%');
    const perSize = within(panel).getByRole('table', { name: 'Coverage by size at Feb 22' });
    expect(within(perSize).getByRole('row', { name: '9' })).toHaveTextContent('91,57165541%');
    expect(within(panel).getByText('38 d')).toBeInTheDocument();
    expect(within(panel).getByText('Allocated 60%')).toBeInTheDocument();
    expect(within(panel).getByText('Pegasus Trail, Court Classic, Metcon Iron')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close details' }));
    expect(onClose).toHaveBeenCalled();
  });

  it("heads the supplier's figures as stated, in both tables (owner's walk ruling, 2026-09-29)", () => {
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    for (const name of ['Coverage by drop', 'Coverage by size at Feb 22']) {
      const headers = within(screen.getByRole('table', { name })).getAllByRole('columnheader').map((h) => h.textContent);
      expect(headers).toContain('Stated');
      expect(headers).not.toContain('Can cover');
    }
  });

  it('moves focus to its heading when it opens (controller ruling R1)', () => {
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const panel = screen.getByRole('complementary', { name: 'Details for León Cuero' });
    expect(document.activeElement).toBe(within(panel).getByRole('heading', { name: 'León Cuero · MX' }));
  });

  it('titles an unclassified slot as its rail does, "Unclassified · <component>" (ruling R4, contract §10)', () => {
    const drops = vomeroResult.portfolio.drops;
    const leather = vomeroResult.slots[0]!;
    // present control: a classified slot keeps its class label, with no prefix
    const { unmount } = render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(screen.getByText('Full grain leather hides · LC-BOV-UP-01')).toBeInTheDocument();
    unmount();
    const laces = structuredCloneSafe(vomeroResult.slots[4]!);
    laces.slot_key = { ...laces.slot_key, class_id: `${SM_UNCLASSIFIED_CLASS_PREFIX}${VOMERO_IDS.bowline}:BW-LACE-137` };
    laces.class_label = 'Flat lace 137 cm';
    laces.class_path = [];
    laces.candidates = [{ ...laces.candidates[0]!, pinned: true }];
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={laces} candidate={laces.candidates[0]!} drops={drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const panel = screen.getByRole('complementary', { name: 'Details for Bowline Cordage' });
    expect(within(panel).getByText('Unclassified · Flat lace 137 cm · BW-LACE-137')).toBeInTheDocument();
  });

  it('a drop with no need week yet reads "No demand yet", never "no answer" (fix round 1, I-1; AC 17)', () => {
    const leather = structuredCloneSafe(vomeroResult.slots[0]!);
    leather.as_of_weeks[0]!.week = null;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const perDrop = screen.getByRole('table', { name: 'Coverage by drop' });
    expect(within(perDrop).getByRole('row', { name: 'Jan 15' })).toHaveTextContent('Jan 15—0—No demand yet');
    // present control: an answered drop still shows its figure
    expect(within(perDrop).getByRole('row', { name: 'Mar 15' })).toHaveTextContent('Mar 15Feb 2212,0005,00041%');
  });

  it('a probing candidate reads "Probing" per drop and per size, as its card does, never "no answer" (fix round 1, I-1; AC 17)', () => {
    // SmExecutionDetail.result is nullable; the running fixture always carries one.
    const result = runningDetail().result!;
    const leather = result.slots[0]!;
    const mekong = leather.candidates[1]!;
    expect(mekong.status).toBe('probing');
    render(<DetailsPanel executionId={EXEC} result={result} slot={leather} candidate={mekong} drops={result.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(within(screen.getByRole('table', { name: 'Coverage by drop' })).getByRole('row', { name: 'Mar 15' })).toHaveTextContent('Mar 15Feb 2212,000—Probing');
    expect(within(screen.getByRole('table', { name: 'Coverage by size at Feb 22' })).getByRole('row', { name: '9' })).toHaveTextContent('91,571—Probing');
  });

  it('a candidate not probed at this trust level says so, as its card does, never "no answer" (fix round 1, I-1)', () => {
    const leather = vomeroResult.slots[0]!;
    const notProbed = { ...leather.candidates[1]!, availability_form: 'not_probed_trust' as const, weeks: [] };
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={notProbed} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(within(screen.getByRole('table', { name: 'Coverage by drop' })).getByRole('row', { name: 'Mar 15' })).toHaveTextContent('Mar 15Feb 2212,000—Not probed at this trust level');
  });

  it('a size with no demand reads covered in full, never NaN% or Infinity% (fix round 1, M1)', () => {
    const leather = structuredCloneSafe(vomeroResult.slots[0]!);
    // Feb 22 (index 2) is the Mar 15 drop's need week: size 13 needs nothing; one row answers 0 (0 / 0), one answers 5 (5 / 0).
    leather.demand[2]!.cum_qty_by_variant!['13'] = 0;
    leather.demand[2]!.cum_qty_by_variant!['12.5'] = 0;
    const leon = leather.candidates[0]!;
    leon.weeks[2]!.cum_achievable_by_variant!['13'] = 0;
    leon.weeks[2]!.cum_achievable_by_variant!['12.5'] = 5;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leon} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const perSize = screen.getByRole('table', { name: 'Coverage by size at Feb 22' });
    expect(within(perSize).getByRole('row', { name: '13' })).toHaveTextContent('1300100%');
    expect(within(perSize).getByRole('row', { name: '12.5' })).toHaveTextContent('12.505100%');
    expect(perSize.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('summarises the path and shows the aggregates for an SP2 candidate; nothing of the kind for an SP1 candidate (spec §12.4, Review Focus 1)', () => {
    const mt = multitierDetail.result!;
    const leather2 = mt.slots[0]!;
    const { rerender } = render(<DetailsPanel executionId={EXEC} result={mt} slot={leather2} candidate={leather2.candidates[0]!} drops={mt.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const below = screen.getByRole('region', { name: 'Below tier 1' });
    expect(within(below).getByText('Inputs: 3 observed, 1 not observed · binding at tier 2')).toBeInTheDocument();
    const agg = within(below).getByLabelText('Sub-tier aggregates');
    expect(agg).toHaveTextContent('Responders3Median lead time14 dUtilization1 low · 1 moderate · 0 high · 1 at capacityCountriesIN, IT, USClassesColorants, Dyes, Wet-blueNot observed1');
    expect(below.textContent).not.toMatch(/Vetta|Halcyon|Rio Bravo|[0-9a-f]{8}-/);
    // AC 15: the section says what it did not do
    expect(within(below).getByText('Sources below tier 1 were not searched for alternatives.')).toBeInTheDocument();
    // a gap candidate (Arno's timeout) never answered, so it has no inputs to count: no Below tier 1 section at all (M-3)
    rerender(<DetailsPanel executionId={EXEC} result={mt} slot={leather2} candidate={leather2.candidates[2]!} drops={mt.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Arno Pelli · IT' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Below tier 1' })).toBeNull();
    expect(screen.queryByText(/^Inputs:/)).toBeNull();
    expect(screen.queryByLabelText('Sub-tier aggregates')).toBeNull();
    expect(screen.queryByText(/not searched/)).toBeNull();
    // Mekong answered with no trace: the sentence does not depend on a trace
    const mekong = leather2.candidates[1]!;
    expect(mekong.trace).toBeNull();
    rerender(<DetailsPanel executionId={EXEC} result={mt} slot={leather2} candidate={mekong} drops={mt.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(within(screen.getByRole('region', { name: 'Below tier 1' })).getByText('Sources below tier 1 were not searched for alternatives.')).toBeInTheDocument();
    // a null median reads the em dash
    const noMedian = { ...leather2.candidates[1]!, aggregates: { ...leather2.candidates[1]!.aggregates!, median_lead_time_days: null, countries: [], classes: [] } };
    rerender(<DetailsPanel executionId={EXEC} result={mt} slot={leather2} candidate={noMedian} drops={mt.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const D = String.fromCharCode(0x2014);
    expect(screen.getByLabelText('Sub-tier aggregates')).toHaveTextContent(`Median lead time${D}Utilization1 low · 1 moderate · 0 high · 1 at capacityCountries${D}Classes${D}`);
    // SP1
    const leather = vomeroResult.slots[0]!;
    rerender(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'Below tier 1' })).toBeNull();
    expect(screen.queryByText(/not searched/)).toBeNull();
  });

  it('shows the shortfall trace as a sentence with its band legend; the legend only with an edge; nothing without a trace (A2)', () => {
    const mt = multitierDetail.result!;
    const slot = mt.slots[0]!;
    const leon = slot.candidates[0]!;
    const mount = (candidate: typeof leon) => (
      <DetailsPanel executionId={EXEC} result={mt} slot={slot} candidate={candidate} drops={mt.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />
    );
    const { rerender } = render(mount(leon));
    const below = screen.getByRole('region', { name: 'Below tier 1' });
    expect(within(below).getByText('Shortfall trace: León Cuero → A (moderate); binding: A (tier 2); not observed below León Cuero: not connected').tagName).toBe('P');
    const legend = within(below).getByRole('list', { name: 'Trace line bands' });
    const items = within(legend).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['slight', 'moderate', 'severe']);
    expect((items[0]!.firstElementChild as HTMLElement).style.background).toBe('var(--sm-heat-good)');
    expect(within(below).getByText('Trace lines:')).toBeInTheDocument();
    expect(below.textContent).not.toMatch(/Vetta|Halcyon|Rio Bravo|[0-9a-f]{8}-/);
    // R-14: the AC 15 sentence stays the section's last element child
    expect(below.lastElementChild!.textContent).toBe('Sources below tier 1 were not searched for alternatives.');
    // gaps only: the sentence, no legend
    rerender(mount({ ...leon, trace: { nodes: [], edges: [], gaps: leon.trace!.gaps } }));
    expect(screen.getByText('Shortfall trace: not observed below León Cuero: not connected')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Trace line bands' })).toBeNull();
    // no trace: neither
    const mekong = slot.candidates[1]!;
    expect(mekong.trace).toBeNull();
    rerender(mount(mekong));
    expect(screen.queryByText(/^Shortfall trace/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Trace line bands' })).toBeNull();
  });

  it('warns when the binding source limits other options too, inside Below tier 1 and before the AC 15 sentence; not when it binds one (A3)', () => {
    const mt = multitierDetail.result!;
    const twice = structuredCloneSafe(mt);
    twice.slots[0]!.candidates[1]!.limit = 'inputs';
    twice.slots[0]!.candidates[1]!.trace = { nodes: [{ alias: 'A', tier: 2, role: 'binding', band: 'slight', binds_for: 2 }], edges: [{ parent: 'mekong', child: 'A', band: 'slight' }], gaps: [] };
    twice.slots[0]!.candidates[0]!.trace!.nodes[0]!.binds_for = 2;
    const warning = 'The same source limits Mekong Tannery; splitting between these options will not relieve the constraint.';
    const mount = (result: typeof mt) => (
      <DetailsPanel executionId={EXEC} result={result} slot={result.slots[0]!} candidate={result.slots[0]!.candidates[0]!} drops={result.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />
    );
    const { rerender } = render(mount(twice));
    const below = screen.getByRole('region', { name: 'Below tier 1' });
    const p = within(below).getByText(warning);
    expect(p.tagName).toBe('P');
    expect(p).not.toHaveAttribute('role');
    expect(below.lastElementChild!.textContent).toBe('Sources below tier 1 were not searched for alternatives.');
    // the SP2 fixture binds one option: no warning
    rerender(mount(mt));
    expect(screen.queryByText(/^The same source limits/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Below tier 1' }).querySelector('.sm-warn')).toBeNull();
  });

  it('replaces the later-releases sentence with the panel and the price-terms footer (spec §12.3)', () => {
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(screen.queryByText('Scorecard, delivery history and price terms arrive in later releases.')).toBeNull();
    expect(screen.getByText('Price terms arrive in a later release.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Network-wide scorecard (not specific to you)' })).toBeInTheDocument();
  });

  it('reads the panel of a card by its candidate_key; an SP1 card with none sends no request', () => {
    const mt = withRealKeys(multitierDetail).result!;
    const leather2 = mt.slots[0]!;
    const leon = leather2.candidates[0]!;
    expect(leon.candidate_key).toBeTruthy();
    const { unmount } = render(<DetailsPanel executionId={EXEC} result={mt} slot={leather2} candidate={leon} drops={mt.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`/api/account/sourcing-map/executions/${EXEC}/options/${encodeURIComponent(leon.candidate_key!)}/panel`);
    unmount();
    fetchMock.mockClear();
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  });
});

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
