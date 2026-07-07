import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentsPanel } from '../agents-panel';
import type { MockAgent } from '@/lib/mock-types';

/**
 * The agents page no longer fabricates demo agents or issues fake credentials.
 * With no agents it shows an empty state whose only action routes the user to
 * the real setup path (Agent Software → configuration guide), which is where
 * they obtain their agent keys.
 */
describe('AgentsPanel', () => {
  it('shows an empty state when there are no agents', () => {
    render(<AgentsPanel agents={[]} />);
    expect(screen.getByText('No agents provisioned yet')).toBeInTheDocument();
  });

  it('links the empty state to the Agent Software page (the path to get keys)', () => {
    render(<AgentsPanel agents={[]} />);
    const link = screen.getByRole('link', { name: /configuration guide/i });
    expect(link).toHaveAttribute('href', '/account/agent-software');
  });

  it('defaults to the empty state when no agents prop is passed', () => {
    render(<AgentsPanel />);
    expect(screen.getByText('No agents provisioned yet')).toBeInTheDocument();
  });

  it('renders a read-only row per agent when agents are provided', () => {
    const agents: MockAgent[] = [
      {
        id: 'a-1234',
        status: 'active',
        types: [],
        last_heartbeat: '',
        consecutive_failures: 0,
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ];
    render(<AgentsPanel agents={agents} />);
    expect(screen.queryByText('No agents provisioned yet')).not.toBeInTheDocument();
    expect(screen.getByText(/a-1234/)).toBeInTheDocument();
  });
});
