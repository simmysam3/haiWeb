import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegistrationsTable } from '../registrations-table';
import type { RegistrationListItem } from '@/lib/registration-types';

const rows: RegistrationListItem[] = [
  {
    id: 'req-blocked',
    legal_entity_name: 'Sanctioned Metals LLC',
    country_of_origin: 'IR',
    risk_tier: 'blocked',
    status: 'pending_approval',
    submitted_at: '2026-06-03T10:00:00.000Z',
  },
  {
    id: 'req-standard',
    legal_entity_name: 'Domestic Widgets Inc',
    country_of_origin: 'US',
    risk_tier: 'standard',
    status: 'pending_approval',
    submitted_at: '2026-06-02T09:00:00.000Z',
  },
];

describe('RegistrationsTable', () => {
  it('renders a row per request with name, country, a risk_tier Pill, and a detail link', () => {
    render(<RegistrationsTable rows={rows} />);

    expect(screen.getByText('Sanctioned Metals LLC')).toBeInTheDocument();
    expect(screen.getByText('Domestic Widgets Inc')).toBeInTheDocument();
    expect(screen.getByText('IR')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();

    // risk_tier renders literal pills: blocked → Foreign + Sanctioned; standard → Standard
    expect(screen.getByText('Foreign')).toBeInTheDocument();
    expect(screen.getByText('Sanctioned')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();

    // each row drills into its detail page via a labelled link (DetailChevron inside)
    const blockedLink = screen.getByRole('link', { name: /Sanctioned Metals LLC/i });
    expect(blockedLink).toHaveAttribute('href', '/account/admin/registrations/req-blocked');
    const standardLink = screen.getByRole('link', { name: /Domestic Widgets Inc/i });
    expect(standardLink).toHaveAttribute('href', '/account/admin/registrations/req-standard');
  });

  it('shows an empty message when there are no pending requests', () => {
    render(<RegistrationsTable rows={[]} />);
    expect(screen.getByText(/no .*requests/i)).toBeInTheDocument();
  });
});
