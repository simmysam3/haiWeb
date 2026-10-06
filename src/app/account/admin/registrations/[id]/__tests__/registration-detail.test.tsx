import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationDetail } from '../registration-detail';
import type { RegistrationDetail as Detail } from '@/lib/registration-types';

function makeDetail(over: Partial<Detail> = {}): Detail {
  return {
    id: 'req-1',
    legal_entity_name: 'Sanctioned Metals LLC',
    country_of_origin: 'IR',
    risk_tier: 'blocked',
    status: 'pending_approval',
    submitted_at: '2026-06-03T10:00:00.000Z',
    first_name: 'Jane',
    last_name: 'Doe',
    contact_email: 'jane@example.com',
    role_title: 'CFO',
    corporate_website: 'https://example.com',
    terms_url: 'https://example.com/terms',
    tax_id: '12-3456789',
    duns: '987654321',
    hq_street: '500 Foundry Rd',
    hq_city: 'Tehran',
    hq_region: 'Tehran Province',
    hq_postal_code: '11369',
    screening_reason: 'Country IR is on the sanctioned list.',
    source: 'public_join',
    adjudicated_by: null,
    adjudicated_at: null,
    decision_reason: null,
    participant_id: null,
    pii_redacted: false,
    created_at: '2026-06-03T09:59:00.000Z',
    ...over,
  };
}

const fetchMock = () => fetch as unknown as ReturnType<typeof vi.fn>;
function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
}

beforeEach(() => vi.clearAllMocks());

