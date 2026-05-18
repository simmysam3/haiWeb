import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ChangeDetailCompare } from '../change-detail-compare';
import type { ComplianceChangeDetail } from '@haiwave/protocol';

const base: ComplianceChangeDetail = {
  change: {
    change_id: 'c1', snapshot_id: 's1', prior_snapshot_id: 's0',
    change_kind: 'origin_shifted_country', vendor_participant_id: 'v1',
    component_ref: 'SKU-1',
    prior_value: { country_of_origin: 'VN' },
    current_value: { country_of_origin: 'CN' },
    severity: 'critical', detected_at: '2026-05-18T00:00:00.000Z',
  },
  prior_cell: { tree: null, samples: [{ attribute_kind: 'lead_time_days', value_numeric: '14' }] },
  current_cell: { tree: null, samples: [{ attribute_kind: 'lead_time_days', value_numeric: '28' }] },
};

const detail = (e: Partial<ComplianceChangeDetail>): ComplianceChangeDetail => ({ ...base, ...e });

describe('ChangeDetailCompare', () => {
  it('shows prior and current columns with their sample values', () => {
    render(<ChangeDetailCompare detail={detail({})} />);
    expect(screen.getByText(/Prior/i)).toBeInTheDocument();
    expect(screen.getByText(/Current/i)).toBeInTheDocument();
    expect(screen.getByText(/14/)).toBeInTheDocument();
    expect(screen.getByText(/28/)).toBeInTheDocument();
  });

  it('renders the change kind and component ref in the header', () => {
    render(<ChangeDetailCompare detail={detail({})} />);
    expect(screen.getByText(/origin shifted country/i)).toBeInTheDocument();
    expect(screen.getByText(/SKU-1/)).toBeInTheDocument();
  });

  it('shows no subtree when tree is null', () => {
    render(<ChangeDetailCompare detail={detail({})} />);
    const noSubtree = screen.getAllByText(/no subtree/i);
    expect(noSubtree.length).toBeGreaterThanOrEqual(2);
  });

  it('shows none when samples are empty', () => {
    render(
      <ChangeDetailCompare
        detail={detail({
          prior_cell: { tree: null, samples: [] },
          current_cell: { tree: null, samples: [] },
        })}
      />,
    );
    const noneEls = screen.getAllByText(/none/i);
    expect(noneEls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows prior→current value delta in the change-description element', () => {
    render(<ChangeDetailCompare detail={base} />);
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/VN/)).toBeInTheDocument();
    expect(within(desc).getByText(/CN/)).toBeInTheDocument();
  });

  it('renders value_json content instead of "—" for certification_status samples', () => {
    render(
      <ChangeDetailCompare
        detail={detail({
          change: {
            ...base.change,
            change_kind: 'certification_expired_or_revoked',
            prior_value: { certification_status: 'valid' },
            current_value: { certification_status: 'expired' },
          },
          prior_cell: {
            tree: null,
            samples: [
              {
                attribute_kind: 'certification_status',
                value_numeric: null,
                value_string: null,
                value_json: { references: ['SOC 2'] },
              },
            ],
          },
          current_cell: { tree: null, samples: [] },
        })}
      />,
    );
    // The prior_cell sample must display the json payload, not "—"
    expect(screen.getByText(/SOC 2/)).toBeInTheDocument();
    // The literal em-dash must NOT appear as a sample value
    const items = screen.getAllByRole('listitem');
    expect(items.some((el) => el.textContent === '—')).toBe(false);
  });

  it('describeChange lead_time_degraded shows prior and current lead_time_days', () => {
    render(
      <ChangeDetailCompare
        detail={detail({
          change: {
            ...base.change,
            change_kind: 'lead_time_degraded',
            prior_value: { lead_time_days: 7 },
            current_value: { lead_time_days: 21 },
          },
        })}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/7/)).toBeInTheDocument();
    expect(within(desc).getByText(/21/)).toBeInTheDocument();
  });

  it('describeChange certification_expired_or_revoked shows prior and current certification_status', () => {
    render(
      <ChangeDetailCompare
        detail={detail({
          change: {
            ...base.change,
            change_kind: 'certification_expired_or_revoked',
            prior_value: { certification_status: 'valid' },
            current_value: { certification_status: 'expired' },
          },
        })}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/valid/)).toBeInTheDocument();
    expect(within(desc).getByText(/expired/)).toBeInTheDocument();
  });

  it('describeChange gap_added renders its static sentence', () => {
    render(
      <ChangeDetailCompare
        detail={detail({
          change: {
            ...base.change,
            change_kind: 'gap_added',
            prior_value: null,
            current_value: null,
          },
        })}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/new compliance gap/i)).toBeInTheDocument();
  });
});
