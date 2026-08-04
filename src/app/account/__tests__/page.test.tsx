import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * System Dashboard stat tiles.
 *
 * Trading Pairs and Agents Online were shipped as hard-coded `value={null}`
 * placeholders — the tile rendered "Not Available" forever because nothing
 * was ever wired to it. These tests pin them to their real haiCore sources.
 *
 * Account Status stays `null` deliberately: `getPublicProfile`
 * (haiCore company-search.ts:373) does not return participant status, and
 * `session.participant.status` is the literal string "active" hard-coded in
 * auth.ts:145 — rendering it would be a fabricated value, which is exactly
 * what "Not Available" exists to prevent.
 */
const { fetchFromApi, getSession } = vi.hoisted(() => ({
  fetchFromApi: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/lib/server-haiwave-client', () => ({ fetchFromApi }));
vi.mock('@/lib/auth', () => ({ getSession }));

// QuoteVolumePanel is a client component driven by SWR; it is covered by its
// own suite. Stub it so this page test stays about the server-rendered tiles.
vi.mock('../_components/quote-volume-panel', () => ({
  QuoteVolumePanel: () => null,
}));
vi.mock('../_components/notifications-panel', () => ({
  NotificationsPanel: () => <div data-testid="notifications-panel" />,
}));

const SESSION = {
  user: { id: 'u1', email: 'a@b.c', first_name: 'A', last_name: 'B', role: 'owner', job_title: '' },
  participant: { id: 'p1', company_name: 'Apex Brass Foundry LLC', status: 'active' },
  is_admin: false,
};

/**
 * The page's lanes resolve in source order: score, connections, agents.
 *
 * Connections is ONE lane returning both counts — total and trading pairs come
 * from the same `listActiveConnections` call, so asking twice would be a second
 * round trip for a number we already hold.
 */
function queueLanes(opts: {
  score?: number | null;
  connections?: { total: number; pairs: number } | null;
  fleet?: { total: number; active: number; jailed: number } | null;
  accountStatus?: string | null;
}) {
  fetchFromApi
    .mockResolvedValueOnce(opts.score ?? null)
    .mockResolvedValueOnce(opts.connections ?? null)
    .mockResolvedValueOnce(opts.fleet ?? null)
    .mockResolvedValueOnce(opts.accountStatus ?? null);
}

describe('System Dashboard tiles', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchFromApi.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue(SESSION);
  });

  it('renders the trading-pair count from haiCore', async () => {
    queueLanes({ connections: { total: 9, pairs: 7 }, fleet: { total: 3, active: 2, jailed: 0 }, accountStatus: 'active' });
    const { default: Page } = await import('../page');
    render(await Page());

    const tile = screen.getByText('Trading Pairs').closest('div');
    expect(tile).toHaveTextContent('7');
  });

  // Total Connections is the superset: every active connection, whether it
  // reached `trading_pair` or is still `approved`. Trading Pairs sits beside it
  // as the subset that actually transacts, so the pair of tiles reads
  // "9 connections, 7 of them trading".
  it('renders the total connection count alongside trading pairs', async () => {
    queueLanes({ connections: { total: 9, pairs: 7 }, fleet: { total: 3, active: 2, jailed: 0 }, accountStatus: 'active' });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.getByText('Total Connections').closest('div')).toHaveTextContent('9');
    expect(screen.getByText('Trading Pairs').closest('div')).toHaveTextContent('7');
  });

  it('renders the online-agent count from haiCore', async () => {
    queueLanes({ connections: { total: 9, pairs: 7 }, fleet: { total: 3, active: 2, jailed: 0 }, accountStatus: 'active' });
    const { default: Page } = await import('../page');
    render(await Page());

    const tile = screen.getByText('Agents Online').closest('div');
    expect(tile).toHaveTextContent('2');
  });

  // A count of zero is a real answer — "no trading pairs yet" — and must not
  // be laundered into "Not Available", which claims the opposite (that we do
  // not know). The null-vs-zero distinction is the whole point of the tile.
  it('renders a real zero rather than Not Available', async () => {
    queueLanes({ connections: { total: 0, pairs: 0 }, fleet: { total: 0, active: 0, jailed: 0 }, accountStatus: 'active' });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.getByText('Trading Pairs').closest('div')).toHaveTextContent('0');
    expect(screen.getByText('Agents Online').closest('div')).toHaveTextContent('0');
  });

  // When haiCore is unreachable `fetchFromApi` yields the fallback (null);
  // the tile must say so rather than show a fabricated 0.
  it('falls back to Not Available when haiCore does not answer', async () => {
    queueLanes({ connections: null, fleet: null });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.getByText('Trading Pairs').closest('div')).toHaveTextContent('Not Available');
    expect(screen.getByText('Agents Online').closest('div')).toHaveTextContent('Not Available');
  });

  // Account Status was a tile that could only ever say "Not Available" — see
  // the header comment. It is now an alert-bar condition instead: you are told
  // when the account is suspended, and told nothing when it is fine.
  it('does not render an Account Status tile', async () => {
    queueLanes({ connections: { total: 9, pairs: 7 }, fleet: { total: 3, active: 2, jailed: 0 }, accountStatus: 'active' });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
  });

  it('shows no alert bar when nothing is wrong', async () => {
    queueLanes({ connections: { total: 9, pairs: 7 }, fleet: { total: 3, active: 2, jailed: 0 }, accountStatus: 'active' });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Every agent jailed — haiCore's own state for an agent that stopped
  // answering heartbeat probes — is the fleet being down.
  it('raises the alert bar when every agent is jailed', async () => {
    queueLanes({
      connections: { total: 9, pairs: 7 },
      fleet: { total: 2, active: 0, jailed: 2 },
      accountStatus: 'active',
    });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.getByRole('alert')).toHaveTextContent(/no agents are reachable/i);
  });

  // A brand-new account with no agents provisioned is in setup, not in fault.
  it('does not alert when the account has no agents at all', async () => {
    queueLanes({
      connections: { total: 0, pairs: 0 },
      fleet: { total: 0, active: 0, jailed: 0 },
      accountStatus: 'active',
    });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // The condition GET /participants/me was added for: before it, haiWeb had no
  // reader for account standing at all, so a suspended account saw a normal
  // dashboard and no explanation.
  it('raises the alert bar when the account is suspended', async () => {
    queueLanes({
      connections: { total: 9, pairs: 7 },
      fleet: { total: 3, active: 2, jailed: 0 },
      accountStatus: 'suspended',
    });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.getByRole('alert')).toHaveTextContent(/suspended/i);
  });

  // Notifications is the event inbox — things that happened and are worth
  // reading. It belongs above the tiles, not buried under billing at the foot
  // of the page where nobody scrolls to it.
  it('places the notifications panel above the stat tiles', async () => {
    queueLanes({ connections: { total: 9, pairs: 7 }, fleet: { total: 3, active: 2, jailed: 0 }, accountStatus: 'active' });
    const { default: Page } = await import('../page');
    render(await Page());

    const notifications = screen.getByTestId('notifications-panel');
    const firstTile = screen.getByText('Total Connections');
    // DOCUMENT_POSITION_FOLLOWING (4) — the tile comes after the panel.
    expect(
      notifications.compareDocumentPosition(firstTile) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('stays silent when the account status cannot be read', async () => {
    queueLanes({ connections: { total: 9, pairs: 7 }, fleet: { total: 3, active: 2, jailed: 0 }, accountStatus: null });
    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
