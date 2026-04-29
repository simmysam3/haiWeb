import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmStep } from '../confirm-step';

const VENDOR = { id: 'v1', legal_name: 'Apex Manufacturing' };

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ scope_id: 'new' }), { status: 200 }),
  ) as unknown as typeof fetch;
});

describe('ConfirmStep', () => {
  it('renders vendor name and a row per selected scope', () => {
    render(
      <ConfirmStep
        vendor={VENDOR}
        selections={{ classes: new Set(['c1']), products: new Set(['p1', 'p2']) }}
        classLabels={{ c1: 'Ball Bearings' }}
        productLabels={{ p1: '6201 Bearing', p2: '6202 Bearing' }}
        onSubmitted={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText(/apex manufacturing/i)).toBeInTheDocument();
    expect(screen.getByText('Ball Bearings')).toBeInTheDocument();
    expect(screen.getByText('6201 Bearing')).toBeInTheDocument();
    expect(screen.getByText('6202 Bearing')).toBeInTheDocument();
  });

  it('fires N parallel POSTs and calls onSubmitted on full success', async () => {
    const onSubmitted = vi.fn();
    render(
      <ConfirmStep
        vendor={VENDOR}
        selections={{ classes: new Set(['c1']), products: new Set(['p1']) }}
        classLabels={{ c1: 'Ball Bearings' }}
        productLabels={{ p1: '6201 Bearing' }}
        onSubmitted={onSubmitted}
        onBack={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /submit nominations/i }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const [classCall, productCall] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(classCall[0]).toBe('/api/account/audit-scopes');
    expect(JSON.parse(classCall[1].body as string)).toEqual({
      vendor_participant_id: 'v1',
      scope_type: 'class',
      scope_ref: 'c1',
    });
    expect(JSON.parse(productCall[1].body as string)).toEqual({
      vendor_participant_id: 'v1',
      scope_type: 'product',
      scope_ref: 'p1',
    });
  });

  it('treats 409 (duplicate) as success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('duplicate', { status: 409 }),
    ) as unknown as typeof fetch;
    const onSubmitted = vi.fn();
    render(
      <ConfirmStep
        vendor={VENDOR}
        selections={{ classes: new Set(['c1']), products: new Set() }}
        classLabels={{ c1: 'Ball Bearings' }}
        productLabels={{}}
        onSubmitted={onSubmitted}
        onBack={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /submit nominations/i }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  });

  it('reports partial failures and leaves form usable for retry', async () => {
    let callIdx = 0;
    globalThis.fetch = vi.fn(async () => {
      callIdx += 1;
      if (callIdx === 1) return new Response(JSON.stringify({ scope_id: 'ok' }), { status: 200 });
      return new Response('boom', { status: 500 });
    }) as unknown as typeof fetch;
    const onSubmitted = vi.fn();
    render(
      <ConfirmStep
        vendor={VENDOR}
        selections={{ classes: new Set(['c1']), products: new Set(['p1']) }}
        classLabels={{ c1: 'Ball Bearings' }}
        productLabels={{ p1: '6201 Bearing' }}
        onSubmitted={onSubmitted}
        onBack={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /submit nominations/i }));
    await waitFor(() =>
      expect(screen.getByText(/1 of 2 nominations created/i)).toBeInTheDocument(),
    );
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /submit nominations/i })).not.toBeDisabled();
  });
});
