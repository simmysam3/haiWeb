import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import { OptionCard } from '../option-card';

const drops = vomeroResult.portfolio.drops;
const leather = vomeroResult.slots[0]!;

describe('OptionCard', () => {
  it('shows the D-148 pill, limit, lead time, utilization, allocation and one labelled pip per drop with the as-of pip marked, and selects by click, Enter or Space', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected={false} onSelect={onSelect} />);
    const card = screen.getByRole('button', { name: /León Cuero, MX/ });
    expect(card).toHaveAccessibleName('León Cuero, MX: Can cover 5,000 of 12,000 sq ft; Limit: own capacity');
    expect(card).toHaveAttribute('aria-pressed', 'false');
    expect(within(card).getByText('Can cover 5,000 of 12,000 sq ft')).toBeInTheDocument();
    expect(within(card).getByText('Limit: own capacity')).toBeInTheDocument();
    expect(within(card).getByText('38 d lead')).toBeInTheDocument();
    expect(within(card).getByText('At capacity')).toBeInTheDocument();
    expect(within(card).getByText('Allocated 60%')).toBeInTheDocument();
    const pips = within(card).getAllByRole('img');
    expect(pips.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Jan 15: 60% covered', 'Feb 15: 60% covered', 'Mar 15: 41% covered (shown)', 'Apr 15: 46% covered', 'May 15: 49% covered', 'Jun 15: 50% covered',
    ]);
    // Real focus and keys (lane pre-empt): Tab reaches the card, Enter and Space select, Tab does not.
    await user.tab();
    expect(card).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(2);
    // Tab goes last: it moves focus to the Pill inside the card, where a later key would bubble to the card.
    await user.keyboard('{Tab}');
    expect(onSelect).toHaveBeenCalledTimes(2);
    await user.click(card);
    expect(onSelect).toHaveBeenCalledTimes(3);
    rerender(<OptionCard slot={leather} candidate={leather.candidates[0]!} asOfDrop="2027-03-15" drops={drops} selected onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /León Cuero, MX/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
