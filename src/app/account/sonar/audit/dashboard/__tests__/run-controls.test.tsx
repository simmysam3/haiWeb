import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { RunControls } from '../run-controls';

describe('RunControls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Run-audit-now and Save-as-template buttons', () => {
    render(<RunControls />);
    expect(screen.getByRole('button', { name: /run audit now/i })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /save as template/i });
    expect(link).toHaveAttribute(
      'href',
      '/account/sonar/templates/new?observation_class=audit',
    );
  });

  it('POSTs a valid company-scoped run trigger (haiCore POST /runs is a discriminated union on scope_type)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    render(<RunControls />);

    await userEvent.click(screen.getByRole('button', { name: /run audit now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/audit-runs');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ scope_type: 'company' });
  });
});
