/**
 * Regression: LoginPage must read credentials from FormData(form), NOT from
 * React useState, so that browser autofill (which populates the DOM without
 * firing React's onChange) still submits real credentials.
 *
 * A regression back to `JSON.stringify({ email, password })` from state would
 * cause the autofill test to fail: state would be "" for both fields, so fetch
 * would be called with `{"email":"","password":""}` — the assertion that checks
 * for the real credential values would not match.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../page';

// next/navigation is required by the LoginPage component (useRouter)
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  mockPush.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Reset localStorage between tests — the login page reads
  // LAST_ACCOUNT_PATH_KEY to honor session stickiness.
  window.localStorage.clear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the JSON body that the submit handler sent to fetch. */
async function capturedBody(): Promise<{ email: string; password: string }> {
  expect(fetchMock).toHaveBeenCalledOnce();
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string) as { email: string; password: string };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage — autofill regression (FormData vs React state)', () => {
  /**
   * CRITICAL regression test.
   *
   * Simulates browser autofill: the user never types into the inputs, so React
   * onChange never fires and useState remains "". The browser writes directly to
   * the DOM element's `.value` property. We replicate that here by assigning
   * `input.value` without going through React's synthetic change event.
   *
   * The submit handler MUST read from `new FormData(e.currentTarget)` so it
   * picks up the DOM values rather than the stale React state.
   *
   * Under a state-read regression the fetch body would be:
   *   {"email":"","password":""}
   * and the assertion below would fail, catching the bug.
   */
  it('submits autofilled credentials (DOM value bypasses React state)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement;
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Simulate autofill: write directly to the DOM value without firing onChange.
    // React state (email, password) stays "". FormData(form) will see these values.
    emailInput.value = 'autofilled@example.com';
    passwordInput.value = 'AutofilledSecret99!';

    fireEvent.click(submitButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect((init.method ?? '').toUpperCase()).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });

    const body = JSON.parse(init.body as string) as { email: string; password: string };
    // These must be the autofilled DOM values, NOT empty strings from React state.
    expect(body.email).toBe('autofilled@example.com');
    expect(body.password).toBe('AutofilledSecret99!');
  });

  /**
   * Sanity path: normal typing through React's onChange also works.
   * (fireEvent.change drives both the DOM value and React's synthetic event,
   * so both FormData and state would have the value. This path always works
   * regardless of which source is read — it documents expected happy-path
   * behaviour alongside the autofill regression test.)
   */
  it('submits typed credentials via onChange path', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/you@company.com/i);
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Normal typing path: fireEvent.change drives React onChange so both the
    // DOM value and React state are updated.
    fireEvent.change(emailInput, { target: { value: 'typed@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'TypedPassword42!' } });

    fireEvent.click(submitButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const body = await capturedBody();
    expect(body.email).toBe('typed@example.com');
    expect(body.password).toBe('TypedPassword42!');
  });

  /**
   * On a failed login (non-ok response) the page should show an error message
   * and NOT navigate away.
   */
  it('displays the server error message and does not redirect on failure', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement;
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;

    emailInput.value = 'bad@example.com';
    passwordInput.value = 'wrong';

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => screen.getByText(/invalid credentials/i));
    expect(mockPush).not.toHaveBeenCalled();
  });

  /**
   * On a network error the page should show the fallback error message.
   */
  it('displays a network error message when fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('net::ERR_FAILED'));

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement;
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;

    emailInput.value = 'user@example.com';
    passwordInput.value = 'somepassword';

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => screen.getByText(/network error/i));
    expect(mockPush).not.toHaveBeenCalled();
  });

  /**
   * On a successful login the router should navigate to /account.
   */
  it('redirects to /account on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement;
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;

    emailInput.value = 'user@example.com';
    passwordInput.value = 'correctpassword';

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/account'));
  });
});

describe('LoginPage — session stickiness (v.1.41)', () => {
  /** Helper: simulate a successful login and return the redirect target. */
  async function submitAndCaptureRedirect(): Promise<unknown> {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement;
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
    emailInput.value = 'user@example.com';
    passwordInput.value = 'correctpassword';
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    return mockPush.mock.calls[0][0];
  }

  it('redirects to the stored last-visited account path on success', async () => {
    window.localStorage.setItem(
      'haiwave:last-account-path',
      '/account/sonar/audit/events?severity=warning',
    );
    const target = await submitAndCaptureRedirect();
    expect(target).toBe('/account/sonar/audit/events?severity=warning');
  });

  it('falls back to /account when no last-visited path is stored', async () => {
    const target = await submitAndCaptureRedirect();
    expect(target).toBe('/account');
  });

  it('rejects stored values that do not start with /account (open-redirect guard)', async () => {
    window.localStorage.setItem('haiwave:last-account-path', 'https://evil.example.com/phish');
    const target = await submitAndCaptureRedirect();
    expect(target).toBe('/account');
  });

  it('rejects protocol-relative URLs (//evil.com) in the stored value', async () => {
    window.localStorage.setItem('haiwave:last-account-path', '//evil.example.com/phish');
    const target = await submitAndCaptureRedirect();
    expect(target).toBe('/account');
  });
});

describe('LoginPage — admin landing (gatekeeper console)', () => {
  it('routes admins straight to the gatekeeper console on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, is_admin: true }),
    } as Response);

    render(<LoginPage />);
    (screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement).value = 'admin@haiwave.ai';
    (document.querySelector('input[name="password"]') as HTMLInputElement).value = 'secret';
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/account/admin/registrations'),
    );
  });

  it('admin landing wins over a stored last-account path', async () => {
    window.localStorage.setItem('haiwave:last-account-path', '/account/profile');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, is_admin: true }),
    } as Response);

    render(<LoginPage />);
    (screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement).value = 'admin@haiwave.ai';
    (document.querySelector('input[name="password"]') as HTMLInputElement).value = 'secret';
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/account/admin/registrations'),
    );
  });

  it('non-admins still follow the sticky/account redirect', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, is_admin: false }),
    } as Response);

    render(<LoginPage />);
    (screen.getByPlaceholderText(/you@company.com/i) as HTMLInputElement).value = 'user@example.com';
    (document.querySelector('input[name="password"]') as HTMLInputElement).value = 'secret';
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/account'));
  });
});