describe('RegistrationDetail', () => {
  it('renders the application fields, screening rationale, and risk/status pills', () => {
    render(<RegistrationDetail detail={makeDetail()} />);
    expect(screen.getByText('Sanctioned Metals LLC')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText(/sanctioned list/i)).toBeInTheDocument();
    // blocked tier renders literal pills: Foreign + Sanctioned (not "Blocked")
    expect(screen.getByText('Foreign')).toBeInTheDocument();
    expect(screen.getByText('Sanctioned')).toBeInTheDocument();
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument(); // status pill
  });

  it('renders tax_id, duns, and the composed HQ address', () => {
    render(<RegistrationDetail detail={makeDetail()} />);
    expect(screen.getByText('Tax ID')).toBeInTheDocument();
    expect(screen.getByText('12-3456789')).toBeInTheDocument();
    expect(screen.getByText('DUNS')).toBeInTheDocument();
    expect(screen.getByText('987654321')).toBeInTheDocument();
    expect(screen.getByText('HQ address')).toBeInTheDocument();
    expect(screen.getByText('500 Foundry Rd')).toBeInTheDocument();
    expect(screen.getByText('Tehran, Tehran Province 11369')).toBeInTheDocument();
  });

  it('on a declined record (tax_id null) renders contact + DUNS + HQ but "Tax ID —"', () => {
    render(
      <RegistrationDetail
        detail={makeDetail({
          status: 'rejected',
          pii_redacted: true,
          tax_id: null,
          role_title: null,
        })}
      />,
    );
    // contact retained
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    // duns + HQ retained
    expect(screen.getByText('987654321')).toBeInTheDocument();
    expect(screen.getByText('500 Foundry Rd')).toBeInTheDocument();
    // tax_id nulled → empty treatment under the Tax ID label
    const taxIdLabel = screen.getByText('Tax ID');
    const taxIdValue = taxIdLabel.parentElement?.querySelector('dd');
    expect(taxIdValue).toHaveTextContent('—');
  });

  it('renders the Terms page field, dashing it when terms_url is null', () => {
    const { rerender } = render(<RegistrationDetail detail={makeDetail()} />);
    expect(screen.getByText('Terms page')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/terms')).toBeInTheDocument();

    rerender(<RegistrationDetail detail={makeDetail({ terms_url: null })} />);
    const termsLabel = screen.getByText('Terms page');
    const termsValue = termsLabel.parentElement?.querySelector('dd');
    expect(termsValue).toHaveTextContent('—');
  });

  it('blocked approve requires an override reason, then POSTs {override:true,reason} and reflects approved', async () => {
    const user = userEvent.setup();
    stubFetch(200, { ok: true, participant_id: 'p-9', status: 'approved' });
    render(<RegistrationDetail detail={makeDetail()} />);

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    const confirm = screen.getByRole('button', { name: /confirm approval/i });
    expect(confirm).toBeDisabled(); // blocked → reason mandatory
    await user.type(screen.getByLabelText(/override reason/i), 'sanctions waiver on file');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(fetchMock()).toHaveBeenCalled());
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/admin/registration-requests/req-1/approve');
    expect(JSON.parse(init.body as string)).toEqual({
      override: true,
      reason: 'sanctions waiver on file',
    });
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
  });

  it('surfaces the blocked-override message on a 409', async () => {
    const user = userEvent.setup();
    stubFetch(409, { error: { code: 'blocked_requires_override' } });
    render(<RegistrationDetail detail={makeDetail()} />);

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.type(screen.getByLabelText(/override reason/i), 'x');
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/override/i));
  });

  it('reject requires a reason, POSTs it, toasts, and reflects rejected', async () => {
    const user = userEvent.setup();
    stubFetch(200, { ok: true, status: 'rejected' });
    render(<RegistrationDetail detail={makeDetail()} />);

    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    const confirm = screen.getByRole('button', { name: /confirm rejection/i });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/rejection reason/i), 'incomplete documentation');
    await user.click(confirm);

    await waitFor(() => expect(fetchMock()).toHaveBeenCalled());
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/admin/registration-requests/req-1/reject');
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'incomplete documentation' });
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Rejected')).toBeInTheDocument());
  });

  it('an out-of-union wire status fails CLOSED: approve/reject controls stay hidden', () => {
    // Deliberate cast simulating wire data from a newer core (a 4th
    // RegistrationStatus this build's union has never heard of) — not sloppy
    // typing. The old `status !== 'pending_approval'` chain would have shown
    // this as non-terminal (fail OPEN, expose admin controls); the fix must
    // treat an unrecognized status as terminal instead.
    render(
      <RegistrationDetail
        detail={makeDetail({ status: 'under_review' as unknown as Detail['status'] })}
      />,
    );
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });

  it('standard approve does not force an override reason and omits override', async () => {
    const user = userEvent.setup();
    stubFetch(200, { ok: true, participant_id: 'p-1', status: 'approved' });
    render(
      <RegistrationDetail
        detail={makeDetail({ risk_tier: 'standard', country_of_origin: 'US', screening_reason: 'Domestic jurisdiction.' })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    const confirm = screen.getByRole('button', { name: /confirm approval/i });
    expect(confirm).toBeEnabled(); // standard → no reason required
    await user.click(confirm);

    await waitFor(() => expect(fetchMock()).toHaveBeenCalled());
    const [, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).override).toBeUndefined();
  });
});

// ---- D-239: Resend setup email / Retry provisioning ------------------------

const LAST_SENT = '2026-10-05T21:40:00.000Z';
const at = (iso: string) => vi.setSystemTime(new Date(iso));

function approvedDetail(over: Partial<Detail> = {}): Detail {
  return makeDetail({
    status: 'approved',
    risk_tier: 'standard',
    provisioning_status: 'provisioned',
    last_invite_sent_at: LAST_SENT,
    ...over,
  });
}

/** Branch B shape: a send is always followed by a live link (4 days after the send). */
const LIVE_UNTIL = '2026-10-09T21:40:00.000Z';
function liveDetail(over: Partial<Detail> = {}): Detail {
  return approvedDetail({ last_invite_expires_at: LIVE_UNTIL, ...over });
}

