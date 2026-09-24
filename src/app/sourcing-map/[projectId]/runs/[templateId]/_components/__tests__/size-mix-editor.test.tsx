import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { mixTotalsHundred, type SmMix } from '@/lib/sourcing-map/contract';
import { pairsFromMix } from '@/lib/sourcing-map/demand-math';
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

  it('edits by pairs and re-derives the percentage mix from them', () => {
    const onChange = vi.fn();
    const axis = { name: 'Size', system: "Men's US", values: ['9', '10'] };
    render(<SizeMixEditor axis={axis} mix={{ '9': 50, '10': 50 }} totalQty={1000} curve={null} label="Court Classic" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Edit by pairs' }));
    expect(screen.getByLabelText('9 pairs')).toHaveValue(500);
    fireEvent.change(screen.getByLabelText('10 pairs'), { target: { value: '1000' } });
    expect(onChange).toHaveBeenLastCalledWith({ '9': 33.33, '10': 66.67 }, null);
  });

  it('in pairs mode a typed count stays as typed while the mix follows it; Generate curve re-seeds the pairs (Task 34 fix I-2)', () => {
    const axis = { name: 'Size', system: "Men's US", values: ['9', '10'] };
    const emitted: SmMix[] = [];
    // A stateful parent, as the demand editor is: each emitted mix comes back as the prop.
    function Harness() {
      const [mix, setMix] = useState<SmMix | null>({ '9': 50, '10': 50 });
      return <SizeMixEditor axis={axis} mix={mix} totalQty={1000} curve={null} label="Court Classic" onChange={(m) => { emitted.push(m); setMix(m); }} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Edit by pairs' }));
    const ten = screen.getByLabelText('10 pairs');
    fireEvent.change(ten, { target: { value: '501' } }); // ArrowUp from 500
    expect(ten).toHaveValue(501);
    expect(screen.getByLabelText('9 pairs')).toHaveValue(500);
    expect(emitted.at(-1)).toEqual({ '9': 49.95, '10': 50.05 });
    for (const typed of ['1', '10', '100', '1000']) fireEvent.change(ten, { target: { value: typed } }); // typed key by key
    expect(ten).toHaveValue(1000);
    expect(emitted.at(-1)).toEqual({ '9': 33.33, '10': 66.67 });
    fireEvent.click(screen.getByRole('button', { name: 'Generate curve' }));
    const curve = emitted.at(-1)!;
    expect(curve).not.toEqual({ '9': 33.33, '10': 66.67 });
    expect(ten).toHaveValue(pairsFromMix(1000, curve, axis.values)['10']);
    expect(screen.getByLabelText('9 pairs')).toHaveValue(pairsFromMix(1000, curve, axis.values)['9']);
  });
});
