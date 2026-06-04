import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
