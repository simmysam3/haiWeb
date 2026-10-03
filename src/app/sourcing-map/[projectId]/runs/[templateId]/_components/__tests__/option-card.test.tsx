import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import { multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { notTracedDetail } from '@/app/sourcing-map/__fixtures__/sp3';
import { OptionCard } from '../option-card';

const drops = vomeroResult.portfolio.drops;
const leather = vomeroResult.slots[0]!;

describe('OptionCard', () => {
  it('shows the D-148 pill, limit, lead time, utilization, allocation and one labelled pip per drop with the as-of pip marked, all outside a named selecting button that Tab reaches and Enter or Space press', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: /León Cuero, MX/ });
    expect(button).toHaveAccessibleName('León Cuero, MX: States 5,000 of 12,000 sq ft; Short · cause not traced');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    const content = [
      screen.getByText('States 5,000 of 12,000 sq ft'),
      screen.getByText('Short · cause not traced'),
      screen.getByText('38 d lead'),
      screen.getByText('At capacity'),
      screen.getByText('Allocated 60%'),
    ];
    const pips = screen.getAllByRole('img');
    expect(pips.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Jan 15: 60% covered', 'Feb 15: 60% covered', 'Mar 15: 41% covered (shown)', 'Apr 15: 46% covered', 'May 15: 49% covered', 'Jun 15: 50% covered',
    ]);
    // Controller ruling F-a: a role="button" makes its children presentational, so the card's content is ordinary
    // readable content outside the button, and no focusable element nests inside another.
    for (const el of [...content, ...pips, ...screen.getAllByTestId('pill')]) expect(button).not.toContainElement(el);
    expect(button.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
    // Real focus and keys (lane pre-empt): Tab reaches the button; Enter, Space and a click each select once.
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(2);
    // Tab moves on to the D-148 Pill, which sits outside the button, and moving focus does not select.
    await user.tab();
    expect(screen.getAllByTestId('pill')[0]).toHaveFocus();
    expect(onSelect).toHaveBeenCalledTimes(2);
    await user.click(button);
    expect(onSelect).toHaveBeenCalledTimes(3);
    rerender(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /León Cuero, MX/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects on a mouse click anywhere on the card surface, and exactly once per click on its button (ruling F-a)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={onSelect} />);
    await user.click(screen.getByText('Allocated 60%'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.click(screen.getAllByRole('img')[0]!);
    expect(onSelect).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: /León Cuero, MX/ }));
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it('leaves a click, Enter or Space on a Pill to the Pill: none of them selects the card (ruling F-a)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={onSelect} />);
    const [availabilityPill, utilizationPill] = screen.getAllByTestId('pill');
    await user.click(availabilityPill!);
    expect(availabilityPill).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(utilizationPill!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks a selected card by a heavier border, not by colour alone, on a normal card and on a gap card (ruling F-b)', () => {
    // The width cue differs from the focus indicator, an outline on the button (sourcing-map.css:4).
    for (const candidate of [leather.candidates[0]!, leather.candidates[2]!]) {
      const { rerender, unmount } = render(<OptionCard slot={leather} candidate={candidate} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
      const card = screen.getByRole('button').closest<HTMLElement>('.sm-card')!;
      expect(card.style.borderWidth).toBe('');
      rerender(<OptionCard slot={leather} candidate={candidate} asOfDrop="2027-03-15" drops={drops} selected onSelect={vi.fn()} />);
      expect(card.style.borderWidth).toBe('2px');
      if (candidate === leather.candidates[2]) expect(card.style.borderStyle).toBe('dashed');
      unmount();
    }
  });

  it('renders a gap as itself with a dashed border, and an allocation-only answer as such (AC 15, spec §8.4)', () => {
    const arno = leather.candidates[2]!;
    const { unmount } = render(<OptionCard slot={leather} candidate={arno} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
    // The card surface is the element that carries .sm-card (sourcing-map.css:6); its button names it.
    const card = screen.getByRole('button', { name: 'Arno Pelli, IT: No answer · timeout' }).closest<HTMLElement>('.sm-card')!;
    expect(card.className).toContain('border-dashed');
    // .sm-card (sourcing-map.css:6) is unlayered and its `border` shorthand beats the layered utility, so the dash is inline too.
    expect(card.style.borderStyle).toBe('dashed');
    expect(within(card).queryByText(/^States /)).toBeNull();
    expect(within(card).getByText('Not allocated')).toBeInTheDocument();
    expect(within(card).getAllByRole('img').every((p) => p.getAttribute('aria-label')!.includes('no answer'))).toBe(true);
    unmount();
    render(<OptionCard slot={leather} candidate={{ ...leather.candidates[0]!, answered_at_allocation: true, spare_unknown: true }} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Answered at its allocation · spare capacity unknown')).toBeInTheDocument();
  });

  it('defines the availability pill in plain words, never with an internal register id (L296)', () => {
    render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
    const pill = screen.getAllByTestId('pill')[0]!;
    expect(pill).toHaveAccessibleDescription("The supplier's answer at this drop, never more than you asked. Covers 41% of the ask, below the 70% threshold.");
    expect(document.body).not.toHaveTextContent('D-148');
  });

  it('keeps the plain definition alone where the pill grades nothing (not probed at this trust level)', () => {
    render(<OptionCard slot={leather} candidate={{ ...leather.candidates[0]!, availability_form: 'not_probed_trust' }} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
    const pill = screen.getAllByTestId('pill')[0]!;
    expect(pill).toHaveTextContent('Not probed at this trust level');
    expect(pill).toHaveAccessibleDescription("The supplier's answer at this drop, never more than you asked.");
  });

  const leather2 = multitierDetail.result!.slots[0]!;
  const drops2 = multitierDetail.result!.portfolio.drops;

  it('reads the tiered reason and "not fully observed below tier N" on an SP2 card, both in the selecting button’s name (spec §12.2)', () => {
    const leon2 = leather2.candidates[0]!;
    const { rerender } = render(<OptionCard slot={leather2} candidate={leon2} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Limit: constraint returned by current source, tier 2')).toBeInTheDocument();
    expect(screen.getByText('not fully observed below tier 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /León Cuero, MX/ })).toHaveAccessibleName(
      'León Cuero, MX: States 6,000 of 12,000 sq ft; Limit: constraint returned by current source, tier 2; not fully observed below tier 2',
    );
    rerender(<OptionCard slot={leather2} candidate={{ ...leon2, limit: 'both', observed_below: true, unobserved_from_tier: null }} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Limit: own capacity and tier 2 source')).toBeInTheDocument();
    expect(screen.queryByText(/not fully observed/)).toBeNull();
    expect(screen.getByRole('button', { name: /León Cuero, MX/ })).toHaveAccessibleName('León Cuero, MX: States 6,000 of 12,000 sq ft; Limit: own capacity and tier 2 source');
    const zephyr2 = multitierDetail.result!.slots[3]!.candidates[0]!;
    rerender(<OptionCard slot={multitierDetail.result!.slots[3]!} candidate={zephyr2} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Limit: own capacity')).toBeInTheDocument();
  });

  const NOT_TRACED = 'not traced below (answers for itself only)';
  const notTracedSlot = notTracedDetail.result!.slots[0]!;
  const notTracedDrops = notTracedDetail.result!.portfolio.drops;

  it('says "not traced below (answers for itself only)" in place of the unobserved note on a card that does not traverse (G-5)', () => {
    render(<OptionCard slot={notTracedSlot} candidate={notTracedSlot.candidates[0]!} asOfDrop="2027-03-15" drops={notTracedDrops} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText(NOT_TRACED)).toBeInTheDocument();
    expect(screen.queryByText(/not fully observed/)).toBeNull();
  });

  it('ends the selecting button’s name with the not-traced copy, never the unobserved clause (G-5)', () => {
    render(<OptionCard slot={notTracedSlot} candidate={notTracedSlot.candidates[0]!} asOfDrop="2027-03-15" drops={notTracedDrops} selected={false} onSelect={vi.fn()} />);
    const name = screen.getByRole('button', { name: /León Cuero, MX/ }).getAttribute('aria-label')!;
    expect(name.endsWith(`; ${NOT_TRACED}`)).toBe(true);
    expect(name).not.toMatch(/not fully observed/);
  });

  it('leaves every other card alone: Mekong shows no note beside a not-traced León, and SP2’s León still reads "not fully observed below tier 2" (G-5)', () => {
    const { rerender } = render(<OptionCard slot={notTracedSlot} candidate={notTracedSlot.candidates[1]!} asOfDrop="2027-03-15" drops={notTracedDrops} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(NOT_TRACED)).toBeNull();
    expect(screen.queryByText(/not fully observed/)).toBeNull();
    rerender(<OptionCard slot={leather2} candidate={leather2.candidates[0]!} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('not fully observed below tier 2')).toBeInTheDocument();
    expect(screen.queryByText(NOT_TRACED)).toBeNull();
  });

  const UTIL_NAME = 'Utilization below tier 1: 1 low · 1 moderate · 0 high · 1 at capacity';
  const leon2 = leather2.candidates[0]!;

  it('summarises what is beneath on the card face: the responders and median, a utilization bar of the non-zero bands, and the "Select to trace" cue (A4)', () => {
    render(<OptionCard slot={leather2} candidate={leon2} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('3 responders · median 14 d')).toBeInTheDocument();
    const bar = screen.getByRole('img', { name: UTIL_NAME });
    const segments = [...bar.children] as HTMLElement[];
    expect(segments.map((el) => el.getAttribute('data-util'))).toEqual(['low', 'moderate', 'at_capacity']);
    expect(segments.map((el) => el.style.flexGrow)).toEqual(['1', '1', '1']);
    expect(segments[2]!.style.background).toBe('var(--sm-pill-problem-fg)');
    expect(screen.getByText('Select to trace')).toBeInTheDocument();
  });

  it('drops the cue once the card is selected and traced (A4)', () => {
    render(<OptionCard slot={leather2} candidate={leon2} asOfDrop="2027-03-15" drops={drops2} selected traced onSelect={vi.fn()} />);
    expect(screen.getByText('3 responders · median 14 d')).toBeInTheDocument();
    expect(screen.queryByText('Select to trace')).toBeNull();
  });

  it('shows the summary but no cue on a card with nothing to trace (A4)', () => {
    const mekong2 = leather2.candidates[1]!;
    expect(mekong2.trace).toBeNull();
    render(<OptionCard slot={leather2} candidate={mekong2} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('3 responders · median 14 d')).toBeInTheDocument();
    expect(screen.queryByText('Select to trace')).toBeNull();
  });

  it('draws no bar when every utilization count is 0, and none on a gap card (A4)', () => {
    const zero = { ...leon2, aggregates: { ...leon2.aggregates!, utilization: { low: 0, moderate: 0, high: 0, at_capacity: 0 } } };
    const { rerender } = render(<OptionCard slot={leather2} candidate={zero} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('3 responders · median 14 d')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Utilization below tier 1/ })).toBeNull();
    rerender(<OptionCard slot={leather2} candidate={leather2.candidates[2]!} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByRole('img', { name: /^Utilization below tier 1/ })).toBeNull();
    expect(screen.queryByText(/responder/)).toBeNull();
  });

  it('renders the tier rows under the card; a handle click selects the alias, never the card (ruling F-a), and hover reaches the card’s handler', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSelectAlias = vi.fn();
    const onHoverAlias = vi.fn();
    render(<OptionCard slot={leather2} candidate={leather2.candidates[0]!} asOfDrop="2027-03-15" drops={drops2} selected={false} onSelect={onSelect} onSelectAlias={onSelectAlias} onHoverAlias={onHoverAlias} hoveredAlias="C" />);
    expect(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tier 3 under León Cuero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^C · IN/ })).toHaveAttribute('data-lit', 'true');
    await user.click(screen.getByRole('button', { name: /^A · IT · Dyes/ }));
    expect(onSelectAlias).toHaveBeenCalledWith('A', 'leon');
    expect(onHoverAlias).toHaveBeenCalledWith('A');
    expect(onSelect).not.toHaveBeenCalled();
    // the tier rows sit outside the selecting button (F-a: nothing focusable nests in it)
    const button = screen.getByRole('button', { name: /León Cuero, MX/ });
    expect(button.querySelector('[data-anchor]')).toBeNull();
  });

  it('keeps the SP1 words and draws no tier rows or observation note for an SP1 candidate (Review Focus 1)', () => {
    render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Short · cause not traced')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Tier \d/ })).toBeNull();
    expect(screen.queryByText(/not fully observed below/)).toBeNull();
  });
});
