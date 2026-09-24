import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mixTotalsHundred } from '@/lib/sourcing-map/contract';
import { vomeroWorkbenchDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SizeMixEditor } from '../size-mix-editor';

const AXIS = vomeroWorkbenchDetail.variant_axis!;

describe('SizeMixEditor', () => {
  it('generates the curve to exactly 100%, accepts 99.99%, flags 99.98% as the server would, and Normalize fixes it (Review Focus 3, d-G7)', () => {
    const onChange = vi.fn();
    // Measured in IEEE doubles, for the odd value in any key position:
    // 12 × 7.69 + 7.71 sums to 99.98999999999998 or 99.99 (9999 hundredths, accepted);
    // 12 × 7.69 + 7.70 sums to 99.97999999999999 (9998 hundredths, rejected).
    const flat = Object.fromEntries(AXIS.values.map((v) => [v, 7.69]));
    const accepted = { ...flat, '13': 7.71 };
    const typed = { ...flat, '13': 7.70 };
    const { rerender } = render(<SizeMixEditor axis={AXIS} mix={null} totalQty={36000} curve={null} label="Pegasus Trail" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate curve' }));
    const generated = onChange.mock.lastCall![0];
    expect(mixTotalsHundred(generated)).toBe(true);
    rerender(<SizeMixEditor axis={AXIS} mix={accepted} totalQty={36000} curve={null} label="Pegasus Trail" onChange={onChange} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Total 99.99%')).toBeInTheDocument();
    rerender(<SizeMixEditor axis={AXIS} mix={typed} totalQty={36000} curve={null} label="Pegasus Trail" onChange={onChange} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Total 99.98% — the mix must total 100%');
    fireEvent.click(screen.getByRole('button', { name: 'Normalize to 100%' }));
    expect(mixTotalsHundred(onChange.mock.lastCall![0])).toBe(true);
  });
});
