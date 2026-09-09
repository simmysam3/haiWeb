import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GeoRollupEntry } from '@haiwave/protocol';
import { DimensionLens } from '../dimension-lens';
import type { AuditChartData } from '../../_lib/load-audit-charts';
import type { PartnerComplianceData } from '../../_lib/partner-compliance';

// recharts measures a container the jsdom cannot size — render its ResponsiveContainer as a plain box (the page test's pattern).
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-responsive">{children}</div> };
});

const entry = (country_of_origin: string, component_count: number): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
const compliance = (total_non_compliant: number): PartnerComplianceData => ({ rows: [], total_vendors_in_scope: 1, total_non_compliant, median_per_vendor: total_non_compliant });
const charts: AuditChartData = {
  rollup: [entry('TW', 3)], classRollup: [], partnerCompliance: compliance(0),
  rollupByDimension: { manufacturing: [entry('TW', 3)], design: [entry('CN', 2)], firmware: [] },
  partnerComplianceByDimension: { manufacturing: compliance(0), design: compliance(2), firmware: compliance(0) },
  auditorCountry: 'US', latestRunId: 'run-1',
};

// D-219 (2026-09-08): one lens for the geo and partner charts; default Manufacturing (spec R4/R5).
describe('DimensionLens', () => {
  it('defaults to Manufacturing: today\'s title, the manufacturing dataset, the auditor footnote', () => {
    render(<DimensionLens charts={charts} classChart={<div data-testid="class-chart" />} />);
    expect(screen.getByRole('tab', { name: 'Manufacturing' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Components by country')).toBeInTheDocument();
    expect(screen.getByText('* Components outside US')).toBeInTheDocument();
    expect(screen.getByTestId('class-chart')).toBeInTheDocument();
  });
  it('switching to Design swaps the title and the datasets; Firmware with no data shows the empty geo copy', () => {
    render(<DimensionLens charts={charts} classChart={null} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }));
    expect(screen.getByText('Components by design country')).toBeInTheDocument();
    expect(screen.getByText('Total non-compliant').closest('div')).toHaveTextContent('2'); // Total non-compliant under the design lens
    fireEvent.click(screen.getByRole('tab', { name: 'Firmware' }));
    expect(screen.getByText('Components by firmware country')).toBeInTheDocument();
    expect(screen.getByText('No audit data yet. Run an audit to populate the dashboard.')).toBeInTheDocument();
  });
  it('unknown auditor country with a run: the partner panel names the fix', () => {
    render(<DimensionLens charts={{ ...charts, auditorCountry: undefined, partnerCompliance: null, partnerComplianceByDimension: { manufacturing: null, design: null, firmware: null } }} classChart={null} />);
    expect(screen.getByText('Set your company country to see partner compliance.')).toBeInTheDocument();
  });
  it('no run at all keeps today\'s empty copy', () => {
    render(<DimensionLens charts={{ ...charts, latestRunId: null, auditorCountry: undefined, rollup: [], rollupByDimension: { manufacturing: [], design: [], firmware: [] }, partnerCompliance: null, partnerComplianceByDimension: { manufacturing: null, design: null, firmware: null } }} classChart={null} />);
    expect(screen.getAllByText('No audit data yet. Run an audit to populate the dashboard.')).toHaveLength(2);
  });
});
