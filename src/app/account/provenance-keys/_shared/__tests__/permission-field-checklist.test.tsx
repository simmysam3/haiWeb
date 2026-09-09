import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionFieldChecklist } from '../permission-field-checklist';

describe('PermissionFieldChecklist', () => {
  it('renders all 9 canonical fields — the five Step-1 fields and the four D-218 dimension fields', () => {
    render(<PermissionFieldChecklist value={[]} onChange={() => {}} />);
    expect(screen.getByLabelText(/state_province/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plant_address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plant_identifier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vendor_name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/design_entity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/design_site/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/firmware_entity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/firmware_site/i)).toBeInTheDocument();
    // Count all checkboxes
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(9);
  });

  it('reflects current value — selected fields are checked', () => {
    render(
      <PermissionFieldChecklist
        value={['state_province', 'vendor_name']}
        onChange={() => {}}
      />,
    );
    const stateProvince = screen.getByLabelText(/state_province/i) as HTMLInputElement;
    const vendorName = screen.getByLabelText(/vendor_name/i) as HTMLInputElement;
    const city = screen.getByLabelText(/city/i) as HTMLInputElement;
    expect(stateProvince.checked).toBe(true);
    expect(vendorName.checked).toBe(true);
    expect(city.checked).toBe(false);
  });

  it('calls onChange with the next selection when a field is toggled on', async () => {
    const onChange = vi.fn();
    render(<PermissionFieldChecklist value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/state_province/i));
    expect(onChange).toHaveBeenCalledWith(['state_province']);
  });

  it('calls onChange with the field removed when toggled off', async () => {
    const onChange = vi.fn();
    render(
      <PermissionFieldChecklist value={['state_province']} onChange={onChange} />,
    );
    await userEvent.click(screen.getByLabelText(/state_province/i));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disables fields listed in readOnly', () => {
    render(
      <PermissionFieldChecklist
        value={['state_province']}
        readOnly={['state_province']}
        onChange={() => {}}
      />,
    );
    const stateProvince = screen.getByLabelText(/state_province/i) as HTMLInputElement;
    expect(stateProvince.disabled).toBe(true);
  });

  // D-218 (2026-09-08): this array is an inline mirror of the protocol enum, so its ORDER is part
  // of the contract — a key author reading the ladder top-to-bottom must see the protocol's ladder.
  it('lists the four D-218 dimension fields after the five Step-1 fields, in the protocol order', () => {
    render(<PermissionFieldChecklist value={[]} onChange={() => {}} />);
    const ids = screen.getAllByRole('checkbox').map((box) => box.id);
    expect(ids).toEqual([
      'field-state_province',
      'field-city',
      'field-plant_address',
      'field-plant_identifier',
      'field-vendor_name',
      'field-design_entity',
      'field-design_site',
      'field-firmware_entity',
      'field-firmware_site',
    ]);
  });
});
