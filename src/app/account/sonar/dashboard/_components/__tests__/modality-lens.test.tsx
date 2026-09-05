import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalityLens } from '../modality-lens';

describe('ModalityLens — a lane that did not answer (SEC-web-sonar-4-04)', () => {
  it('renders the unavailable state, never the "no runs yet" onboarding copy, when partners is null', () => {
    render(<ModalityLens partners={null} />);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/No runs yet/i)).not.toBeInTheDocument();
  });
});
