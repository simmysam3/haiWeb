import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceChip } from '../compliance-chip';

describe('ComplianceChip', () => {
  it('renders "Compliant" for compliant status', () => {
    render(
      <ComplianceChip
        compliance={{ status: 'compliant', missing_fields: [], grace_deadline: null }}
      />,
    );
    expect(screen.getByText(/compliant/i)).toBeInTheDocument();
  });

  it('renders "Grace Xd" with positive days remaining for grace_pending', () => {
    const deadline = new Date(Date.now() + 9 * 86_400_000).toISOString();
    render(
      <ComplianceChip
        compliance={{
          status: 'grace_pending',
          missing_fields: ['facility_country'],
          grace_deadline: deadline,
        }}
      />,
    );
    expect(screen.getByText(/grace \d+d/i)).toBeInTheDocument();
  });

  it('renders "Non-compliant Xd overdue" for non_compliant', () => {
    const deadline = new Date(Date.now() - 3 * 86_400_000).toISOString();
    render(
      <ComplianceChip
        compliance={{
          status: 'non_compliant',
          missing_fields: ['facility_country'],
          grace_deadline: deadline,
        }}
      />,
    );
    expect(screen.getByText(/non-compliant/i)).toBeInTheDocument();
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });
});
