import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('respects defaultObservationClass="watcher" by hiding audit-specific fields', () => {
    render(<TemplateForm defaultObservationClass="watcher" />);
    // Watcher scope picker shows signal-type checkboxes
    expect(screen.getByLabelText(/lead time distribution/i)).toBeInTheDocument();
  });

  it('allows selecting Phantom Demand modality', async () => {
    render(<TemplateForm />);
    const select = screen.getByLabelText('Modality');
    fireEvent.change(select, { target: { value: 'phantom_demand' } });
    expect(screen.getByText(/Counterparty/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hypothetical Quantity/)).toBeInTheDocument();
  });
});
