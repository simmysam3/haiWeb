import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantAxisEditor } from '../variant-axis-editor';

describe('VariantAxisEditor', () => {
  it("applies a preset, toggles half sizes, and clears to no axis", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VariantAxisEditor axis={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Variant preset'), { target: { value: 'mens_us_6_15' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ system: "Men's US", values: expect.arrayContaining(['9.5']) }));
    const axis = onChange.mock.lastCall![0];
    rerender(<VariantAxisEditor axis={axis} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Half sizes'));
    expect(onChange.mock.lastCall![0].values).toHaveLength(10);
    fireEvent.change(screen.getByLabelText('Variant preset'), { target: { value: 'none' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('starts a custom axis and edits its name, system and comma-separated values (spec §7.2)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<VariantAxisEditor axis={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Variant preset'), { target: { value: 'custom' } });
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Variant', system: null, values: ['A'] });
    const width = { name: 'Width', system: null, values: ['N', 'W'] };
    rerender(<VariantAxisEditor axis={width} onChange={onChange} />);
    expect(screen.getByLabelText('Variant preset')).toHaveValue('custom');
    fireEvent.change(screen.getByLabelText('Axis name'), { target: { value: 'Fit' } });
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Fit', system: null, values: ['N', 'W'] });
    fireEvent.change(screen.getByLabelText('System'), { target: { value: 'EU' } });
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Width', system: 'EU', values: ['N', 'W'] });
    fireEvent.change(screen.getByLabelText('Values (comma separated)'), { target: { value: 'N, M, , W' } });
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Width', system: null, values: ['N', 'M', 'W'] });
  });
});
