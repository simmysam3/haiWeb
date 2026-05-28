import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VendorExcludeMultiSelect } from '../vendor-exclude-multi-select';

const options = [
  { participant_id: '00000000-0000-0000-0000-000000000010', legal_name: 'Vendor A' },
  { participant_id: '00000000-0000-0000-0000-000000000011', legal_name: 'Vendor B' },
];

describe('VendorExcludeMultiSelect', () => {
  it('renders all options as checkboxes', () => {
    render(<VendorExcludeMultiSelect options={options} value={[]} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Vendor A')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor B')).toBeInTheDocument();
  });
  it('emits selection on toggle', () => {
    const onChange = vi.fn();
    render(<VendorExcludeMultiSelect options={options} value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Vendor A'));
    expect(onChange).toHaveBeenCalledWith(['00000000-0000-0000-0000-000000000010']);
  });
  it('shows already-selected as checked', () => {
    render(
      <VendorExcludeMultiSelect
        options={options}
        value={['00000000-0000-0000-0000-000000000011']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Vendor B')).toBeChecked();
  });
});
