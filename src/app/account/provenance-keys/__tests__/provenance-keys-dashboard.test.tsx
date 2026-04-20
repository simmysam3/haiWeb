import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProvenanceKeysDashboard } from '../provenance-keys-dashboard';

const EMPTY_PAYLOAD = {
  generated: [],
  installations: [],
  sharingPolicy: { shared_fields: [] },
  aggregateCounts: {
    generatorActiveCompliant: 0,
    generatorActiveGracePending: 0,
    generatorActiveNonCompliant: 0,
    installerGracePending: 0,
    installerNonCompliant: 0,
  },
};

describe('ProvenanceKeysDashboard', () => {
  it('renders Generator and Installer tabs', () => {
    render(<ProvenanceKeysDashboard initial={EMPTY_PAYLOAD} />);
    expect(screen.getByRole('button', { name: /generator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /installer/i })).toBeInTheDocument();
  });

  it('switches to Installer tab when clicked', async () => {
    render(<ProvenanceKeysDashboard initial={EMPTY_PAYLOAD} />);
    await userEvent.click(screen.getByRole('button', { name: /installer/i }));
    expect(screen.getByText(/no installations/i)).toBeInTheDocument();
  });

  it('shows empty-state copy on Generator tab by default', () => {
    render(<ProvenanceKeysDashboard initial={EMPTY_PAYLOAD} />);
    expect(screen.getByText(/no keys yet/i)).toBeInTheDocument();
  });
});
