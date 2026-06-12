import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScorecardTable } from '../scorecard-table';
import type { Scorecard, ScorecardRow } from '@/lib/library-types';

const OWNER_ID = 'cp-1';

function row(overrides: Partial<ScorecardRow>): ScorecardRow {
  return {
    element_key: 'terms_of_sale',
    label: 'Terms of Sale',
    kind: 'artifact',
    status: 'met',
    required_min_amount_usd: null,
    held_amount_usd: null,
    held_value: null,
    evidence: [],
    waiver_reason: null,
    ...overrides,
  };
}

function scorecard(rows: ScorecardRow[], counts: Record<string, number>, gap: number): Scorecard {
  return { tier: 'connection', rows, gap_count: gap, counts };
}

describe('ScorecardTable', () => {
  it('renders one row per scorecard row with the element label', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard([row({ label: 'Terms of Sale' }), row({ element_key: 'iso9001', label: 'ISO 9001' })], { met: 2 }, 0)}
      />,
    );
    expect(screen.getByText('Terms of Sale')).toBeInTheDocument();
    expect(screen.getByText('ISO 9001')).toBeInTheDocument();
  });

  it('shows the held-vs-required amounts line formatted as USD without cents', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard(
          [row({ label: 'General Liability', status: 'insufficient', kind: 'attribute_with_evidence', held_amount_usd: 3000000, required_min_amount_usd: 5000000 })],
          { insufficient: 1 },
          1,
        )}
      />,
    );
    expect(screen.getByText('$3,000,000 held · $5,000,000 required')).toBeInTheDocument();
  });

  it('renders an external anchor for a source_url evidence item', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard(
          [row({ evidence: [{ artifact_id: 'a1', title: 'COI', source_url: 'https://example.com/coi.pdf', has_file: false, valid_until: null }] })],
          { met: 1 },
          0,
        )}
      />,
    );
    const link = screen.getByRole('link', { name: /COI/ });
    expect(link).toHaveAttribute('href', 'https://example.com/coi.pdf');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('links a has_file evidence item to the BFF evidence route under the owner id', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard(
          [row({ evidence: [{ artifact_id: 'art-9', title: 'Certificate', source_url: null, has_file: true, valid_until: '2027-01-01T00:00:00Z' }] })],
          { met: 1 },
          0,
        )}
      />,
    );
    const link = screen.getByRole('link', { name: /Certificate/ });
    expect(link).toHaveAttribute('href', `/api/account/entity-approvals/evidence/${OWNER_ID}/art-9/file`);
  });

  it('shows "valid until" for an expiring item and "no expiration" for a no_expiry item', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard(
          [
            row({ element_key: 'a', label: 'A', evidence: [{ artifact_id: 'a1', title: 'Doc A', source_url: 'https://x.test/a', has_file: false, valid_until: '2027-03-01T00:00:00Z' }] }),
            row({ element_key: 'b', label: 'B', evidence: [{ artifact_id: 'b1', title: 'Doc B', source_url: 'https://x.test/b', has_file: false, valid_until: null, no_expiry: true }] }),
          ],
          { met: 2 },
          0,
        )}
      />,
    );
    expect(screen.getByText(/valid until/i)).toBeInTheDocument();
    expect(screen.getByText(/no expiration/i)).toBeInTheDocument();
  });

  it('exposes the waiver reason via the eval_status pill tooltip on a waived row', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard(
          [row({ status: 'waived', waiver_reason: 'Verified CFO financials out of band' })],
          { waived: 1 },
          0,
        )}
      />,
    );
    const pill = screen.getByTestId('pill');
    const tip = document.getElementById(pill.getAttribute('aria-describedby') as string);
    expect(tip?.textContent).toMatch(/Verified CFO financials out of band/);
  });

  it('renders an eval_status pill per row', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard([row({ status: 'missing' }), row({ element_key: 'x', label: 'X', status: 'met' })], { missing: 1, met: 1 }, 1)}
      />,
    );
    expect(screen.getAllByTestId('pill')).toHaveLength(2);
  });

  it('renders a counts summary line including the gap count', () => {
    render(
      <ScorecardTable
        ownerId={OWNER_ID}
        scorecard={scorecard(
          [row({ status: 'met' }), row({ element_key: 'x', label: 'X', status: 'missing' })],
          { met: 1, missing: 1 },
          1,
        )}
      />,
    );
    const summary = screen.getByTestId('scorecard-counts');
    expect(summary).toHaveTextContent(/1 met/);
    expect(summary).toHaveTextContent(/1 missing/);
    expect(summary).toHaveTextContent(/gap count 1/i);
  });
});
