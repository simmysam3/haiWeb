import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RunAllButton } from '../run-all-button';

const fetchMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('swr', async () => {
  const actual = await vi.importActual<typeof import('swr')>('swr');
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mutateMock }),
  };
});

describe('RunAllButton', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mutateMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('disabled when no enabled templates exist', () => {
    render(<RunAllButton enabledTemplateCount={0} />);
    const btn = screen.getByRole('button', { name: /Run all/i });
    expect(btn).toBeDisabled();
  });

  it('on click: fires POST and mutates the activity-feed key on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ total: 2, triggered: [{ template_id: 'a', run_id: 'r1' }, { template_id: 'b', run_id: 'r2' }], failed: [] }), {
        status: 200,
      }),
    );
    render(<RunAllButton enabledTemplateCount={2} />);
    fireEvent.click(screen.getByRole('button', { name: /Run all/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/sonar/templates/run-all');
    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith('/api/account/sonar/dashboard/activity'),
    );
  });

  it('shows partial-failure feedback when failed[] is non-empty', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ total: 2, triggered: [{ template_id: 'a', run_id: 'r1' }], failed: [{ template_id: 'b', error_message: 'BUSY' }] }), { status: 200 }),
    );
    render(<RunAllButton enabledTemplateCount={2} />);
    fireEvent.click(screen.getByRole('button', { name: /Run all/i }));
    await waitFor(() => screen.getByText(/1 failed/i));
  });
});
