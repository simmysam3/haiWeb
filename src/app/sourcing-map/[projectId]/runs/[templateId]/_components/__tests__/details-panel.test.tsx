import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vomeroResult, runningDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SM_UNCLASSIFIED_CLASS_PREFIX } from '@haiwave/protocol';
import { multitierDetail, withRealKeys } from '@/app/sourcing-map/__fixtures__/sp2';
import { compareDetail } from '@/app/sourcing-map/__fixtures__/lf';
import { RUN_NOT_COMPLETE } from '@/lib/sourcing-map/map/selectors';
import { smWorstRatio } from '@/test/contrast';
import { DetailsPanel } from '../details-panel';

const NAMES = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };

const EXEC = 'e1000000-0000-4000-8000-000000000001';
const fetchMock = vi.fn();

/** A copy of the multitier result where alias A binds León and Mekong (binds_for 2 on both traces). */
function bindsTwice(mt: NonNullable<typeof multitierDetail.result>) {
  const twice = structuredCloneSafe(mt);
  twice.slots[0]!.candidates[1]!.limit = 'inputs';
  twice.slots[0]!.candidates[1]!.trace = { nodes: [{ alias: 'A', tier: 2, role: 'binding', band: 'slight', binds_for: 2 }], edges: [{ parent: 'mekong', child: 'A', band: 'slight' }], gaps: [] };
  twice.slots[0]!.candidates[0]!.trace!.nodes[0]!.binds_for = 2;
  return twice;
}

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

  it('leaves Escape to the workspace: a press inside the panel calls nothing (§6.5)', () => {
    const onClose = vi.fn();
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={onClose} />);
    // present control: focus is on the heading once the panel opens (R1), so the key lands inside the panel
    const heading = within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('heading', { name: 'León Cuero · MX' });
    expect(heading).toHaveFocus();
    fireEvent.keyDown(heading, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
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

  it('lists the binding sources in Below tier 1, after the trace legend and before the shared warning, with a band and never a percentage', () => {
    const mt = multitierDetail.result!;
    const mount = (result: typeof mt, candidate: (typeof mt)['slots'][number]['candidates'][number]) => (
      <DetailsPanel executionId={EXEC} result={result} slot={result.slots[0]!} candidate={candidate} drops={result.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />
    );
    const { rerender } = render(mount(mt, mt.slots[0]!.candidates[0]!));
    const below = screen.getByRole('region', { name: 'Below tier 1' });
    const table = within(below).getByRole('table', { name: 'Binding sources' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Binding source', 'Tier', 'Band']);
    const body = within(table).getAllByRole('row').slice(1);
    expect(body).toHaveLength(1);
    const cells = Array.from((body[0] as HTMLTableRowElement).cells);
    expect(cells[0]?.textContent).toBe('A · Dyes · IT');
    expect(cells[1]?.textContent).toBe('2');
    expect(cells[2]?.textContent).toBe('moderate');
    const dot = within(cells[2]!).getByRole('img', { name: 'moderate' });
    expect(dot.style.background).toBe('var(--sm-heat-mid)');
    expect(table.textContent).not.toContain('%');
    const legend = within(below).getByRole('list', { name: 'Trace line bands' });
    expect(legend.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A binds León and Mekong: the row says so, and the table comes before the shared-binding warning
    const twice = bindsTwice(mt);
    rerender(mount(twice, twice.slots[0]!.candidates[0]!));
    const shared = within(screen.getByRole('table', { name: 'Binding sources' }));
    expect(shared.getByText('Binding for 2 options')).toHaveClass('sm-warn');
    const warning = within(below).getByText('The same source limits Mekong Tannery; splitting between these options will not relieve the constraint.');
    expect(screen.getByRole('table', { name: 'Binding sources' }).compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Mekong binds nothing: no table
    rerender(mount(mt, mt.slots[0]!.candidates[1]!));
    expect(screen.queryByRole('table', { name: 'Binding sources' })).toBeNull();
  });

  it('the binding table text clears 4.5:1 on the details surface in both themes', () => {
    // AA pairs (F18): inherited ink on the surface (a header cell and a body cell), and sm-warn on the surface
    const mt = multitierDetail.result!;
    const twice = bindsTwice(mt);
    render(<div className="sm-root"><DetailsPanel executionId={EXEC} result={twice} slot={twice.slots[0]!} candidate={twice.slots[0]!.candidates[0]!} drops={twice.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} /></div>);
    const table = within(screen.getByRole('table', { name: 'Binding sources' }));
    expect(smWorstRatio(table.getByRole('columnheader', { name: 'Tier' }))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(table.getByRole('cell', { name: '2' }))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(table.getByText('Binding for 2 options'))).toBeGreaterThanOrEqual(4.5);
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

  it('has two tabs, Details first and selected; both panels stay mounted, so a switch refetches nothing; arrow keys move between them (§7)', () => {
    const cd = compareDetail.result!;
    const leather = cd.slots[0]!;
    render(<DetailsPanel executionId={EXEC} result={cd} slot={leather} candidate={leather.candidates[0]!} drops={cd.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const tabs = within(screen.getByRole('tablist', { name: 'Option details' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Details', 'Path beneath']);
    const [details, path] = tabs as [HTMLElement, HTMLElement];
    expect(details).toHaveAttribute('aria-selected', 'true');
    const detailsPanel = screen.getByRole('tabpanel', { name: 'Details' });
    expect(within(detailsPanel).getByRole('table', { name: 'Coverage by drop' })).toBeInTheDocument();
    expect(within(detailsPanel).getByRole('region', { name: 'Below tier 1' })).toBeInTheDocument();
    // the unselected panel is mounted but hidden, so a role query does not find it
    expect(screen.queryByRole('tabpanel', { name: 'Path beneath' })).toBeNull();
    fireEvent.click(path);
    expect(screen.getByRole('tabpanel', { name: 'Path beneath' })).toContainElement(screen.getByRole('heading', { name: 'Path beneath León Cuero' }));
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    // the selected tab shows without hue alone (WCAG 1.4.1): a border and a weight, the Configure tray's pair
    expect(path).toHaveClass('border-b-2', 'font-medium');
    expect(details).not.toHaveClass('border-b-2');
    expect(detailsPanel).toHaveAttribute('hidden');
    fireEvent.click(details);
    expect(detailsPanel).not.toHaveAttribute('hidden');
    // the option panel read once, on mount: neither switch remounted it
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // the arrow keys are the tablist's: a press is taken (preventDefault, never stopPropagation; Escape stays the page's)
    expect(fireEvent.keyDown(details, { key: 'ArrowRight' })).toBe(false);
    expect(path).toHaveAttribute('aria-selected', 'true');
    expect(path).toHaveFocus();
    fireEvent.keyDown(path, { key: 'ArrowLeft' });
    expect(details).toHaveAttribute('aria-selected', 'true');
    expect(details).toHaveFocus();
    // two tabs: each arrow wraps round to the other (APG)
    fireEvent.keyDown(details, { key: 'ArrowLeft' });
    expect(path).toHaveFocus();
    fireEvent.keyDown(path, { key: 'ArrowRight' });
    expect(details).toHaveFocus();
  });

  it('Path beneath is unavailable, with its reason, on a card with nothing beneath it and on a running execution (§7, §9.5, w7)', () => {
    const leather = vomeroResult.slots[0]!;
    const { rerender } = render(<DetailsPanel executionId={EXEC} result={vomeroResult} slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const details = screen.getByRole('tab', { name: 'Details' });
    const path = screen.getByRole('tab', { name: 'Path beneath' });
    // León of the SP1 result has no nodes: nothing was traced beneath it
    expect(path).toHaveAttribute('aria-disabled', 'true');
    // it looks unavailable as .sm-btn[aria-disabled] does (opacity 0.55), through a literal class tied to the attribute
    expect(path).toHaveClass('aria-disabled:opacity-55');
    expect(path).toHaveAccessibleDescription('Nothing was traced beneath this option.');
    fireEvent.click(path);
    expect(details).toHaveAttribute('aria-selected', 'true');
    // an arrow still moves focus onto it, so its reason is read; Details stays selected
    fireEvent.keyDown(details, { key: 'ArrowRight' });
    expect(path).toHaveFocus();
    expect(details).toHaveAttribute('aria-selected', 'true');
    // Arno timed out: its nodes are an empty list, so nothing was traced beneath it either
    const cd = compareDetail.result!;
    const view = (candidate: (typeof cd)['slots'][number]['candidates'][number], unavailable: string | null = null) => (
      <DetailsPanel executionId={EXEC} result={cd} slot={cd.slots[0]!} candidate={candidate} drops={cd.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} unavailable={unavailable} />
    );
    rerender(view(cd.slots[0]!.candidates[2]!));
    expect(path).toHaveAccessibleDescription('Nothing was traced beneath this option.');
    // a running execution: the run's reason, even on a card with something beneath it
    rerender(view(cd.slots[0]!.candidates[0]!, RUN_NOT_COMPLETE));
    expect(path).toHaveAccessibleDescription('Available when the run completes.');
    // León of the compare result, complete: available
    rerender(view(cd.slots[0]!.candidates[0]!));
    expect(path).not.toHaveAttribute('aria-disabled');
  });

  it('the tab labels clear 4.5:1 on the details surface in both themes (§7, F18)', () => {
    // AA pairs (F18): inherited ink on the surface (the selected tab) and sm-muted on the surface (the unselected tab;
    // the unavailable tab's reason line is the same pair, so it has no assertion of its own)
    const cd = compareDetail.result!;
    const leather = cd.slots[0]!;
    render(<div className="sm-root"><DetailsPanel executionId={EXEC} result={cd} slot={leather} candidate={leather.candidates[0]!} drops={cd.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} /></div>);
    expect(smWorstRatio(screen.getByRole('tab', { name: 'Details' }))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(screen.getByRole('tab', { name: 'Path beneath' }))).toBeGreaterThanOrEqual(4.5);
  });

  it('offers Pin before Close, reads Unpin on the pinned card, and is unavailable with its reason', () => {
    // AA pairs (F18): sm-btn-ghost on the surface (the button). Its reason line is sm-muted on the surface, the pair
    // Pin 7.5 asserts for this component, so it has no assertion of its own.
    const cd = compareDetail.result!;
    const leather = cd.slots[0]!;
    const onToggle = vi.fn();
    const view = (pin: { pinned: boolean; reason: string | null }) => (
      <div className="sm-root"><DetailsPanel executionId={EXEC} result={cd} slot={leather} candidate={leather.candidates[0]!} drops={cd.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} pin={{ ...pin, onToggle }} /></div>
    );
    const { rerender } = render(view({ pinned: false, reason: null }));
    // in the header, before Close: the panel's first two buttons
    expect(screen.getAllByRole('button').slice(0, 2).map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Pin', 'Close details']);
    const pin = screen.getByRole('button', { name: 'Pin' });
    fireEvent.click(pin);
    expect(onToggle).toHaveBeenCalledTimes(1);
    // on the pinned card the same button reads Unpin
    rerender(view({ pinned: true, reason: null }));
    expect(screen.getByRole('button', { name: 'Unpin' })).toBe(pin);
    // unavailable with a reason (w3): it stays focusable, says why, and a press does nothing
    rerender(view({ pinned: false, reason: RUN_NOT_COMPLETE }));
    expect(pin).toHaveAttribute('aria-disabled', 'true');
    expect(pin).toHaveAccessibleDescription('Available when the run completes.');
    fireEvent.click(pin);
    expect(onToggle).toHaveBeenCalledTimes(1);
    // AA: the button's ink on the details surface, in both themes
    rerender(view({ pinned: false, reason: null }));
    expect(smWorstRatio(pin)).toBeGreaterThanOrEqual(4.5);
  });
});

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
