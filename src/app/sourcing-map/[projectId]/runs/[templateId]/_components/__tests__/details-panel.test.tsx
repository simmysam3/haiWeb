import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vomeroResult, runningDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SM_UNCLASSIFIED_CLASS_PREFIX } from '@/lib/sourcing-map/contract';
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

  it('moves focus to its heading when it opens (controller ruling R1)', () => {
    const leather = vomeroResult.slots[0]!;
    render(<DetailsPanel slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const panel = screen.getByRole('complementary', { name: 'Details for León Cuero' });
    expect(document.activeElement).toBe(within(panel).getByRole('heading', { name: 'León Cuero · MX' }));
  });

  it('titles an unclassified slot as its rail does, "Unclassified · <component>" (ruling R4, contract §10)', () => {
    const drops = vomeroResult.portfolio.drops;
    const leather = vomeroResult.slots[0]!;
    // present control: a classified slot keeps its class label, with no prefix
    const { unmount } = render(<DetailsPanel slot={leather} candidate={leather.candidates[0]!} drops={drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(screen.getByText('Full grain leather hides · LC-BOV-UP-01')).toBeInTheDocument();
    unmount();
    const laces = structuredCloneSafe(vomeroResult.slots[4]!);
    laces.slot_key = { ...laces.slot_key, class_id: `${SM_UNCLASSIFIED_CLASS_PREFIX}${VOMERO_IDS.bowline}:BW-LACE-137` };
    laces.class_label = 'Flat lace 137 cm';
    laces.class_path = [];
    laces.candidates = [{ ...laces.candidates[0]!, pinned: true }];
    render(<DetailsPanel slot={laces} candidate={laces.candidates[0]!} drops={drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const panel = screen.getByRole('complementary', { name: 'Details for Bowline Cordage' });
    expect(within(panel).getByText('Unclassified · Flat lace 137 cm · BW-LACE-137')).toBeInTheDocument();
  });

  it('a drop with no need week yet reads "No demand yet", never "no answer" (fix round 1, I-1; AC 17)', () => {
    const leather = structuredCloneSafe(vomeroResult.slots[0]!);
    leather.as_of_weeks[0]!.week = null;
    render(<DetailsPanel slot={leather} candidate={leather.candidates[0]!} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
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
    render(<DetailsPanel slot={leather} candidate={mekong} drops={result.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    expect(within(screen.getByRole('table', { name: 'Coverage by drop' })).getByRole('row', { name: 'Mar 15' })).toHaveTextContent('Mar 15Feb 2212,000—Probing');
    expect(within(screen.getByRole('table', { name: 'Coverage by size at Feb 22' })).getByRole('row', { name: '9' })).toHaveTextContent('91,571—Probing');
  });

  it('a candidate not probed at this trust level says so, as its card does, never "no answer" (fix round 1, I-1)', () => {
    const leather = vomeroResult.slots[0]!;
    const notProbed = { ...leather.candidates[1]!, availability_form: 'not_probed_trust' as const, weeks: [] };
    render(<DetailsPanel slot={leather} candidate={notProbed} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
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
    render(<DetailsPanel slot={leather} candidate={leon} drops={vomeroResult.portfolio.drops} asOfDrop="2027-03-15" productNames={NAMES} onClose={vi.fn()} />);
    const perSize = screen.getByRole('table', { name: 'Coverage by size at Feb 22' });
    expect(within(perSize).getByRole('row', { name: '13' })).toHaveTextContent('1300100%');
    expect(within(perSize).getByRole('row', { name: '12.5' })).toHaveTextContent('12.505100%');
    expect(perSize.textContent).not.toMatch(/NaN|Infinity/);
  });
});

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
