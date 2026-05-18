import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ChangesFeed } from '../changes-feed';
import type { ComplianceChange } from '@haiwave/protocol';

const base: ComplianceChange = {
  change_id: 'c1', snapshot_id: 's1', prior_snapshot_id: 's0',
  change_kind: 'origin_shifted_country', vendor_participant_id: 'v1',
  component_ref: 'SKU-1',
  prior_value: { country_of_origin: 'VN' },
  current_value: { country_of_origin: 'CN' },
  severity: 'critical', detected_at: '2026-05-18T00:00:00.000Z',
};

const change = (e: Partial<ComplianceChange>): ComplianceChange => ({ ...base, ...e });

describe('ChangesFeed', () => {
  it('renders a row with kind badge, subject and description', () => {
    render(<ChangesFeed changes={[change({})]} />);
    expect(screen.getByText(/origin shifted country/i)).toBeInTheDocument();
    expect(screen.getByText(/SKU-1/)).toBeInTheDocument();
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/VN/)).toBeInTheDocument();
    expect(within(desc).getByText(/CN/)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<ChangesFeed changes={[]} />);
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it('renders plant identifier description with prior and current values', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c2',
            change_kind: 'origin_shifted_plant',
            prior_value: { plant_identifier: 'P1' },
            current_value: { plant_identifier: 'P2' },
            severity: 'warning',
          }),
        ]}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/P1/)).toBeInTheDocument();
    expect(within(desc).getByText(/P2/)).toBeInTheDocument();
  });

  it('renders depth_reduced description with prior and current max_depth values', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c3',
            change_kind: 'depth_reduced',
            prior_value: { max_depth: 5 },
            current_value: { max_depth: 2 },
            severity: 'warning',
          }),
        ]}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/5/)).toBeInTheDocument();
    expect(within(desc).getByText(/2/)).toBeInTheDocument();
  });
});
