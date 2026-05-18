import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChangesFeed } from '../changes-feed';

const change = {
  change_id: 'c1', snapshot_id: 's1', prior_snapshot_id: 's0',
  change_kind: 'origin_shifted_country', vendor_participant_id: 'v1',
  component_ref: 'SKU-1',
  prior_value: { country_of_origin: 'VN' },
  current_value: { country_of_origin: 'CN' },
  severity: 'critical', detected_at: '2026-05-18T00:00:00.000Z',
};

describe('ChangesFeed', () => {
  it('renders a row with kind badge, subject and description', () => {
    render(<ChangesFeed changes={[change as any]} />);
    expect(screen.getByText(/origin shifted country|Country of origin/i)).toBeInTheDocument();
    expect(screen.getByText(/SKU-1/)).toBeInTheDocument();
    expect(screen.getByText(/VN/)).toBeInTheDocument();
    expect(screen.getByText(/CN/)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<ChangesFeed changes={[]} />);
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });
});
