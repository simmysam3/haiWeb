import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DownloadMenu } from '../download-menu';

const RUN_ID = '00000000-0000-0000-0000-000000000001';
const VENDOR_ID = '33333333-3333-3333-3333-333333333333';

describe('DownloadMenu (aggregate)', () => {
  it('opens on click and reveals JSON + CSV anchor links with the right href and download attributes', () => {
    render(<DownloadMenu runId={RUN_ID} reportType="aggregate" />);
    // closed initially
    expect(screen.queryByRole('link', { name: /JSON/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Download/i }));
    const json = screen.getByRole('link', { name: /JSON/i }) as HTMLAnchorElement;
    const csv = screen.getByRole('link', { name: /CSV/i }) as HTMLAnchorElement;
    expect(json.getAttribute('href')).toBe(
      `/api/account/sonar/audit/reports/${RUN_ID}/aggregate?format=json`,
    );
    expect(json.getAttribute('download')).toBe(`aggregate-${RUN_ID}.json`);
    expect(csv.getAttribute('href')).toBe(
      `/api/account/sonar/audit/reports/${RUN_ID}/aggregate?format=csv`,
    );
    expect(csv.getAttribute('download')).toBe(`aggregate-${RUN_ID}.csv`);
  });

  it('closes on outside click', () => {
    render(
      <div>
        <DownloadMenu runId={RUN_ID} reportType="aggregate" />
        <span data-testid="outside">outside</span>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Download/i }));
    expect(screen.getByRole('link', { name: /JSON/i })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('link', { name: /JSON/i })).not.toBeInTheDocument();
  });
});

describe('DownloadMenu (per-vendor)', () => {
  it('builds URLs and filenames using both runId and vendorId', () => {
    render(<DownloadMenu runId={RUN_ID} reportType="per_vendor" vendorId={VENDOR_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /Download/i }));
    const json = screen.getByRole('link', { name: /JSON/i }) as HTMLAnchorElement;
    const csv = screen.getByRole('link', { name: /CSV/i }) as HTMLAnchorElement;
    expect(json.getAttribute('href')).toBe(
      `/api/account/sonar/audit/reports/${RUN_ID}/vendor/${VENDOR_ID}?format=json`,
    );
    expect(json.getAttribute('download')).toBe(`per-vendor-${RUN_ID}-${VENDOR_ID}.json`);
    expect(csv.getAttribute('href')).toBe(
      `/api/account/sonar/audit/reports/${RUN_ID}/vendor/${VENDOR_ID}?format=csv`,
    );
    expect(csv.getAttribute('download')).toBe(`per-vendor-${RUN_ID}-${VENDOR_ID}.csv`);
  });
});
