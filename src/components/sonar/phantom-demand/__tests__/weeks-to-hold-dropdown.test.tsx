import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WeeksToHoldDropdown } from '../weeks-to-hold-dropdown';

describe('WeeksToHoldDropdown', () => {
  it('renders 12 options 1..12', () => {
    render(<WeeksToHoldDropdown value={1} onChange={vi.fn()} />);
    const select = screen.getByRole('combobox');
    expect(select.querySelectorAll('option')).toHaveLength(12);
  });
  it('emits new value on change', () => {
    const onChange = vi.fn();
    render(<WeeksToHoldDropdown value={1} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
