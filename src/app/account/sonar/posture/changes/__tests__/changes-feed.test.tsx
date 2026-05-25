import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// The Pager subcomponent inside ChangesFeed reads URL state via next/navigation.
// jsdom has no App Router context, so stub the two hooks it touches.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/account/sonar/posture/changes',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

import { ChangesFeed } from '../changes-feed';
import { EVENT_KIND_PILLS } from '../filter-pills';
import { EMITTED_CHANGE_KINDS as PROTOCOL_EMITTED_CHANGE_KINDS } from '@haiwave/protocol';
import type { ComplianceChange } from '@haiwave/protocol';

const base: ComplianceChange = {
  change_id: 'c1', snapshot_id: 's1', prior_snapshot_id: 's0',
  change_kind: 'origin_shifted_country', vendor_participant_id: 'v1',
  component_ref: 'SKU-1',
  prior_value: { country_of_origin: 'VN' },
  current_value: { country_of_origin: 'CN' },
  severity: 'critical', detected_at: '2026-05-18T00:00:00.000Z',
  processed_at: null, processed_by: null,
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

  it('renders lead_time_degraded description with prior and current lead_time_days', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c4',
            change_kind: 'lead_time_degraded',
            prior_value: { lead_time_days: 7 },
            current_value: { lead_time_days: 21 },
            severity: 'warning',
          }),
        ]}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/7/)).toBeInTheDocument();
    expect(within(desc).getByText(/21/)).toBeInTheDocument();
  });

  it('renders certification_expired_or_revoked description with prior and current certification_status', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c5',
            change_kind: 'certification_expired_or_revoked',
            prior_value: { certification_status: 'valid' },
            current_value: { certification_status: 'expired' },
            severity: 'warning',
          }),
        ]}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/valid/)).toBeInTheDocument();
    expect(within(desc).getByText(/expired/)).toBeInTheDocument();
  });

  it('renders gap_added with its static sentence', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c6',
            change_kind: 'gap_added',
            prior_value: null,
            current_value: null,
            severity: 'warning',
          }),
        ]}
      />,
    );
    const desc = screen.getByTestId('change-description');
    expect(within(desc).getByText(/new compliance gap/i)).toBeInTheDocument();
  });

  it('filter-pills EVENT_KIND_PILLS is the protocol EMITTED_CHANGE_KINDS minus gap lifecycle (v.1.41 Backlog IA)', () => {
    // Gap lifecycle (gap_added / gap_resolved) belongs on the Gaps tab;
    // they are excluded from Events feed pills + default query results.
    const GAP_LIFECYCLE = ['gap_added', 'gap_resolved'];
    const expected = [...PROTOCOL_EMITTED_CHANGE_KINDS]
      .filter((k) => !GAP_LIFECYCLE.includes(k))
      .sort();
    const actual = [...EVENT_KIND_PILLS].sort();
    expect(actual).toEqual(expected);
    expect(actual).not.toContain('gap_added');
    expect(actual).not.toContain('gap_resolved');
  });

  it('renders pager when total exceeds pageSize', () => {
    const changes = Array.from({ length: 25 }, (_, i) =>
      change({ change_id: `c${i}`, change_kind: 'gap_added', prior_value: null, current_value: null }),
    );
    render(<ChangesFeed changes={changes} total={50} page={1} pageSize={25} />);
    expect(screen.getByText(/Showing 1–25 of 50/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    // Page 1: Prev disabled, Next enabled
    expect(screen.getByText('Next ›').tagName).toBe('A');
  });

  it('renders correct page range on a middle page', () => {
    const changes = Array.from({ length: 25 }, (_, i) =>
      change({ change_id: `c${i + 25}`, change_kind: 'gap_added', prior_value: null, current_value: null }),
    );
    render(<ChangesFeed changes={changes} total={100} page={2} pageSize={25} />);
    expect(screen.getByText(/Showing 26–50 of 100/)).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 4/)).toBeInTheDocument();
  });

  it('does NOT render pager when total <= pageSize', () => {
    const changes = Array.from({ length: 10 }, (_, i) =>
      change({ change_id: `c${i}`, change_kind: 'gap_added', prior_value: null, current_value: null }),
    );
    render(<ChangesFeed changes={changes} total={10} page={1} pageSize={25} />);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('does NOT render pager when total or pageSize is not provided', () => {
    render(<ChangesFeed changes={[change({})]} />);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('renders "paged past end" empty state when navigating beyond the last page', () => {
    render(<ChangesFeed changes={[]} total={30} page={5} pageSize={25} />);
    expect(screen.getByText(/No events on page 5/)).toBeInTheDocument();
    expect(screen.getByText(/only 30 match/)).toBeInTheDocument();
  });

  it('renders vendor_legal_name as subject identity when present', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c-name',
            vendor_participant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            vendor_legal_name: 'Acme Plastics',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Acme Plastics')).toBeInTheDocument();
  });

  it('retains vendor_participant_id as accessible title when vendor_legal_name is present', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c-name-title',
            vendor_participant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            vendor_legal_name: 'Acme Plastics',
          }),
        ]}
      />,
    );
    // The UUID must be accessible as a title attribute so it remains discoverable
    const nameEl = screen.getByTitle('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(nameEl).toBeInTheDocument();
  });

  it('falls back to vendor_participant_id when vendor_legal_name is absent', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c-no-name',
            vendor_participant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            // vendor_legal_name intentionally omitted
          }),
        ]}
      />,
    );
    // IdChip renders the first 6 chars by default
    expect(screen.getByText(/a1b2c3/)).toBeInTheDocument();
  });

  it('falls back to vendor_participant_id when vendor_legal_name is null', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            change_id: 'c-null-name',
            vendor_participant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            vendor_legal_name: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText(/a1b2c3/)).toBeInTheDocument();
  });

  it('renders a teal Process button when processed_at is null', () => {
    render(<ChangesFeed changes={[change({ processed_at: null, processed_by: null })]} />);
    const btn = screen.getByRole('button', { name: /^process$/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/bg-teal/);
  });

  it('renders an outlined Processed link when processed_at is set', () => {
    render(
      <ChangesFeed
        changes={[
          change({
            processed_at: '2026-05-25T12:00:00.000Z',
            processed_by: '00000000-0000-0000-0000-000000000aaa',
            severity: 'warning',
          }),
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: /processed/i });
    expect(link).toBeInTheDocument();
    expect(link.className).toMatch(/border-slate/);
    expect(link).toHaveAttribute('href', '/account/sonar/posture/changes/c1');
  });
});
