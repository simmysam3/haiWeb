import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { CANDIDATE_NAMES, multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { smWorstRatio } from '@/test/contrast';
import { HandlePanel } from '../handle-panel';

const leon = multitierDetail.result!.slots[0]!.candidates[0]!;
const A = leon.nodes![0]!;
const C = leon.nodes![2]!;

describe('HandlePanel', () => {
  it('shows alias, tier, country, the floored class with its level, the band, the trace role, the other options it supplies, and the disclosure sentence; focus lands on the heading (spec §12.4)', () => {
    const onClose = vi.fn();
    render(<HandlePanel node={{ ...A, under: ['leon', 'mekong'] }} origin="leon" candidateNames={CANDIDATE_NAMES} trace={{ role: 'binding', binds_for: 1 }} onClose={onClose} />);
    const panel = screen.getByRole('complementary', { name: 'Details for supplier A' });
    const heading = within(panel).getByRole('heading', { name: 'Supplier A · tier 2' });
    expect(document.activeElement).toBe(heading);
    expect(within(panel).getByText('IT')).toBeInTheDocument();
    expect(within(panel).getByText('Dyes · shown at level 4 of 4')).toBeInTheDocument();
    expect(within(panel).getByRole('img', { name: 'moderate' }).style.background).toBe('var(--sm-heat-mid)');
    expect(within(panel).getByText('moderate')).toBeInTheDocument();
    expect(within(panel).getByText('binding')).toBeInTheDocument();
    expect(within(panel).getByText('Also supplies: Mekong Tannery')).toBeInTheDocument();
    expect(within(panel).getByText('Identity, quantities and names below tier 1 are not disclosed.')).toBeInTheDocument();
    expect(panel.textContent).not.toMatch(/Vetta|[0-9a-f]{8}-|\d[\d,.]{3,}/);
    fireEvent.click(within(panel).getByRole('button', { name: 'Close handle details' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves Escape to the workspace: a press inside the panel calls nothing (§6.5)', () => {
    const onClose = vi.fn();
    render(<HandlePanel node={{ ...A, under: ['leon'] }} origin="leon" candidateNames={CANDIDATE_NAMES} trace={null} onClose={onClose} />);
    // present control: focus is on the heading once the panel opens (R1), so the key lands inside the panel
    const heading = within(screen.getByRole('complementary', { name: 'Details for supplier A' })).getByRole('heading', { name: 'Supplier A · tier 2' });
    expect(heading).toHaveFocus();
    fireEvent.keyDown(heading, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('omits the band and trace rows when the node is not short or not on the trace, names every option when opened from the limits list, and says "Binding for N options"', () => {
    const { rerender } = render(<HandlePanel node={{ ...C, under: ['leon', 'mekong'] }} origin="mekong" candidateNames={CANDIDATE_NAMES} trace={null} onClose={vi.fn()} />);
    let panel = screen.getByRole('complementary', { name: 'Details for supplier C' });
    expect(within(panel).getByText('Colorants · shown at level 2 of 4')).toBeInTheDocument();
    expect(within(panel).getByText('IN')).toBeInTheDocument();
    expect(within(panel).queryByText('Band')).toBeNull();
    expect(within(panel).queryByText('Trace')).toBeNull();
    expect(within(panel).getByText('Also supplies: León Cuero')).toBeInTheDocument();
    rerender(<HandlePanel node={{ ...A, under: ['leon', 'mekong'] }} origin={null} candidateNames={CANDIDATE_NAMES} trace={{ role: 'binding', binds_for: 2 }} onClose={vi.fn()} />);
    panel = screen.getByRole('complementary', { name: 'Details for supplier A' });
    expect(within(panel).getByText('Also supplies: León Cuero, Mekong Tannery')).toBeInTheDocument();
    expect(within(panel).getByText('binding · Binding for 2 options')).toBeInTheDocument();
    rerender(<HandlePanel node={{ alias: 'E', tier: 2, country: null, class: null, band: null, observed_below: true, under: ['zephyr'] }} origin="zephyr" candidateNames={CANDIDATE_NAMES} trace={null} onClose={vi.fn()} />);
    panel = screen.getByRole('complementary', { name: 'Details for supplier E' });
    expect(within(panel).getAllByText(String.fromCharCode(0x2014))).toHaveLength(2);
    expect(within(panel).queryByText(/^Also supplies/)).toBeNull();
  });

  it('says "not traced below (answers for itself only)" for a node flagged not_traced_below, and only for it (G-5)', () => {
    const copy = 'not traced below (answers for itself only)';
    const { rerender } = render(<HandlePanel node={{ ...A, not_traced_below: true, under: ['leon'] }} origin="leon" candidateNames={CANDIDATE_NAMES} trace={null} onClose={vi.fn()} />);
    expect(within(screen.getByRole('complementary')).getByText(copy)).toBeInTheDocument();
    rerender(<HandlePanel node={{ ...A, under: ['leon'] }} origin="leon" candidateNames={CANDIDATE_NAMES} trace={null} onClose={vi.fn()} />);
    expect(screen.queryByText(copy)).toBeNull();
  });

  it('says "Also at tier M under <options>" after its facts, once per other tier, and nothing without one', () => {
    const props = { node: { ...C, under: ['leon', 'mekong'] }, origin: 'leon', candidateNames: CANDIDATE_NAMES, trace: null, onClose: vi.fn() };
    const { rerender } = render(<HandlePanel {...props} otherTiers={[{ tier: 2, names: ['Mekong Tannery'] }]} />);
    let panel = screen.getByRole('complementary', { name: 'Details for supplier C' });
    const line = within(panel).getByText('Also at tier 2 under Mekong Tannery');
    expect(line.tagName).toBe('P');
    // after the facts
    // (exactly FOLLOWING: a line inside the list would also be CONTAINED_BY)
    expect(panel.querySelector('dl')!.compareDocumentPosition(line)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // every option at that tier, then one line per tier
    rerender(<HandlePanel {...props} otherTiers={[{ tier: 2, names: ['Mekong Tannery', 'Bowline Trim'] }, { tier: 4, names: ['Arno Pelli'] }]} />);
    panel = screen.getByRole('complementary', { name: 'Details for supplier C' });
    expect(within(panel).getByText('Also at tier 2 under Mekong Tannery, Bowline Trim')).toBeInTheDocument();
    expect(within(panel).getByText('Also at tier 4 under Arno Pelli')).toBeInTheDocument();
    // no other tier: no line, given an empty list or none at all
    rerender(<HandlePanel {...props} otherTiers={[]} />);
    expect(screen.queryByText(/^Also at tier/)).toBeNull();
    rerender(<HandlePanel {...props} />);
    expect(screen.queryByText(/^Also at tier/)).toBeNull();
  });

  it('the "Also at tier" line clears 4.5:1 on the panel surface in both themes', () => {
    // AA pairs (F18): inherited ink on the surface (the panel brings its own sm-surface)
    render(<div className="sm-root"><HandlePanel node={{ ...C, under: ['leon', 'mekong'] }} origin="leon" candidateNames={CANDIDATE_NAMES} trace={null} otherTiers={[{ tier: 2, names: ['Mekong Tannery'] }]} onClose={vi.fn()} /></div>);
    expect(smWorstRatio(screen.getByText('Also at tier 2 under Mekong Tannery'))).toBeGreaterThanOrEqual(4.5);
  });
});