/** A URL-keyed fetch stub: 'METHOD /path' → [status, body], or 'never' for a request that never settles. */
function stubRoutes(routes: Record<string, [number, unknown] | 'never' | 'throw'>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const route = routes[`${init?.method ?? 'GET'} ${input}`];
      if (route === 'never') return new Promise<Response>(() => {});
      if (route === 'throw') throw new Error('network down');
      if (!route) throw new Error(`unstubbed ${init?.method ?? 'GET'} ${input}`);
      return new Response(JSON.stringify(route[1]), {
        status: route[0],
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}
const RESEND = 'POST /api/admin/registration-requests/req-1/resend-invite';
const RETRY = 'POST /api/admin/registration-requests/req-1/retry-provisioning';
const APPROVE = 'POST /api/admin/registration-requests/req-1/approve';
const REREAD = 'GET /api/admin/registration-requests/req-1';
const callsTo = (key: string) =>
  fetchMock().mock.calls.filter(
    ([url, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${url}` === key,
  );

describe('RegistrationDetail invite controls', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('an approved, provisioned request shows Resend setup email and the last-sent time', () => {
    at('2026-10-05T22:00:00.000Z');
    render(<RegistrationDetail detail={approvedDetail()} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeEnabled();
    expect(screen.getByText('Last sent 2026-10-05 21:40 UTC')).toBeInTheDocument();
    expect(screen.queryByText(/Available again at/)).not.toBeInTheDocument();
  });

  it('during the cooldown the button is disabled with "Available again at", and enables itself when the cooldown ends', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    at('2026-10-05T21:45:00.000Z');
    render(<RegistrationDetail detail={approvedDetail()} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled();
    expect(screen.getByText('Available again at 21:50 UTC')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeEnabled();
    expect(screen.queryByText(/Available again at/)).not.toBeInTheDocument();
  });

  it('unmounting clears the pending cooldown timer', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    at('2026-10-05T21:45:00.000Z');
    const { unmount } = render(<RegistrationDetail detail={approvedDetail()} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Resend confirms in a modal, POSTs, toasts and updates the last-sent time', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({ [RESEND]: [200, { ok: true, last_invite_sent_at: '2026-10-05T22:00:00.000Z' }] });
    render(<RegistrationDetail detail={approvedDetail({ last_invite_expires_at: '2026-10-05T21:40:00.000Z' })} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    const dialog = screen.getByRole('dialog', { name: 'Resend setup email' });
    expect(dialog).toHaveTextContent('Send a new setup link to jane@example.com? It lasts 4 days.');
    expect(dialog).toHaveTextContent('The previous link has expired.');
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Setup email sent.'));
    expect(callsTo(RESEND)).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Last sent 2026-10-05 22:00 UTC')).toBeInTheDocument();
  });

  it('two clicks on Confirm resend send one POST', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({ [RESEND]: 'never' });
    render(<RegistrationDetail detail={approvedDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    const confirm = screen.getByRole('button', { name: 'Confirm resend' });
    await user.click(confirm);
    await user.click(confirm);

    expect(callsTo(RESEND)).toHaveLength(1);
    expect(confirm).toBeDisabled();
  });

  it.each([
    [409, { error: { code: 'user_has_credentials' } }, 'This person has already set up their account. A new link is not needed.'],
    [429, { error: { code: 'RATE_LIMIT_EXCEEDED' } }, 'Too many requests. Wait a minute and try again.'],
  ])('a %s refusal shows its sentence in the modal and leaves Confirm usable again', async (status, body, sentence) => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({ [RESEND]: [status, body] });
    render(<RegistrationDetail detail={approvedDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    const dialog = await screen.findByRole('dialog', { name: 'Resend setup email' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(sentence));
    expect(screen.getByRole('button', { name: 'Confirm resend' })).toBeEnabled();
    expect(screen.getByText('Last sent 2026-10-05 21:40 UTC')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a network failure on Resend shows "Could not reach the server." and frees Confirm', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({ [RESEND]: 'throw' });
    render(<RegistrationDetail detail={approvedDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    const dialog = screen.getByRole('dialog', { name: 'Resend setup email' });
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not reach the server.'),
    );
    expect(screen.getByRole('button', { name: 'Confirm resend' })).toBeEnabled();
  });

  it("a cooldown 429 whose re-read finds a live link shows the live-link sentence, not a cooldown time", async () => {
    const user = userEvent.setup();
    at('2026-10-05T21:25:00.000Z'); // 15 min before the server's last send
    stubRoutes({
      [RESEND]: [
        429,
        {
          error: {
            code: 'invite_cooldown_active',
            details: { last_invite_sent_at: LAST_SENT, retry_after_seconds: 600 },
          },
        },
      ],
      [REREAD]: [200, { request: liveDetail({ last_invite_sent_at: LAST_SENT }) }],
    });
    render(<RegistrationDetail detail={approvedDetail({ last_invite_sent_at: '2026-10-05T20:00:00.000Z' })} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    const dialog = screen.getByRole('dialog', { name: 'Resend setup email' });
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'The current setup link is valid until 2026-10-09 21:40 UTC. A new one can be sent after it expires.',
      ),
    );
    expect(screen.getByText('Last sent 2026-10-05 21:40 UTC')).toBeInTheDocument();
    expect(screen.getAllByText(/^The current setup link is valid until 2026-10-09 21:40 UTC/)).toHaveLength(2); // modal alert + page line
    expect(screen.queryByText(/Available again at/)).not.toBeInTheDocument();
  });

  it("a cooldown 429 with no live link known keeps the server's \"Available again at\" time, even when the browser clock is behind", async () => {
    const user = userEvent.setup();
    at('2026-10-05T21:25:00.000Z'); // 15 min before the server's last send
    stubRoutes({
      [RESEND]: [
        429,
        {
          error: {
            code: 'invite_cooldown_active',
            details: { last_invite_sent_at: LAST_SENT, retry_after_seconds: 600 },
          },
        },
      ],
    });
    render(<RegistrationDetail detail={approvedDetail({ last_invite_sent_at: '2026-10-05T20:00:00.000Z' })} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    const dialog = screen.getByRole('dialog', { name: 'Resend setup email' });
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'A setup email was sent recently. Available again at 21:50 UTC.',
      ),
    );
    expect(screen.getByText('Last sent 2026-10-05 21:40 UTC')).toBeInTheDocument();
  });

  it('a refused resend whose re-read fails leaves the stored expiry unknown, not stale', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({ [RESEND]: [502, { error: { code: 'invite_email_failed', details: { keycloak_status: 503 } } }] }); // re-read unstubbed: fails
    render(<RegistrationDetail detail={approvedDetail({ last_invite_expires_at: '2026-10-05T21:40:00.000Z' })} />);
    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    expect(screen.getByRole('dialog', { name: 'Resend setup email' })).toHaveTextContent('The previous link has expired.');
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The setup email could not be sent. Try again later.'));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    expect(screen.getByRole('dialog', { name: 'Resend setup email' })).not.toHaveTextContent('The previous link has expired.');
  });

  it('an unconfirmed send (502 invite_email_failed, null status) says it may not have been sent and shows the live link the re-read finds', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({
      [RESEND]: [502, { error: { code: 'invite_email_failed', details: { keycloak_status: null } } }],
      [REREAD]: [200, { request: liveDetail({ last_invite_sent_at: '2026-10-05T22:00:00.000Z', last_invite_expires_at: '2026-10-09T22:00:00.000Z' }) }],
    });
    render(<RegistrationDetail detail={approvedDetail({ last_invite_expires_at: '2026-10-05T21:40:00.000Z' })} />);
    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    const dialog = screen.getByRole('dialog', { name: 'Resend setup email' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('The setup email may not have been sent.'));
    expect(screen.getByText(/The current setup link is valid until 2026-10-09 22:00 UTC/)).toBeInTheDocument();
    expect(screen.getByText('Last sent 2026-10-05 22:00 UTC')).toBeInTheDocument();
  });

  it('a far-future link expiry never schedules a re-render timer past the 32-bit limit', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    at('2026-10-05T22:00:00.000Z');
    const spy = vi.spyOn(globalThis, 'setTimeout');
    render(<RegistrationDetail detail={approvedDetail({ last_invite_expires_at: '2026-12-31T00:00:00.000Z' })} />); // ~86 days
    const delays = spy.mock.calls.map(([, ms]) => ms).filter((ms): ms is number => typeof ms === 'number');
    expect(delays.length).toBeGreaterThan(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(2 ** 31 - 1);
    spy.mockRestore();
  });

  it('a hung re-read after a successful resend does not trap the admin in the modal', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({
      [RESEND]: [200, { ok: true, last_invite_sent_at: '2026-10-05T22:00:00.000Z' }],
      [REREAD]: 'never',
    });
    render(<RegistrationDetail detail={liveDetail({ last_invite_expires_at: '2026-10-05T21:40:00.000Z' })} />);
    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Setup email sent.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Last sent 2026-10-05 22:00 UTC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled(); // cooldown, expiry unknown until the re-read lands
  });

  it('a hung re-read after a successful retry does not trap the admin in the modal', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({
      [RETRY]: [200, { ok: true, participant_id: 'p-9', provisioning_status: 'provisioned', last_invite_sent_at: '2026-10-05T22:00:00.000Z' }],
      [REREAD]: 'never',
    });
    render(<RegistrationDetail detail={approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null })} />);
    await user.click(screen.getByRole('button', { name: 'Retry provisioning' }));
    await user.click(screen.getByRole('button', { name: 'Confirm retry' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Provisioning complete.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Last sent 2026-10-05 22:00 UTC')).toBeInTheDocument();
  });

  it('an approve failure whose re-read shows the request rejected closes the modal with a notice, so Confirm cannot be clicked again', async () => {
    const user = userEvent.setup();
    stubRoutes({
      [APPROVE]: [500, { error: { code: 'INTERNAL_ERROR' } }],
      [REREAD]: [200, { request: makeDetail({ risk_tier: 'standard', status: 'rejected' }) }],
    });
    render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard' })} />);
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This request is no longer pending approval.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm approval/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(callsTo(APPROVE)).toHaveLength(1);
  });

  it('an approve failure whose re-read still shows pending keeps the modal and its error', async () => {
    const user = userEvent.setup();
    stubRoutes({
      [APPROVE]: [500, { error: { code: 'INTERNAL_ERROR' } }],
      [REREAD]: [200, { request: makeDetail({ risk_tier: 'standard' }) }],
    });
    render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard' })} />);
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    const dialog = screen.getByRole('dialog', { name: 'Approve registration' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Approval failed. Please try again.'));
    expect(screen.getByRole('button', { name: /confirm approval/i })).toBeEnabled();
  });

  it('the disabled Resend button is described by its reason; an enabled one has no description', () => {
    at('2026-10-05T21:45:00.000Z');
    render(<RegistrationDetail detail={approvedDetail()} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toHaveAccessibleDescription('Available again at 21:50 UTC');

    cleanup();
    render(<RegistrationDetail detail={liveDetail()} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toHaveAccessibleDescription(
      'The current setup link is valid until 2026-10-09 21:40 UTC. A new one can be sent after it expires.',
    );

    cleanup();
    at('2026-10-05T22:00:00.000Z');
    render(<RegistrationDetail detail={approvedDetail()} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toHaveAccessibleDescription('');
  });

  it('a link still live disables Resend with its expiry line until it expires', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    at('2026-10-05T22:00:00.000Z');
    render(<RegistrationDetail detail={approvedDetail({ last_invite_expires_at: '2026-10-09T21:40:00.000Z' })} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled();
    expect(
      screen.getByText(
        'The current setup link is valid until 2026-10-09 21:40 UTC. A new one can be sent after it expires.',
      ),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4 * 24 * 60 * 60 * 1000);
    });
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeEnabled();
    expect(screen.queryByText(/The current setup link is valid until/)).not.toBeInTheDocument();
  });

  it("a previous_link_live refusal shows the server's expiry and the page adopts it", async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({
      [RESEND]: [
        409,
        { error: { code: 'previous_link_live', details: { previous_link_expires_at: '2026-10-09T21:40:00.000Z' } } },
      ],
    });
    render(<RegistrationDetail detail={approvedDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    const dialog = screen.getByRole('dialog', { name: 'Resend setup email' });
    const sentence =
      'The current setup link is valid until 2026-10-09 21:40 UTC. A new one can be sent after it expires.';
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(sentence));
    expect(screen.getAllByText(sentence)).toHaveLength(2); // the modal alert and the page line
  });

  it('an approved request whose email failed shows Retry provisioning; retry succeeds and becomes Resend with its last-sent time', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:30:00.000Z');
    stubRoutes({
      [RETRY]: [
        200,
        {
          ok: true,
          participant_id: 'p-9',
          provisioning_status: 'provisioned',
          last_invite_sent_at: '2026-10-05T22:30:00.000Z',
        },
      ],
    });
    render(<RegistrationDetail detail={approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null })} />);
    expect(screen.getByText('Approved, but the setup email was not sent.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend setup email' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry provisioning' }));
    const dialog = screen.getByRole('dialog', { name: 'Retry provisioning' });
    expect(dialog).toHaveTextContent(
      'Finish provisioning Sanctioned Metals LLC and send a setup link to jane@example.com? It lasts 4 days.',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm retry' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Provisioning complete. Setup email sent.'),
    );
    expect(callsTo(RETRY)).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Approved, but the setup email was not sent.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled(); // cooling down
    expect(screen.getByText('Last sent 2026-10-05 22:30 UTC')).toBeInTheDocument();
  });

  it('a retry refused participant_mismatch shows its sentence', async () => {
    const user = userEvent.setup();
    stubRoutes({ [RETRY]: [409, { error: { code: 'participant_mismatch' } }] });
    render(<RegistrationDetail detail={approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null })} />);

    await user.click(screen.getByRole('button', { name: 'Retry provisioning' }));
    await user.click(screen.getByRole('button', { name: 'Confirm retry' }));

    const dialog = screen.getByRole('dialog', { name: 'Retry provisioning' });
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'A different account already uses this email address. Nothing was sent.',
      ),
    );
    expect(screen.getByRole('button', { name: 'Confirm retry' })).toBeEnabled();
    expect(screen.getByText('Approved, but the setup email was not sent.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a network failure on Retry shows "Could not reach the server." and frees Confirm', async () => {
    const user = userEvent.setup();
    stubRoutes({ [RETRY]: 'throw' });
    render(<RegistrationDetail detail={approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null })} />);

    await user.click(screen.getByRole('button', { name: 'Retry provisioning' }));
    await user.click(screen.getByRole('button', { name: 'Confirm retry' }));

    const dialog = screen.getByRole('dialog', { name: 'Retry provisioning' });
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not reach the server.'),
    );
    expect(screen.getByRole('button', { name: 'Confirm retry' })).toBeEnabled();
  });

  it('two clicks on Confirm retry send one POST', async () => {
    const user = userEvent.setup();
    stubRoutes({ [RETRY]: 'never' });
    render(<RegistrationDetail detail={approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null })} />);

    await user.click(screen.getByRole('button', { name: 'Retry provisioning' }));
    const confirm = screen.getByRole('button', { name: 'Confirm retry' });
    await user.click(confirm);
    await user.click(confirm);

    expect(callsTo(RETRY)).toHaveLength(1);
    expect(confirm).toBeDisabled();
  });

  it('an approve 502 PROVISIONING_EMAIL_FAILED re-reads the detail and shows Retry at once', async () => {
    const user = userEvent.setup();
    stubRoutes({
      [APPROVE]: [502, { error: { code: 'PROVISIONING_EMAIL_FAILED' } }],
      [REREAD]: [
        200,
        { request: approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null }) },
      ],
    });
    render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard' })} />);

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() =>
      expect(screen.getByText('Approved, but the setup email was not sent.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Retry provisioning' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // no notice for the uppercase code
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(callsTo(REREAD)).toHaveLength(1);
  });

  it('an approve 409 participant_mismatch re-reads, shows Retry and the sentence', async () => {
    const user = userEvent.setup();
    stubRoutes({
      [APPROVE]: [409, { error: { code: 'participant_mismatch' } }],
      [REREAD]: [
        200,
        { request: approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null }) },
      ],
    });
    render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard' })} />);

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A different account already uses this email address. Nothing was sent.',
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry provisioning' })).toBeInTheDocument();
  });

  it('opening a new action clears the earlier page notice', async () => {
    const user = userEvent.setup();
    stubRoutes({
      [APPROVE]: [409, { error: { code: 'participant_mismatch' } }],
      [REREAD]: [
        200,
        { request: approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null }) },
      ],
    });
    render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard' })} />);
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Retry provisioning' }));
    expect(screen.getByRole('dialog', { name: 'Retry provisioning' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('an approve failure whose re-read fails keeps "Approval failed. Please try again." and shows no Retry', async () => {
    const user = userEvent.setup();
    stubRoutes({
      [APPROVE]: [500, { error: { code: 'INTERNAL_ERROR' } }],
      [REREAD]: [500, {}],
    });
    render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard' })} />);

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    const dialog = screen.getByRole('dialog', { name: 'Approve registration' });
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Approval failed. Please try again.'),
    );
    expect(screen.queryByRole('button', { name: 'Retry provisioning' })).not.toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
  });

  it('an approve 200 re-reads and shows Resend with its last-sent time, disabled by the live link it just sent', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({
      [APPROVE]: [200, { ok: true, participant_id: 'p-9', status: 'approved' }],
      [REREAD]: [
        200,
        { request: liveDetail({ last_invite_sent_at: '2026-10-05T21:59:00.000Z', last_invite_expires_at: '2026-10-09T21:59:00.000Z' }) },
      ],
    });
    render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard' })} />);

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Registration approved.'));
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled();
    expect(screen.getByText('Last sent 2026-10-05 21:59 UTC')).toBeInTheDocument();
    expect(screen.getByText(/The current setup link is valid until 2026-10-09 21:59 UTC/)).toBeInTheDocument();
    expect(screen.queryByText(/Available again at/)).not.toBeInTheDocument();
  });

  it('a detail from an older core (no provisioning_status) shows neither Resend nor Retry', () => {
    render(<RegistrationDetail detail={approvedDetail({ provisioning_status: undefined })} />);
    expect(screen.queryByRole('button', { name: 'Resend setup email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry provisioning' })).not.toBeInTheDocument();
  });

  it('a rejected request shows neither control', () => {
    render(<RegistrationDetail detail={approvedDetail({ status: 'rejected' })} />);
    expect(screen.queryByRole('button', { name: 'Resend setup email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry provisioning' })).not.toBeInTheDocument();
  });

  it.each([
    ['none', true],
    [undefined, false],
  ] as const)(
    'an approve 200 whose re-read fails sets provisioned only when provisioning_status was defined (%s: Resend %s)',
    async (provisioning_status, showsResend) => {
      const user = userEvent.setup();
      stubRoutes({
        [APPROVE]: [200, { ok: true, participant_id: 'p-9', status: 'approved' }],
        [REREAD]: [500, {}],
      });
      render(<RegistrationDetail detail={makeDetail({ risk_tier: 'standard', provisioning_status })} />);

      await user.click(screen.getByRole('button', { name: /^approve$/i }));
      await user.click(screen.getByRole('button', { name: /confirm approval/i }));

      await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Resend setup email' }) !== null).toBe(showsResend);
      expect(screen.queryByRole('button', { name: 'Retry provisioning' })).not.toBeInTheDocument();
    },
  );

  it('the Resend button on the page is disabled while a send is in flight', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({ [RESEND]: 'never' });
    render(<RegistrationDetail detail={approvedDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));

    expect(screen.getAllByRole('button', { name: 'Resend setup email' })[0]).toBeDisabled();
  });

  it("a successful resend re-reads the new link's expiry, so Resend stays disabled past the cooldown", async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    stubRoutes({
      [RESEND]: [200, { ok: true, last_invite_sent_at: '2026-10-05T22:00:00.000Z' }],
      [REREAD]: [
        200,
        {
          request: approvedDetail({
            last_invite_sent_at: '2026-10-05T22:00:00.000Z',
            last_invite_expires_at: '2026-10-09T22:00:00.000Z',
          }),
        },
      ],
    });
    const { rerender } = render(<RegistrationDetail detail={approvedDetail({ last_invite_expires_at: '2026-10-05T21:40:00.000Z' })} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Setup email sent.'));
    expect(callsTo(REREAD)).toHaveLength(1);

    at('2026-10-05T22:30:00.000Z'); // past the 10-minute cooldown
    rerender(<RegistrationDetail detail={approvedDetail({ last_invite_expires_at: '2026-10-05T21:40:00.000Z' })} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled();
    expect(
      screen.getByText(
        'The current setup link is valid until 2026-10-09 22:00 UTC. A new one can be sent after it expires.',
      ),
    ).toBeInTheDocument();
  });

  it('a resend whose re-read fails leaves the expiry unknown: a later modal does not claim it has expired', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    const stale = approvedDetail({ last_invite_expires_at: '2026-10-05T21:40:00.000Z' });
    stubRoutes({ [RESEND]: [200, { ok: true, last_invite_sent_at: '2026-10-05T22:00:00.000Z' }] }); // re-read unstubbed: fails
    const { rerender } = render(<RegistrationDetail detail={stale} />);
    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await user.click(screen.getByRole('button', { name: 'Confirm resend' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Setup email sent.'));

    at('2026-10-05T22:30:00.000Z');
    rerender(<RegistrationDetail detail={stale} />);
    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    expect(screen.getByRole('dialog', { name: 'Resend setup email' })).not.toHaveTextContent(
      'The previous link has expired.',
    );
  });

  it("a successful retry re-reads the new link's expiry, so Resend stays disabled past the cooldown", async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    const none = approvedDetail({ provisioning_status: 'none', last_invite_sent_at: null });
    stubRoutes({
      [RETRY]: [
        200,
        { ok: true, participant_id: 'p-9', provisioning_status: 'provisioned', last_invite_sent_at: '2026-10-05T22:00:00.000Z' },
      ],
      [REREAD]: [
        200,
        {
          request: approvedDetail({
            last_invite_sent_at: '2026-10-05T22:00:00.000Z',
            last_invite_expires_at: '2026-10-09T22:00:00.000Z',
          }),
        },
      ],
    });
    const { rerender } = render(<RegistrationDetail detail={none} />);
    await user.click(screen.getByRole('button', { name: 'Retry provisioning' }));
    await user.click(screen.getByRole('button', { name: 'Confirm retry' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Provisioning complete.'));
    expect(callsTo(REREAD)).toHaveLength(1);

    at('2026-10-05T22:30:00.000Z');
    rerender(<RegistrationDetail detail={none} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled();
    expect(screen.getByText(/The current setup link is valid until 2026-10-09 22:00 UTC/)).toBeInTheDocument();
  });

  it("an approve re-read adopts the link's expiry, so Resend stays disabled past the cooldown", async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    const pending = makeDetail({ risk_tier: 'standard' });
    stubRoutes({
      [APPROVE]: [200, { ok: true, participant_id: 'p-9', status: 'approved' }],
      [REREAD]: [
        200,
        {
          request: approvedDetail({
            last_invite_sent_at: '2026-10-05T22:00:00.000Z',
            last_invite_expires_at: '2026-10-09T22:00:00.000Z',
          }),
        },
      ],
    });
    const { rerender } = render(<RegistrationDetail detail={pending} />);
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Registration approved.'));

    at('2026-10-05T22:30:00.000Z');
    rerender(<RegistrationDetail detail={pending} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled();
    expect(screen.getByText(/The current setup link is valid until 2026-10-09 22:00 UTC/)).toBeInTheDocument();
  });

  it('with the previous link\'s expiry unknown the modal does not claim it has expired', async () => {
    const user = userEvent.setup();
    at('2026-10-05T22:00:00.000Z');
    render(<RegistrationDetail detail={approvedDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Resend setup email' }));
    const dialog = screen.getByRole('dialog', { name: 'Resend setup email' });
    expect(dialog).toHaveTextContent('Send a new setup link to jane@example.com? It lasts 4 days.');
    expect(dialog).not.toHaveTextContent('The previous link has expired.');
  });

  it('with a live link known the page shows the live-link line, not a cooldown time that does not free Resend', () => {
    at('2026-10-05T21:45:00.000Z'); // inside the cooldown, link live until 10-09
    render(<RegistrationDetail detail={liveDetail()} />);
    expect(screen.getByRole('button', { name: 'Resend setup email' })).toBeDisabled();
    expect(
      screen.getByText(
        'The current setup link is valid until 2026-10-09 21:40 UTC. A new one can be sent after it expires.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Available again at/)).not.toBeInTheDocument();
  });
});
