import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateWizard } from '../template-wizard';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('TemplateWizard', () => {
  it('blocks Create and surfaces a name error when name is empty', async () => {
    render(<TemplateWizard />);
    await userEvent.click(
      screen.getByRole('button', { name: /create configuration/i }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('POSTs and routes to the new id on a valid audit create', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ template: { template_id: 'new-1' } }),
    } as Response);
    render(<TemplateWizard />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'my-tmpl');
    await userEvent.click(
      screen.getByRole('button', { name: /create configuration/i }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/sonar/templates',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(push).toHaveBeenCalledWith('/account/sonar/templates/new-1');
  });
});
