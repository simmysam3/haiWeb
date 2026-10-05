import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { compareDetail } from '@/app/sourcing-map/__fixtures__/lf';
import { smWorstRatio } from '@/test/contrast';
import { PathBeneath } from '../path-beneath';

const result = compareDetail.result!;
const option = (key: string) => result.slots.flatMap((s) => s.candidates).find((c) => c.candidate_key === key)!;
const viewOf = (key: string, onOpenRow = vi.fn()) => <PathBeneath result={result} candidate={option(key)} onOpenRow={onOpenRow} />;

describe('PathBeneath', () => {
  it('shows what is beneath an option: the summary, the bar, the counts, the floor note, and its responders by tier and class group, each a row that opens its handle (§7)', () => {
    const { rerender, unmount } = render(viewOf('mekong'));
    expect(screen.getByRole('heading', { name: 'Path beneath Mekong Tannery' })).toBeInTheDocument();
    expect(screen.getByText('3 responders · median 14 d · modal utilization moderate · 2 countries')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Utilization below tier 1: 0 low · 2 moderate · 1 high · 0 at capacity' })).toBeInTheDocument();
    expect(screen.getByText('Countries: IT (2), IN (1)')).toBeInTheDocument();
    expect(screen.getByText('Classes: Dyes (2), Colorants (1)')).toBeInTheDocument();
    expect(screen.getByText('Classes are shown at the deepest level the population floor allows.')).toBeInTheDocument();
    rerender(viewOf('flowknit'));
    expect(screen.getByText('1 responder · median withheld · modal utilization low · 1 country')).toBeInTheDocument();
    rerender(viewOf('leon'));
    const tier2 = screen.getByRole('group', { name: 'Path beneath León Cuero, tier 2' });
    expect(screen.getByRole('group', { name: 'Path beneath León Cuero, tier 3' })).toBeInTheDocument();
    expect(within(tier2).getByText('Dyes')).toBeInTheDocument();
    expect(within(tier2).getByText('L4')).toBeInTheDocument();
    expect(within(tier2).getByText('No class')).toBeInTheDocument();
    expect(within(tier2).queryByText(/null/)).toBeNull();
    const rowA = within(tier2).getByRole('button', { name: /^A · IT/ });
    // LF final review m-B: the row's name says its band once, by the word
    expect(rowA).toHaveAccessibleName(/^(?!.*moderate.*moderate).*moderate/);
    expect(within(rowA).getByText('moderate')).toBeInTheDocument();
    // the band dot on a banded row (Task 6 ruling (c)), re-pinned for m-B: the row's one empty span, in the band's colour
    // and hidden from the row's name
    const dotA = rowA.querySelector<HTMLElement>(':scope > span:empty');
    expect({ hidden: dotA?.getAttribute('aria-hidden'), background: dotA?.style.background }).toEqual({ hidden: 'true', background: 'var(--sm-heat-mid)' });
    expect(within(rowA).getByText('binding')).toBeInTheDocument();
    expect(within(rowA).getByText('also under 1')).toBeInTheDocument();
    expect(within(rowA).queryByText(/^Binding for/)).toBeNull();
    expect(within(rowA).queryByText('not observed below')).toBeNull();
    const rowB = within(tier2).getByRole('button', { name: /^B · US/ });
    expect(within(rowB).getByText('not observed below')).toBeInTheDocument();
    expect(within(rowB).queryByText(/^(binding|inherited)$/)).toBeNull();
    expect(within(rowB).queryByText(/^also under/)).toBeNull();
    // no dot on a row with no band (re-pinned for m-B: a hidden dot has no role to look for)
    expect(rowB.querySelector(':scope > span:empty')).toBeNull();
    const rowC = screen.getByRole('button', { name: /^C · IN/ });
    expect(within(rowC).getByText('also under 1')).toBeInTheDocument();
    rerender(viewOf('flowknit'));
    expect(within(screen.getByRole('button', { name: /^D · TW/ })).getByText('Binding for 2 options')).toBeInTheDocument();
    // a press on a row opens its handle
    const onOpenRow = vi.fn();
    rerender(viewOf('leon', onOpenRow));
    fireEvent.click(screen.getByRole('button', { name: /^A · IT/ }));
    expect(onOpenRow).toHaveBeenCalledWith('A');

    // clause: no aggregates (Arno answered nothing): the render does not throw, and there is no summary and no bar
    unmount();
    expect(() => render(viewOf('arno'))).not.toThrow();
    expect(screen.getByRole('heading', { name: 'Path beneath Arno Pelli' })).toBeInTheDocument();
    expect(screen.queryByText(/responder/)).toBeNull();
    expect(screen.queryByRole('img', { name: /^Utilization below tier 1/ })).toBeNull();

    // clause: no modal band (every count 0): the summary leaves the part out, and there is no bar
    const flowknit = option('flowknit');
    const quiet = { ...flowknit, aggregates: { ...flowknit.aggregates!, utilization: { low: 0, moderate: 0, high: 0, at_capacity: 0 } } };
    cleanup();
    render(<PathBeneath result={result} candidate={quiet} onOpenRow={vi.fn()} />);
    expect(screen.getByText('1 responder · median withheld · 1 country')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Utilization below tier 1/ })).toBeNull();

    // clause: an empty tally: its line reads a dash, and the other line stays
    const classless = { ...flowknit, nodes: flowknit.nodes!.map((n) => ({ ...n, class: null })) };
    cleanup();
    render(<PathBeneath result={result} candidate={classless} onOpenRow={vi.fn()} />);
    expect(screen.getByText('Classes: —')).toBeInTheDocument();
    expect(screen.getByText('Countries: TW (1)')).toBeInTheDocument();

    // clause: not traced below: a node that answers for itself only says so, and never "not observed below"
    const leon = option('leon');
    const traceless = { ...leon, nodes: [...leon.nodes!, { alias: 'G', tier: 2, country: 'DE', class: null, band: null, observed_below: false, not_traced_below: true }] };
    cleanup();
    render(<PathBeneath result={result} candidate={traceless} onOpenRow={vi.fn()} />);
    const rowG = screen.getByRole('button', { name: /^G · DE/ });
    expect(within(rowG).getByText('not traced below (answers for itself only)')).toBeInTheDocument();
    expect(within(rowG).queryByText('not observed below')).toBeNull();

    // clause: a node with no country reads a dash on its row
    const countryless = { ...leon, nodes: [...leon.nodes!, { alias: 'H', tier: 2, country: null, class: null, band: null, observed_below: true }] };
    cleanup();
    render(<PathBeneath result={result} candidate={countryless} onOpenRow={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^H · —/ })).toBeInTheDocument();
  });

  it('keeps clear of the map’s handles and of the disclosure rules (§7, LF-R2)', () => {
    const { container, rerender } = render(viewOf('leon'));
    for (const key of ['leon', 'mekong', 'flowknit']) {
      rerender(viewOf(key));
      // the map's handles are the only elements that carry these, and the map's tier rows the only groups named "Tier N under …"
      expect(container.querySelector('[data-alias], [data-anchor]')).toBeNull();
      const groups = screen.getAllByRole('group');
      for (const g of groups) expect(g.getAttribute('aria-label')).not.toMatch(/^Tier \d+ under /);
      // a count of responders, not a share of them
      expect(container.textContent).not.toContain('%');
    }
  });

  it('keeps its text at 4.5:1 or better on the details panel’s surface, in both themes (§7, F18)', () => {
    // AA pairs (F18): the panel brings its own sm-surface, so the component sits inside sm-root > sm-surface
    const onSurface = (key: string) => <div className="sm-root"><div className="sm-surface">{viewOf(key)}</div></div>;
    const { rerender } = render(onSurface('leon'));
    // sm-btn-ghost on the surface: a row
    expect(smWorstRatio(screen.getByRole('button', { name: /^A · IT/ }))).toBeGreaterThanOrEqual(4.5);
    // sm-muted on the surface: the level tag
    expect(smWorstRatio(screen.getByText('L4'))).toBeGreaterThanOrEqual(4.5);
    // inherited ink on the surface: the summary and a count line
    expect(smWorstRatio(screen.getByText('3 responders · median 14 d · modal utilization low · 3 countries'))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(screen.getByText('Countries: IN (1), IT (1), US (1)'))).toBeGreaterThanOrEqual(4.5);
    // sm-warn on the surface: Binding for N options
    rerender(onSurface('flowknit'));
    expect(smWorstRatio(screen.getByText('Binding for 2 options'))).toBeGreaterThanOrEqual(4.5);
  });
});
