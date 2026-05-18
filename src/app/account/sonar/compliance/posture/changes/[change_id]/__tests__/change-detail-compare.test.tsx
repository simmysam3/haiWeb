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
});
