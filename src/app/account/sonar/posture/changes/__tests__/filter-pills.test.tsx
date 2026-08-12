import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
let currentSearch = 'page=3';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/account/sonar/posture/changes',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const PARTNERS = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', company_name: 'MidWest Fastener Corp', status: 'trading_pair' },
];

beforeEach(() => {
  push.mockClear();
  currentSearch = 'page=3';
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(PARTNERS), { status: 200 }),
  );
});

import { FilterPills } from '../filter-pills';

describe('Watcher Backlog FilterPills (v1.73 layout)', () => {
  it('partner is a name-resolving select whose value is the partner UUID', async () => {
    const user = userEvent.setup();
    render(<FilterPills />);
    const select = await screen.findByTitle(/filter the feed to changes involving/i);
    await user.selectOptions(select, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(screen.getByRole('option', { name: 'MidWest Fastener Corp' })).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining('partner=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    );
    // Filter change resets pagination.
    expect(push).toHaveBeenCalledWith(expect.not.stringContaining('page=3'));
  });
  it('kind pills sit on their own row below the showing row', async () => {
    render(<FilterPills />);
    const kindRow = (await screen.findByText('Kind:')).closest('div');
    const showingRow = screen.getByText('Showing:').closest('div');
    expect(kindRow).not.toBe(showingRow);
  });
  it('kind toggles are plain buttons (audit-side pattern), not <Pill> nested in a button', async () => {
    // v1.73 WP4 fix wave: <Pill> renders its label through DefinitionTip, a
    // `<span tabIndex={0}>` with its own click handler and an sr-only copy of
    // the tooltip body. Nesting that inside a <button> pollutes the button's
    // accessible name (becomes "lead time degraded <tooltip body>") and adds
    // a redundant tab stop. The exact accessible name below is what pins the
    // clean construct: it fails against the old <button><Pill/></button> and
    // passes once the toggle matches audit/events/filter-pills.tsx's
    // plain-button idiom.
    // ⚠ HOW it pins, corrected 2026-08-12: a STRING `name` in `ByRole` is
    // matched EXACTLY BY DEFAULT (full string, whitespace-normalised). This
    // previously passed `exact: true`, which is NOT a member of ByRoleOptions —
    // silently ignored at runtime, and a TS2769 that haiWeb's `npm run build`
    // never surfaced (only `tsc --noEmit` does). The option was removed; the
    // protection is unchanged and was re-proved by mutation after removal.
    // 🚫 Do NOT "simplify" this to a regex or substring matcher to quieten a
    // future type complaint — a non-exact matcher would accept the polluted
    // name "lead time degraded <tooltip body>" and silently retire this guard.
    const user = userEvent.setup();
    render(<FilterPills />);
    const pill = await screen.findByRole('button', { name: 'lead time degraded' });
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    await user.click(pill);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('kind=lead_time_degraded'));
  });
  it('degraded lane: a failed partners fetch still offers "All partners" and does not blank the bar', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('haiCore unreachable'));
    render(<FilterPills />);
    const select = await screen.findByTitle(/filter the feed to changes involving/i);
    // "All partners" is the only option — the failure must not inject bogus
    // rows or otherwise corrupt the select, only leave it at its base state.
    await waitFor(() => {
      expect(within(select).getAllByRole('option')).toHaveLength(1);
    });
    expect(within(select).getByRole('option', { name: 'All partners' })).toBeInTheDocument();
    expect(screen.getByText('Showing:')).toBeInTheDocument();
    expect(screen.getByText('Kind:')).toBeInTheDocument();
  });
  it('a partner pinned in the URL but absent from the fetched list stays selectable', async () => {
    currentSearch = 'partner=ffffffff-ffff-ffff-ffff-ffffffffffff';
    render(<FilterPills />);
    const select = await screen.findByTitle(/filter the feed to changes involving/i);
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: /ffffffff… \(unresolved\)/ }),
      ).toBeInTheDocument();
    });
    expect(select).toHaveValue('ffffffff-ffff-ffff-ffff-ffffffffffff');
  });
});
