import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UsersTable } from '../users-table';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function postCall(fetchMock: ReturnType<typeof vi.spyOn>) {
  return fetchMock.mock.calls.find(
    (c: unknown[]) => c[0] === '/api/account/users' && (c[1] as RequestInit | undefined)?.method === 'POST',
  );
}

describe('UsersTable — invite', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends email + first_name + last_name + role and adds the created user on success', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([])); // initial useApi GET
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'u1', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee', role: 'buyer_view_only' }, 201),
    );

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

const seedUser = {
  id: 'u1', email: 'jo@acme.com', first_name: 'Jo', last_name: 'Lee',
  role: 'buyer_view_only', job_title: '', phone: '', status: 'active', last_login: 'Never',
};

describe('UsersTable — mutations surface failures (no fire-and-forget)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('edit-role: surfaces the error and shows no success toast when the PATCH fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'role change rejected' }, 500)); // PATCH fails

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /edit role/i }));
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'procurement_transact' } });
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
