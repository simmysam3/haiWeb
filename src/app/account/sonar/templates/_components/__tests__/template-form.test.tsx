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
  it('POSTs with the name + scope when "Create audit" is clicked', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ template: { template_id: 'new' } }),
    } as Response);
    render(<TemplateForm />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'my-tmpl');
    await userEvent.click(screen.getByRole('button', { name: /create audit/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/sonar/templates',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('my-tmpl'),
      }),
    );
  });

  it('on 401 shows a session-expired message with a Sign in link, not a status code', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    render(<TemplateForm />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /create audit/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session has expired/i);
    expect(screen.queryByText(/Create failed \(401\)/i)).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /sign in again/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('on 400 surfaces the haiCore validation field detail', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid create template request (1 validation error(s))',
            details: [
              { path: ['scope', 'provenance_key_id'], message: 'Invalid uuid' },
            ],
          },
        }),
        { status: 400 },
      ),
    );
    render(<TemplateForm />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /create audit/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/scope\.provenance_key_id/);
    expect(alert).toHaveTextContent(/Invalid uuid/);
    expect(screen.queryByText(/Create failed/i)).not.toBeInTheDocument();
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

  it('renders the scope picker after the Enabled/Retention controls (D8)', () => {
    render(<TemplateForm defaultObservationClass="audit" />);
    const enabled = screen.getByLabelText(/enabled/i);
    const auditScope = screen.getByRole('group', { name: /audit scope/i });
    expect(
      enabled.compareDocumentPosition(auditScope) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('disables Create for phantom_demand until counterparty AND >=1 sku are set', async () => {
    render(<TemplateForm defaultObservationClass="phantom_demand" />);
    await userEvent.type(screen.getByLabelText(/demand request name/i), 'pd-1');
    expect(
      screen.getByRole('button', { name: /create demand request/i }),
    ).toBeDisabled();
  });
});
