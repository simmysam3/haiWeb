import { describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { compareDetail } from '@/app/sourcing-map/__fixtures__/lf';
import { smWorstRatio } from '@/test/contrast';
import { CompareStrip } from '../compare-strip';

const mt = multitierDetail.result!;
const DROP = '2027-03-15';
const leather = mt.slots[0]!;
const [leon, mekong, arno] = leather.candidates as [typeof leather.candidates[0], typeof leather.candidates[0], typeof leather.candidates[0]];
const strip = (pinned: { slot: typeof leather; candidate: typeof leon }, active: { slot: typeof leather; candidate: typeof leon }, onUnpin = vi.fn()) => (
  <CompareStrip pinned={pinned} active={active} asOfDrop={DROP} onUnpin={onUnpin} />
);

/** The cells of the row named `label`, as text, one per column */
const cellsOf = (label: string) => within(screen.getByRole('rowheader', { name: label }).closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
const FIVE = ['Coverage', 'Responders', 'Median', 'Modal band', 'Binding source'];

describe('CompareStrip', () => {
  it('sets the pinned card against the active one in six rows, names the slot only when the two differ, and offers Unpin (§6.7)', () => {
    render(strip({ slot: leather, candidate: leon }, { slot: leather, candidate: mekong }));
    // the two cards sit in one slot: the headers name the suppliers alone
    expect(screen.getByText('León Cuero (pinned)')).toBeInTheDocument();
    expect(screen.getByText('Mekong Tannery')).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Coverage', 'Responders', 'Median', 'Modal band', 'Binding source', 'Shared sources']);
    // every header cell carries its scope: the two column headers, then the six row headers (the parked `<th>`-without-scope finding)
    expect(Array.from(document.querySelectorAll('th')).map((th) => th.getAttribute('scope'))).toEqual(['col', 'col', ...Array(6).fill('row')]);
    expect(FIVE.map(cellsOf)).toEqual([['50%', '100%'], ['3', '3'], ['14 d', '14 d'], ['low', 'low'], ['A · tier 2 · moderate', '—']]);
    // the shared sources are one cell across both columns
    expect(cellsOf('Shared sources')).toEqual(['A, C']);
    expect(screen.getByRole('rowheader', { name: 'Shared sources' }).closest('tr')!.querySelector('td')).toHaveAttribute('colspan', '2');

    // a card with nothing beneath it, as the active one: its own gap words and dashes, and nothing shared
    cleanup();
    render(strip({ slot: leather, candidate: leon }, { slot: leather, candidate: arno }));
    expect(FIVE.map(cellsOf)).toEqual([['50%', 'No answer · timeout'], ['3', '—'], ['14 d', '—'], ['low', '—'], ['A · tier 2 · moderate', '—']]);
    expect(cellsOf('Shared sources')).toEqual(['none']);

    // two cards in different slots: each header names its slot
    cleanup();
    const onUnpin = vi.fn();
    const slots = compareDetail.result!.slots;
    const compareLeon = slots[0]!.candidates[0]!;
    render(strip({ slot: slots[0]!, candidate: compareLeon }, { slot: slots[1]!, candidate: slots[1]!.candidates[0]! }, onUnpin));
    expect(screen.getByText('León Cuero (pinned) · Full grain leather hides')).toBeInTheDocument();
    expect(screen.getByText('FlowKnit Mills · Polyester knit uppers')).toBeInTheDocument();

    // Unpin sits on the pinned card's header only, named for that card
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Unpin León Cuero' }));
    expect(onUnpin).toHaveBeenCalledTimes(1);
  });

  it('keeps its text at 4.5:1 or better on the details panel’s surface, in both themes (§6.7, F18)', () => {
    // AA pairs (F18): the panel brings its own sm-surface, so the strip sits inside sm-root > sm-surface
    render(<div className="sm-root"><div className="sm-surface">{strip({ slot: leather, candidate: leon }, { slot: leather, candidate: mekong })}</div></div>);
    // inherited ink on the surface: a column header, a row header and a cell (the reader reads a .sm-table header as ink)
    expect(smWorstRatio(screen.getByText('Mekong Tannery'))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(screen.getByRole('rowheader', { name: 'Coverage' }))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(screen.getByText('A, C'))).toBeGreaterThanOrEqual(4.5);
    // sm-btn-ghost on the surface: Unpin
    expect(smWorstRatio(screen.getByRole('button', { name: 'Unpin León Cuero' }))).toBeGreaterThanOrEqual(4.5);
  });
});
