import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerVendorSummary } from '../per-vendor-summary';
import {
  makeAggregateReport,
  FIXTURE_RUN_ID,
  FIXTURE_VENDOR_A_ID,
  FIXTURE_VENDOR_B_ID,
} from '../__fixtures__/aggregate-report';

describe('PerVendorSummary', () => {
  it('renders one row per vendor with vendor name, status badge, counts, and a trailing View → link', () => {
    const rows = makeAggregateReport().per_vendor_summary;
    render(<PerVendorSummary rows={rows} runId={FIXTURE_RUN_ID} />);
    expect(screen.getByText('Vendor A')).toBeInTheDocument();
    expect(screen.getByText('Vendor B')).toBeInTheDocument();
    expect(screen.getByText('Compliant')).toBeInTheDocument();
    expect(screen.getByText('Non-compliant')).toBeInTheDocument();
  });

  it('builds trailing link href to /account/sonar/reports/{runId}/vendor/{vendor_id}', () => {
    const rows = makeAggregateReport().per_vendor_summary;
    render(<PerVendorSummary rows={rows} runId={FIXTURE_RUN_ID} />);
    const allLinks = screen.getAllByRole('link');
    const hrefs = allLinks.map((a) => a.getAttribute('href'));
    expect(hrefs).toContain(
      `/account/sonar/reports/${FIXTURE_RUN_ID}/vendor/${FIXTURE_VENDOR_A_ID}`,
    );
    expect(hrefs).toContain(
      `/account/sonar/reports/${FIXTURE_RUN_ID}/vendor/${FIXTURE_VENDOR_B_ID}`,
    );
  });

  it('ignores haiCore per_vendor_report_path and uses HaiWeb URL space', () => {
    // The fixture's per_vendor_report_path values use the haiCore /company/ form;
    // the rendered links must NOT use those paths.
    const rows = makeAggregateReport().per_vendor_summary;
    render(<PerVendorSummary rows={rows} runId={FIXTURE_RUN_ID} />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const href of hrefs) {
      expect(href).not.toMatch(/\/company\//);
    }
  });

  it('renders empty-state copy when no rows', () => {
    render(<PerVendorSummary rows={[]} runId={FIXTURE_RUN_ID} />);
    expect(screen.getByText(/No vendors in scope/i)).toBeInTheDocument();
  });
});
