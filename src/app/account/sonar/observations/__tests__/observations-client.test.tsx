import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObservationsClient } from '../_components/observations-client';

describe('ObservationsClient (Phantom Demand placeholder)', () => {
  it('shows empty state when both runs and templates are empty', () => {
    render(<ObservationsClient initialRuns={[]} initialTemplates={[]} />);
    expect(screen.getByText(/create your first phantom demand probe/i)).toBeInTheDocument();
  });

  it('renders a run row when runs exist', () => {
    const runs = [
      { id: 'r1', scope_summary: 'Probe SKU vs Acme', status: 'completed', hops_consumed: 5 },
    ];
    render(<ObservationsClient initialRuns={runs} initialTemplates={[]} />);
    expect(screen.getByText(/Probe SKU vs Acme/i)).toBeInTheDocument();
  });

  it('renders a template row when templates exist', () => {
    const templates = [
      {
        template_id: 't1',
        template_name: 'Weekly probe',
        observation_class: 'phantom_demand' as const,
        cadence: { kind: 'weekly' },
        enabled: true,
      },
    ];
    render(<ObservationsClient initialRuns={[]} initialTemplates={templates} />);
    expect(screen.getByText(/Weekly probe/i)).toBeInTheDocument();
  });

  it('Add CTA points at the Phantom Demand template wizard', () => {
    render(<ObservationsClient initialRuns={[]} initialTemplates={[]} />);
    const links = screen.getAllByRole('link');
    expect(
      links.some((a) => a.getAttribute('href') === '/account/sonar/templates/new?observation_class=phantom_demand'),
    ).toBe(true);
  });
});
