import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttributeClassProposalSchema } from '@haiwave/protocol';
import { ProposeForm } from '../propose-form';

describe('ProposeForm', () => {
  // PF P8 — one assertion is the whole finding, and the mocked-BFF suite CAN run it.
  it('submits a value that satisfies AttributeClassProposalSchema in full', () => {
    const onSubmit = vi.fn();
    render(<ProposeForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Attribute class id'), { target: { value: 'moq' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Minimum Order Quantity' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const parsed = AttributeClassProposalSchema.safeParse(onSubmit.mock.calls[0][0]);
    expect(parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe('');
  });

  // PF P8 — the first of the two cross-field refinements, mirrored client-side.
  it('does not submit a number_with_unit proposal until a unit is chosen', () => {
    const onSubmit = vi.fn();
    render(<ProposeForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Attribute class id'), { target: { value: 'lead_time' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Lead time' } });
    fireEvent.change(screen.getByLabelText('Value type'), { target: { value: 'number_with_unit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/unit is required/i)).toBeInTheDocument();
  });
});
