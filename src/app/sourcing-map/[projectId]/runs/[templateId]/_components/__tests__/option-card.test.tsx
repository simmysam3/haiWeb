import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import { OptionCard } from '../option-card';

const drops = vomeroResult.portfolio.drops;
const leather = vomeroResult.slots[0]!;

describe('OptionCard', () => {
  it('shows the D-148 pill, limit, lead time, utilization, allocation and one labelled pip per drop with the as-of pip marked, all outside a named selecting button that Tab reaches and Enter or Space press', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: /León Cuero, MX/ });
    expect(button).toHaveAccessibleName('León Cuero, MX: Can cover 5,000 of 12,000 sq ft; Limit: own capacity');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    const content = [
      screen.getByText('Can cover 5,000 of 12,000 sq ft'),
      screen.getByText('Limit: own capacity'),
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
    expect(within(card).queryByText(/Can cover|Covers full/)).toBeNull();
    expect(within(card).getByText('Not allocated')).toBeInTheDocument();
    expect(within(card).getAllByRole('img').every((p) => p.getAttribute('aria-label')!.includes('no answer'))).toBe(true);
    unmount();
    render(<OptionCard slot={leather} candidate={{ ...leather.candidates[0]!, answered_at_allocation: true, spare_unknown: true }} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Answered at its allocation · spare capacity unknown')).toBeInTheDocument();
  });

  it('defines the availability pill in plain words, never with an internal register id (L296)', () => {
    render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={vi.fn()} />);
    const pill = screen.getAllByTestId('pill')[0]!;
    expect(pill).toHaveAccessibleDescription("The supplier's answer at this drop, never more than you asked.");
    expect(document.body).not.toHaveTextContent('D-148');
  });
});

