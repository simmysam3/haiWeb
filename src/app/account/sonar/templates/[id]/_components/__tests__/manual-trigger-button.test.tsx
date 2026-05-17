import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManualTriggerButton } from '../manual-trigger-button';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('swr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('swr')>();
  return { ...actual, mutate: vi.fn() };
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('ManualTriggerButton', () => {
  it('shows the network error message when fetch rejects (silent-failure regression)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(
      <ManualTriggerButton
        templateId="tmpl-1"
        enabled={true}
        observationClass="audit"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(/network error — could not reach the server/i);
    // Bare status-code string must not appear
    expect(screen.queryByText(/trigger failed/i)).not.toBeInTheDocument();
  });

  it('on 401 shows session-expired message with a Sign in link, not a status code', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    render(
      <ManualTriggerButton
        templateId="tmpl-1"
        enabled={true}
        observationClass="audit"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session has expired/i);
    expect(screen.queryByText(/trigger failed \(401\)/i)).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /sign in again/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('on 500 surfaces describeApiError message, not "Trigger failed (500)"', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
        }),
        { status: 500 },
      ),
    );
    render(
      <ManualTriggerButton
        templateId="tmpl-1"
        enabled={true}
        observationClass="audit"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/unexpected server error/i);
    expect(screen.queryByText(/trigger failed \(500\)/i)).not.toBeInTheDocument();
  });

  it('on success renders the Started badge and Open link', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ run_id: 'run-abc-123' }), { status: 200 }),
    );
    render(
      <ManualTriggerButton
        templateId="tmpl-1"
        enabled={true}
        observationClass="audit"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    expect(await screen.findByText('Started')).toBeInTheDocument();
    const openLink = screen.getByRole('link', { name: /open/i });
    expect(openLink).toHaveAttribute(
      'href',
      '/account/sonar/audit/runs/run-abc-123',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
