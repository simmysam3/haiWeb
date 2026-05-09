import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateForm } from '../template-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('TemplateForm — create mode', () => {
  it('POSTs with the name + scope when "Create template" is clicked', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ template: { template_id: 'new' } }),
    } as Response);
    render(<TemplateForm />);
    await userEvent.type(screen.getByLabelText(/template name/i), 'my-tmpl');
    await userEvent.click(screen.getByRole('button', { name: /create template/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/sonar/templates',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('my-tmpl'),
      }),
    );
  });

  it('respects defaultObservationClass="type2" by hiding audit-specific fields', () => {
    render(<TemplateForm defaultObservationClass="type2" />);
    // Type 2 scope picker shows signal-type checkboxes
    expect(screen.getByLabelText(/lead time distribution/i)).toBeInTheDocument();
  });
});
