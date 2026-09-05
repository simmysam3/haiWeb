import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UsersTable } from '../users-table';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function postCall(fetchMock: ReturnType<typeof vi.spyOn>) {
  return fetchMock.mock.calls.find(
    (c: unknown[]) => c[0] === '/api/account/users' && (c[1] as RequestInit | undefined)?.method === 'POST',
  );
}

const seedUser = {
  id: 'u1', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee',
  role: 'buyer_view_only', job_title: '', phone: '', status: 'active', last_login: 'Never',
};

describe('UsersTable — invite', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends email + first_name + last_name + role and adds the created user on success', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([])); // initial useApi GET
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'u1', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee', role: 'buyer_view_only' }, 201),
    );
    // A successful invite re-reads the roster (§L-29); without a third scripted
    // response that GET falls through to the real fetch.
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser]));

    render(<UsersTable />);
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lee' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      const post = postCall(fetchMock);
      expect(post).toBeTruthy();
      expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
        email: 'jo@acme.com',
        first_name: 'Jo',
        last_name: 'Lee',
        role: 'buyer_view_only',
      });
    });

    expect(await screen.findByText('Jo Lee')).toBeInTheDocument();
  });

  it('surfaces the BFF error and adds no optimistic row when the invite fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Keycloak unavailable' }, 500)); // POST fails

    render(<UsersTable />);
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lee' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    expect(await screen.findByText(/keycloak unavailable/i)).toBeInTheDocument();
    // The invitee was never created — the old bug showed a fake success row here.
    expect(screen.queryByText('Jo Lee')).not.toBeInTheDocument();
  });

  it('blocks submit with a message and fires no request when a name is missing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([])); // initial GET

    render(<UsersTable />);
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    expect(await screen.findByText(/required/i)).toBeInTheDocument();
    expect(postCall(fetchMock)).toBeUndefined();
  });
});

describe('UsersTable — mutations surface failures (no fire-and-forget)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('edit-role: surfaces the error and shows no success toast when the PATCH fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'role change rejected' }, 500)); // PATCH fails

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /edit role/i }));
    // Exact 'Role': the dialog itself is now accessibly named "Edit Role"
    // (Modal aria-label), so /role/i would match two elements.
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'procurement_transact' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText(/role change rejected/i)).toBeInTheDocument();
    expect(screen.queryByText(/role updated/i)).not.toBeInTheDocument();
  });

  it('deactivate: surfaces the error and shows no success toast when the DELETE fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'cannot deactivate' }, 500)); // DELETE fails

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i })); // row button opens the modal
    const buttons = screen.getAllByRole('button', { name: /deactivate/i });
    fireEvent.click(buttons[buttons.length - 1]); // modal confirm

    expect(await screen.findByText(/cannot deactivate/i)).toBeInTheDocument();
    expect(screen.queryByText(/user deactivated/i)).not.toBeInTheDocument();
  });
});

describe('UsersTable — load error', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows a distinct error state with Retry (not an empty "0 users" list) when the load fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Could not load users' }, 502));

    render(<UsersTable />);
    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument();
    // An outage must NOT read as "this account has no users".
    expect(screen.queryByText(/0 users/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('UsersTable — a late initial load never wipes an invited row (§L-29)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('keeps the invited user on the page when the initial roster GET settles after the invite', async () => {
    let resolveInitial!: (res: Response) => void;
    const initialGet = new Promise<Response>((resolve) => { resolveInitial = resolve; });
    const invited = {
      id: 'u9', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee',
      role: 'buyer_view_only', job_title: '', phone: '', status: 'active', last_login: 'Never',
    };
    let gets = 0;

    // Routed by URL + method: after the fix three requests hit the same URL and
    // an order-based mock script cannot say which is which.
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        // The initial load is held open until the invite has landed.
        return gets === 1 ? initialGet : jsonResponse([invited]);
      }
      if (url === '/api/account/users' && method === 'POST') return jsonResponse(invited, 201);
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lee' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => expect(postCall(fetchMock)).toBeTruthy());
    expect(await screen.findByText('Jo Lee')).toBeInTheDocument();

    // Only now does the initial load answer, with a roster that predates the
    // invite. Flushed to exhaustion so the settle is not merely still pending.
    await act(async () => {
      resolveInitial(jsonResponse([]));
      for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText('Jo Lee')).toBeInTheDocument();
  });
});

describe('UsersTable — the roster is re-read after a successful invite (§L-29)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders the invited user with the role the roster resolves, not the one the invite echoed', async () => {
    // D-212: the realm role is the governing record. The POST echoes the
    // requested role; the list endpoint reports the role actually mapped.
    const echoed = { id: 'u9', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee', role: 'buyer_view_only' };
    const governing = {
      ...echoed, role: 'procurement_transact',
      job_title: '', phone: '', status: 'active', last_login: 'Never',
    };
    const existing = { ...seedUser, id: 'u1', first_name: 'Ada', last_name: 'Byron', email: 'ada@acme.com' };
    const gets: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets.push(url);
        return jsonResponse(gets.length === 1 ? [existing] : [existing, governing]);
      }
      if (url === '/api/account/users' && method === 'POST') return jsonResponse(echoed, 201);
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    // The initial load settles first, so this test is about the re-read alone
    // and not about the §L-29 race the test above pins down.
    await screen.findByText('Ada Byron');
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lee' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    // Asserted on the row, not on the pill's text: <Pill> renders the label
    // beside an sr-only definition, so its textContent is never just the label.
    await waitFor(() => {
      expect(screen.getByText('Jo Lee').closest('tr')).toHaveTextContent('Procurement Transact');
    });
    expect(gets).toHaveLength(2);
    // The echoed role never survives the re-read.
    expect(screen.getByText('Jo Lee').closest('tr')).not.toHaveTextContent('Buyer View Only');
  });
});

describe('UsersTable — a failed re-read never hides the invite confirmation (§L-29)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows the invitation confirmation beside the outage panel when the post-invite roster re-read fails', async () => {
    const invited = { id: 'u9', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee', role: 'buyer_view_only' };
    const existing = { ...seedUser, id: 'u1', first_name: 'Ada', last_name: 'Byron', email: 'ada@acme.com' };
    let gets = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        // The invite lands, then the re-read it triggers goes down.
        return gets === 1 ? jsonResponse([existing]) : jsonResponse({ error: 'Could not load users' }, 502);
      }
      if (url === '/api/account/users' && method === 'POST') return jsonResponse(invited, 201);
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    await screen.findByText('Ada Byron');
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lee' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The dialog has already closed. Without the confirmation the user reads
    // the outage as a failed invite and invites the same person again.
    expect(screen.getByText('Invitation sent to jo@acme.com')).toBeInTheDocument();
  });
});
