import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivationModal } from '../_components/activation-modal';

interface FetchCall {
  url: string;
  body?: string;
}

let calls: FetchCall[] = [];

function setupFetch(handlers: {
  affected?: () => Response;
  activate?: () => Response;
}) {
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
    if (url.includes('/affected-counterparties')) {
      return Promise.resolve(handlers.affected ? handlers.affected() : new Response(JSON.stringify({ counterparties: [] }), { status: 200 }));
    }
    if (url.includes('/activate')) {
      return Promise.resolve(handlers.activate ? handlers.activate() : new Response(JSON.stringify({ config: { config_id: 'x', trust_class: 'trading_pair', enabled: true, enabled_at: new Date().toISOString() }, dissolution: null }), { status: 200 }));
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as unknown as typeof fetch;
}

describe('ActivationModal', () => {
  beforeEach(() => {
    calls = [];
    setupFetch({
      affected: () =>
        new Response(
          JSON.stringify({
            counterparties: [
              {
                counterparty_participant_id: 'c1',
                counterparty_display_name: 'Acme',
                outstanding_obligation_count: 5,
                explicit_decline_count: 0,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });
  });

  it('shows affected counterparties on mount', async () => {
    render(<ActivationModal trustClass="trading_pair" onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => screen.getByText(/Acme/));
    // Both the list row and the totals row mention "5 outstanding"; the
    // important contract is that the count was rendered visibly on mount.
    expect(screen.getAllByText(/5 outstanding/).length).toBeGreaterThan(0);
  });

  it('disables Activate button on retroactive until checkbox ticked', async () => {
    render(<ActivationModal trustClass="trading_pair" onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => screen.getByText(/Acme/));

    fireEvent.click(screen.getByLabelText(/Retroactive/, { selector: 'input' }));

    const activateBtn = screen.getByRole('button', { name: 'Activate' });
    expect(activateBtn).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/I understand/));
    expect(activateBtn).not.toBeDisabled();
  });

  it('submits forward_only by default and calls onSuccess with 0 preserved declines', async () => {
    const onSuccess = vi.fn();
    render(<ActivationModal trustClass="trading_pair" onClose={() => {}} onSuccess={onSuccess} />);
    await waitFor(() => screen.getByText(/Acme/));

    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(0));

    const activateCall = calls.find((c) => c.url.includes('/activate'));
    expect(activateCall).toBeDefined();
    const body = JSON.parse(activateCall!.body!);
    expect(body.activation_mode).toBe('forward_only');
    expect(body.retroactive_acknowledgement).toBe(false);
  });

  it('submits retroactive with acknowledged=true and reports preserved declines', async () => {
    setupFetch({
      affected: () =>
        new Response(
          JSON.stringify({
            counterparties: [
              {
                counterparty_participant_id: 'c1',
                counterparty_display_name: 'Acme',
                outstanding_obligation_count: 5,
                explicit_decline_count: 2,
              },
            ],
          }),
          { status: 200 },
        ),
      activate: () =>
        new Response(
          JSON.stringify({
            config: {
              config_id: 'x',
              trust_class: 'trading_pair',
              enabled: true,
              enabled_at: '2026-04-29T12:00:00.000Z',
            },
            dissolution: {
              affected_counterparty_ids: ['c1'],
              affected_obligation_ids: ['o1', 'o2', 'o3'],
              preserved_decline_ids: ['d1', 'd2'],
            },
          }),
          { status: 200 },
        ),
    });

    const onSuccess = vi.fn();
    render(<ActivationModal trustClass="trading_pair" onClose={() => {}} onSuccess={onSuccess} />);
    await waitFor(() => screen.getByText(/Acme/));

    fireEvent.click(screen.getByLabelText(/Retroactive/, { selector: 'input' }));
    fireEvent.click(screen.getByLabelText(/I understand/));
    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(2));

    const activateCall = calls.find((c) => c.url.includes('/activate'));
    const body = JSON.parse(activateCall!.body!);
    expect(body.activation_mode).toBe('retroactive');
    expect(body.retroactive_acknowledgement).toBe(true);
  });

  it('surfaces an error message when activation fails', async () => {
    setupFetch({
      activate: () =>
        new Response(JSON.stringify({ error: { code: 'BOOM' } }), { status: 500 }),
    });
    render(<ActivationModal trustClass="trading_pair" onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => screen.getByRole('button', { name: 'Activate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toMatch(/Activation failed/);
  });

  it('renders empty state when no counterparties have settings', async () => {
    setupFetch({
      affected: () => new Response(JSON.stringify({ counterparties: [] }), { status: 200 }),
    });
    render(<ActivationModal trustClass="premier_partner" onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => screen.getByText(/None — no counterparties/));
  });
});
