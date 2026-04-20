import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionFieldChecklist } from '../permission-field-checklist';

describe('PermissionFieldChecklist', () => {
  it('renders all 13 canonical fields', () => {
    render(<PermissionFieldChecklist value={[]} onChange={() => {}} />);
    expect(screen.getByLabelText(/facility_country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/manufacturing_date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provenance_depth/i)).toBeInTheDocument();
    // Count all checkboxes
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(13);
  });

  it('reflects current value — selected fields are checked', () => {
    render(
      <PermissionFieldChecklist
        value={['facility_country', 'manufacturing_date']}
        onChange={() => {}}
      />,
    );
    const country = screen.getByLabelText(/facility_country/i) as HTMLInputElement;
    const mdate = screen.getByLabelText(/manufacturing_date/i) as HTMLInputElement;
    const region = screen.getByLabelText(/facility_region/i) as HTMLInputElement;
    expect(country.checked).toBe(true);
    expect(mdate.checked).toBe(true);
    expect(region.checked).toBe(false);
  });

  it('calls onChange with the next selection when a field is toggled on', async () => {
    const onChange = vi.fn();
    render(<PermissionFieldChecklist value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/facility_country/i));
    expect(onChange).toHaveBeenCalledWith(['facility_country']);
  });

  it('calls onChange with the field removed when toggled off', async () => {
    const onChange = vi.fn();
    render(
      <PermissionFieldChecklist value={['facility_country']} onChange={onChange} />,
    );
    await userEvent.click(screen.getByLabelText(/facility_country/i));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disables fields listed in readOnly', () => {
    render(
      <PermissionFieldChecklist
        value={['facility_country']}
        readOnly={['facility_country']}
        onChange={() => {}}
      />,
    );
    const country = screen.getByLabelText(/facility_country/i) as HTMLInputElement;
    expect(country.disabled).toBe(true);
  });
});
