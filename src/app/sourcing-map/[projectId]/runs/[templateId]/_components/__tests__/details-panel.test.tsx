import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vomeroResult, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { DetailsPanel } from '../details-panel';

const NAMES = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };

describe('DetailsPanel', () => {
  it('shows coverage per drop and per size, lead time, utilization, allocation and the products using the slot', () => {
    const onClose = vi.fn();
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={onClose} />);
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
});
