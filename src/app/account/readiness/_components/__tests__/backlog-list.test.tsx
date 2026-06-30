import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { BacklogList } from '../backlog-list';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

it('shows observed vs needed and posts a transition', async () => {
  const item = {
    backlog_item_id: 'b1',
    state: 'open' as const,
    created_at: '2026-06-29T00:00:00Z',
    updated_at: '2026-06-29T01:00:00Z',
    audit_ref: null,
    event: {
      event_type: 'quantity_short' as const,
      component: 'leather' as const,
      color_code: 'TOLU-33',
      length_cm: null,
      observed: { amount: 1250, unit: 'sq_ft' as const },
      needed: { amount: 1500, unit: 'sq_ft' as const },
      severity: 'warning' as const,
      supplier_ref: '2f4dcc8b-1234-5678-90ab-cdef01234567',
      sku_ref: 'VOMERO-IRONSTONE',
      audit_ref: null,
    },
  };
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response('{}', { status: 200 }),
  );
  render(<BacklogList items={[item]} />);
  expect(screen.getByText(/1[,.]?250/)).toBeInTheDocument();
  expect(screen.getByText(/1[,.]?500/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /acknowledge/i }));
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/api/account/readiness/backlog/b1/transition'),
    expect.objectContaining({ method: 'POST' }),
  );
});
