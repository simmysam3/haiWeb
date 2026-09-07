import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { UsersTable } from '../users-table';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function postCall(fetchMock: ReturnType<typeof vi.spyOn>) {
  return fetchMock.mock.calls.find(
    (c: unknown[]) => c[0] === '/api/account/users' && (c[1] as RequestInit | undefined)?.method === 'POST',
  );
}

function callTo(fetchMock: ReturnType<typeof vi.spyOn>, url: string, method: string) {
  return fetchMock.mock.calls.find(
    (c: unknown[]) => c[0] === url && (c[1] as RequestInit | undefined)?.method === method,
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
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    // Exact 'Role': the dialog itself is now accessibly named "Edit User"
    // (Modal aria-label), so /role/i would match two elements.
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'procurement_transact' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText(/role change rejected/i)).toBeInTheDocument();
    expect(screen.queryByText(/user updated/i)).not.toBeInTheDocument();
  });

  it('deactivate: surfaces the error and shows no success toast when the PATCH fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'cannot deactivate' }, 500)); // PATCH fails

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i })); // row button opens the modal
    const buttons = screen.getAllByRole('button', { name: /deactivate/i });
    fireEvent.click(buttons[buttons.length - 1]); // modal confirm

    expect(await screen.findByText(/cannot deactivate/i)).toBeInTheDocument();
    expect(screen.queryByText(/user deactivated/i)).not.toBeInTheDocument();

    const patch = callTo(fetchMock, '/api/account/users/u1', 'PATCH');
    expect(patch).toBeTruthy();
    expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({ status: 'disabled' });
  });
});

describe('UsersTable — edit name and role (email is never editable)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('prefills the names, shows the email read-only with the delete-and-reinvite sentence, and sends only what changed', async () => {
    const saved = { ...seedUser, first_name: 'Josephine' };
    let gets = 0;
    // Routed by URL + method: a successful save re-reads the roster, so more
    // than one request hits the same URL and an order-based script cannot say
    // which is which.
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        return jsonResponse(gets === 1 ? [seedUser] : [saved]);
      }
      if (url === '/api/account/users/u1' && method === 'PATCH') {
        return jsonResponse({ success: true, user_id: 'u1', first_name: 'Josephine', last_name: 'Lee' });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByLabelText(/first name/i)).toHaveValue('Jo');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Lee');
    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveValue('jo@acme.com');
    expect(email).toBeDisabled();
    expect(screen.getByText(/delete this user and invite them again/i)).toBeInTheDocument();
    // The role definition is available at the dropdown (WK-2 as ruled). Scoped
    // to the dialog: the roster pill for this row carries the same sentence as
    // screen-reader text, so an unscoped getByText would match two elements.
    const dialog = screen.getByRole('dialog', { name: /edit user/i });
    expect(within(dialog).getByText('Buyer role with view-only access.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Josephine' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(callTo(fetchMock, '/api/account/users/u1', 'PATCH')).toBeTruthy());
    const patch = callTo(fetchMock, '/api/account/users/u1', 'PATCH')!;
    // Only the name travelled: no role (an unchanged role must not trigger a
    // remove-then-add cycle), never an email.
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({ first_name: 'Josephine', last_name: 'Lee' });

    // Settled deterministically: the save re-reads the roster, and that GET must
    // land inside the test body or React warns about a state update outside act.
    await waitFor(() => expect(gets).toBe(2));
    expect(await screen.findByText('Josephine Lee')).toBeInTheDocument();
    expect(screen.getByText(/user updated/i)).toBeInTheDocument();
  });

  it('keeps Save disabled when a name is cleared to whitespace', async () => {
    // The BFF 400s on a blank name; a Save that fires it only shows the user an
    // error it could have prevented.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([seedUser]));
    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'J' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('edit: re-reads the roster after a successful save', async () => {
    // The saved name and role must come from the roster the list endpoint
    // resolves, and a load still in flight must be superseded, not raced.
    const saved = { ...seedUser, first_name: 'Josephine' };
    let gets = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        return jsonResponse(gets === 1 ? [seedUser] : [saved]);
      }
      if (url === '/api/account/users/u1' && method === 'PATCH') {
        return jsonResponse({ success: true, user_id: 'u1', first_name: 'Josephine', last_name: 'Lee' });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Josephine' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(gets).toBe(2));
    expect(await screen.findByText('Josephine Lee')).toBeInTheDocument();
  });

  it('sends only the role when only the role changed', async () => {
    // An unchanged name must not travel: the BFF would rewrite it through the
    // name PUT for nothing, and the email never travels at all.
    const governing = { ...seedUser, role: 'procurement_transact' };
    let gets = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        return jsonResponse(gets === 1 ? [seedUser] : [governing]);
      }
      if (url === '/api/account/users/u1' && method === 'PATCH') {
        return jsonResponse({ success: true, user_id: 'u1', role: 'procurement_transact' });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'procurement_transact' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(callTo(fetchMock, '/api/account/users/u1', 'PATCH')).toBeTruthy());
    const patch = callTo(fetchMock, '/api/account/users/u1', 'PATCH')!;
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({ role: 'procurement_transact' });

    // Settled deterministically: the save re-reads the roster, and that GET must
    // land inside the test body or React warns about a state update outside act.
    await waitFor(() => expect(gets).toBe(2));
    // Asserted on the row, not on the pill's text: <Pill> renders the label
    // beside an sr-only definition, so its textContent is never just the label.
    expect(screen.getByText('Jo Lee').closest('tr')).toHaveTextContent('Procurement Transact');
  });

  it('keeps Save disabled until something differs from the row', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([seedUser]));
    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'procurement_transact' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });
});

