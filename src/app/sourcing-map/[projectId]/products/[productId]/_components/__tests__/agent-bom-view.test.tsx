import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vomeroAgentDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import { AgentBomView } from '../agent-bom-view';

describe('AgentBomView', () => {
  it('shows the linked SKU, "Read fresh at each run", when it was last fetched, and read-only lines', () => {
    render(<AgentBomView detail={vomeroAgentDetail} />);
    expect(screen.getByText('Linked to your agent · METCON-CROSS-IRON')).toBeInTheDocument();
    expect(screen.getByText('Read fresh at each run')).toBeInTheDocument();
    expect(screen.getByText('Last fetched Sep 22, 2026')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Upper leather, tumbled/ })).toHaveTextContent('Full grain leather hides');
    expect(screen.getByRole('row', { name: /Flat lace 137 cm/ })).toHaveTextContent('Unclassified');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows the unreachable state when the live read returned nothing (a-G9), never an empty BOM', () => {
    render(<AgentBomView detail={{ ...vomeroAgentDetail, lines: [], lines_fetched_at: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Your agent did not answer, so its BOM can't be shown. Runs still read it fresh; while the agent is down the product is marked 'BOM unavailable from agent'.",
    );
    expect(screen.queryByRole('table')).toBeNull();
  });
});
