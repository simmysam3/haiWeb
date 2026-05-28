import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  // v.1.45: the wizard is phantom-demand-only. Watchers are created via the
  // dedicated /watchers/new wizard, so there is no Modality selector here and
  // the form opens directly on phantom_demand (Demand Request) fields.
  it('renders no Modality selector and defaults to phantom_demand', () => {
    render(<TemplateWizard />);
    expect(screen.queryByLabelText(/modality/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /watcher/i })).not.toBeInTheDocument();
    // PD name + scope fields are present; watcher fields are not.
    expect(screen.getByLabelText(/demand request name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default quantity/i)).toBeInTheDocument();
    expect(screen.queryByText(/signal types/i)).not.toBeInTheDocument();
  });

  it('blocks Create for an incomplete phantom_demand scope (empty SKU) and does not POST', async () => {
    render(<TemplateWizard />);
    await userEvent.type(screen.getByLabelText(/demand request name/i), 'pd-tmpl');
    await userEvent.click(
      screen.getByRole('button', { name: /create configuration/i }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/account/sonar/templates',
      expect.anything(),
    );
    // v.1.44 refined-PD: error message reflects the new required field.
    expect(
      screen.getByText(/phantom demand requires a sku/i),
    ).toBeInTheDocument();
  });
});

describe('phantom_demand_bom scope emission (v1.44)', () => {
  // The SkuAutocomplete only calls onChange when a dropdown hit is clicked.
  // With the stub fetcher (returns []), no hits appear, so the sku field stays
  // empty after typing and the wizard's pdIncomplete guard fires.

  it('initial emptyScope for phantom_demand is phantom_demand_bom (not legacy shape)', () => {
    render(<TemplateWizard />);
    expect(screen.getByLabelText(/default quantity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default target date/i)).toBeInTheDocument();
    expect(screen.queryByText(/^counterparty$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hypothetical quantity/i)).not.toBeInTheDocument();
  });

  it('default_qty and default_target_date fields emit phantom_demand_bom shape; empty sku still blocks POST', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ template: { template_id: 'pd-bom-1' } }),
    } as Response);
    render(<TemplateWizard />);
    await userEvent.type(screen.getByLabelText(/demand request name/i), 'bom-tmpl');
    fireEvent.change(screen.getByLabelText(/default quantity/i), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByLabelText(/default target date/i), {
      target: { value: '2026-06-15' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: /create configuration/i }),
    );
    // sku is empty → pdIncomplete fires; fetch was NOT called.
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/account/sonar/templates',
      expect.anything(),
    );
    expect(screen.getByText(/phantom demand requires a sku/i)).toBeInTheDocument();
  });
});