describe('UsersTable — permanent delete', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('confirms by naming the user and their email, sends the email in the body, removes the row and toasts', async () => {
    let gets = 0;
    // Routed by URL + method: a successful delete re-reads the roster, so more
    // than one request hits the same URL and an order-based script cannot say
    // which is which — an unscripted GET would fall through to the real fetch
    // and this test would pass on the outage panel instead of the delete.
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        return jsonResponse(gets === 1 ? [seedUser] : []);
      }
      if (url === '/api/account/users/u1' && method === 'DELETE') {
        return jsonResponse({ success: true, user_id: 'u1', deleted: true });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i })); // row button opens the modal

    const dialog = screen.getByRole('dialog', { name: /delete user/i });
    expect(dialog).toHaveTextContent('Jo Lee');
    expect(dialog).toHaveTextContent('jo@acme.com');
    expect(dialog).toHaveTextContent(/can't be restored/i);
    expect(dialog).toHaveTextContent(/records of what they did in this account are kept/i);

    const buttons = screen.getAllByRole('button', { name: /^delete$/i });
    fireEvent.click(buttons[buttons.length - 1]); // modal confirm

    await waitFor(() => expect(callTo(fetchMock, '/api/account/users/u1', 'DELETE')).toBeTruthy());
    const del = callTo(fetchMock, '/api/account/users/u1', 'DELETE')!;
    expect(JSON.parse((del[1] as RequestInit).body as string)).toEqual({ email: 'jo@acme.com' });

    await waitFor(() => expect(screen.queryByText('Jo Lee')).not.toBeInTheDocument());
    // Settled deterministically: the delete re-reads the roster, and that GET
    // must land inside the test body or React warns about a state update
    // outside act. The table is still the table, not the outage panel.
    await waitFor(() => expect(gets).toBe(2));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/user deleted/i)).toBeInTheDocument();
  });

  it('surfaces the BFF sentence, keeps the row and shows no toast when the delete fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'The user could not be deleted. Nothing was changed.' }, 500));

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    const buttons = screen.getAllByRole('button', { name: /^delete$/i });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText(/could not be deleted/i)).toBeInTheDocument();
    // Scoped to the table: the confirm dialog stays open on failure and its own
    // <strong> also reads "Jo Lee" verbatim, so an unscoped getByText would
    // match two elements.
    expect(within(screen.getByRole('table')).getByText('Jo Lee')).toBeInTheDocument();
    expect(screen.queryByText(/user deleted/i)).not.toBeInTheDocument();
  });

  it('keeps the row and shows no toast when the server answers without deleted: true', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    // An older instance reached mid-deploy: it disabled the user and answered
    // the old shape, without the flag that says the user is gone.
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, user_id: 'u1' })); // DELETE

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    const buttons = screen.getAllByRole('button', { name: /^delete$/i });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText('The user was not deleted. Reload the page and try again.')).toBeInTheDocument();
    // Scoped to the table: the confirm dialog stays open and its own <strong>
    // reads 'Jo Lee' verbatim too.
    expect(within(screen.getByRole('table')).getByText('Jo Lee')).toBeInTheDocument();
    expect(screen.queryByText(/user deleted/i)).not.toBeInTheDocument();
  });

  it('offers Delete on a disabled row too (the re-create path for a wrong email)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([{ ...seedUser, status: 'disabled' }]));
    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });
});

