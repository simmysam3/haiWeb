import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceBanner } from '../compliance-banner';
import type { ProvenanceKeyInstallation } from '@haiwave/protocol';

function inst(id: string, status: 'grace_pending' | 'non_compliant', deadline: string | null): ProvenanceKeyInstallation {
  return {
    installation_id: id,
    key_id: 'k',
    installer_participant_id: 'p',
    accepted_required_fields: [],
    accepted_requested_fields: [],
    installed_at: '2026-04-18T00:00:00.000Z',
    updated_at: '2026-04-18T00:00:00.000Z',
    removed_at: null,
    auto_removed_reason: null,
    compliance: { status, missing_fields: ['plant_identifier'], grace_deadline: deadline },
  };
}

describe('ComplianceBanner', () => {
  it('renders nothing when no grace or non-compliant installations', () => {
    const { container } = render(
      <ComplianceBanner
        counts={{ installerGracePending: 0, installerNonCompliant: 0 }}
        installations={[]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders orange banner when grace_pending exists (no non-compliant)', () => {
    const soon = new Date(Date.now() + 9 * 86_400_000).toISOString();
    render(
      <ComplianceBanner
        counts={{ installerGracePending: 1, installerNonCompliant: 0 }}
        installations={[inst('i1', 'grace_pending', soon)]}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/1 key need/i)).toBeInTheDocument();
    expect(screen.getByText(/9 days/i)).toBeInTheDocument();
  });

  it('renders red variant when any installation is non_compliant', () => {
    render(
      <ComplianceBanner
        counts={{ installerGracePending: 0, installerNonCompliant: 2 }}
        installations={[inst('i1', 'non_compliant', null), inst('i2', 'non_compliant', null)]}
      />,
    );
    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/#B3261E|bg-\[#B3261E\]/);
  });
});