describe('UsersTable — deactivate re-reads the roster (§L-29)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('deactivate: re-reads the roster after a successful deactivation', async () => {
    // Without the re-read a roster load still in flight could land afterwards
    // and show the user as Active again.
    const disabled = { ...seedUser, status: 'disabled' };
    let gets = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        return jsonResponse(gets === 1 ? [seedUser] : [disabled]);
      }
      if (url === '/api/account/users/u1' && method === 'PATCH') {
        return jsonResponse({ success: true, user_id: 'u1', status: 'disabled' });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i })); // row button opens the modal
    const buttons = screen.getAllByRole('button', { name: /deactivate/i });
    fireEvent.click(buttons[buttons.length - 1]); // modal confirm

    expect(await screen.findByText(/user deactivated/i)).toBeInTheDocument();
    const patch = callTo(fetchMock, '/api/account/users/u1', 'PATCH')!;
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({ status: 'disabled' });
    await waitFor(() => expect(gets).toBe(2));
  });
});

describe('UsersTable — a load in flight never resurrects a deleted row (§L-29)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('delete: a roster read that started before the delete never brings the row back', async () => {
    // The brief's shape — hold the INITIAL load open and delete a row — cannot
    // be built: until that load settles the table is the empty fallback, so
    // there is no row and no Delete button. The invite's own re-read is the
    // load that can be in flight while a row is on screen, so the race is
    // staged there: it is held open across the delete and answers afterwards
    // with the roster as it stood before it.
    const existing = { ...seedUser, id: 'u1', first_name: 'Ada', last_name: 'Byron', email: 'ada@acme.com' };
    const invited = {
      id: 'u9', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee',
      role: 'buyer_view_only', job_title: '', phone: '', status: 'active', last_login: 'Never',
    };
    let resolveInviteReread!: (res: Response) => void;
    const inviteReread = new Promise<Response>((resolve) => { resolveInviteReread = resolve; });
    let gets = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        if (gets === 1) return jsonResponse([existing]);
        // The invite's re-read is held open until the delete has landed; every
        // later read reports the roster after the delete.
        return gets === 2 ? inviteReread : jsonResponse([existing]);
      }
      if (url === '/api/account/users' && method === 'POST') return jsonResponse(invited, 201);
      if (url === '/api/account/users/u9' && method === 'DELETE') {
        return jsonResponse({ success: true, user_id: 'u9', deleted: true });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    // The initial load settles first, so the only read still in flight later is
    // the invite's — the one this test holds open.
    await screen.findByText('Ada Byron');
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lee' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));
    expect(await screen.findByText('Jo Lee')).toBeInTheDocument();

    const rowDelete = within(screen.getByText('Jo Lee').closest('tr')!).getByRole('button', { name: /^delete$/i });
    fireEvent.click(rowDelete);
    const buttons = screen.getAllByRole('button', { name: /^delete$/i });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(within(screen.getByRole('table')).queryByText('Jo Lee')).not.toBeInTheDocument());
    // The delete re-read supersedes the invite's, which is still open.
    await waitFor(() => expect(gets).toBe(3));

    // Only now does the pre-delete roster answer. Flushed to exhaustion so the
    // settle is not merely still pending.
    await act(async () => {
      resolveInviteReread(jsonResponse([existing, invited]));
      for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByText('Jo Lee')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Byron')).toBeInTheDocument();
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

describe('UsersTable — an invite that created the user but could not finish (§L-34)', () => {
  beforeEach(() => vi.restoreAllMocks());

  const created = { ...seedUser, id: 'u9', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee' };
  const banner = 'The user was created but the invitation email could not be sent.';

  function fillAndSend() {
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lee' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jo@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));
  }

  it('re-reads the roster, keeps the banner, and refuses a repeat when the BFF names a created user', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: banner, user_id: 'u9' }, 500)); // POST: created, email failed
    fetchMock.mockResolvedValueOnce(jsonResponse([created])); // the re-read

    render(<UsersTable />);
    fillAndSend();

    // The roster behind the dialog now shows the user Keycloak holds.
    expect(await screen.findByText('Jo Lee')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/account/users' && ((c[1] as RequestInit | undefined)?.method ?? 'GET') === 'GET')).toHaveLength(2);
    // The sentence stays where the user is looking; a second Send is refused.
    expect(screen.getByText(banner)).toBeInTheDocument();
    const sendButton = screen.getByRole('button', { name: /send invitation/i });
    expect(sendButton).toBeDisabled();
    // Scoped to the footer: the Modal chrome's own icon button also carries
    // aria-label="Close", so an unscoped query matches two elements.
    const footer = sendButton.closest('div')!;
    expect(within(footer).getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    expect(within(footer).queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();

    // Closing and reopening starts a fresh invite: the refusal was about the
    // address just submitted, so it must not outlive the dialog that carried it.
    fireEvent.click(within(footer).getByRole('button', { name: /^close$/i }));
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    const reopenedSend = screen.getByRole('button', { name: /send invitation/i });
    expect(reopenedSend).toBeEnabled();
    const reopenedFooter = reopenedSend.closest('div')!;
    expect(within(reopenedFooter).getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(within(reopenedFooter).queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(banner)).not.toBeInTheDocument();
  });

  it('leaves the nothing-created path untouched: no re-read, Send enabled, Cancel (negative control)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([])); // initial GET
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'The invitation could not be completed. Nothing was created.' }, 500),
    );

    render(<UsersTable />);
    fillAndSend();

    expect(await screen.findByText(/nothing was created/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/account/users' && ((c[1] as RequestInit | undefined)?.method ?? 'GET') === 'GET')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.queryByText('Jo Lee')).not.toBeInTheDocument();
  });

  it('keeps the open dialog, its banner and the disabled Send beside the outage panel when the re-read fails', async () => {
    const existing = { ...seedUser, id: 'u1', first_name: 'Ada', last_name: 'Byron', email: 'ada@acme.com' };
    let gets = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/account/users' && method === 'GET') {
        gets += 1;
        // The user was created; the re-read the dialog triggers then goes down.
        return gets === 1 ? jsonResponse([existing]) : jsonResponse({ error: 'Could not load users' }, 502);
      }
      if (url === '/api/account/users' && method === 'POST') return jsonResponse({ error: banner, user_id: 'u9' }, 500);
      throw new Error(`unexpected ${method} ${url}`);
    });

    render(<UsersTable />);
    await screen.findByText('Ada Byron');
    fillAndSend();

    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The dialog is still open: without it the outage reads as a failed invite
    // and the same person is invited again.
    expect(screen.getByText(banner)).toBeInTheDocument();
    const sendButton = screen.getByRole('button', { name: /send invitation/i });
    expect(sendButton).toBeDisabled();
    expect(within(sendButton.closest('div')!).getByRole('button', { name: /^close$/i })).toBeInTheDocument();
  });
});
