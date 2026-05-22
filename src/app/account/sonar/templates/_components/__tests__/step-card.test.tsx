import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepCard } from '../../../_components/step-card';

describe('StepCard', () => {
  it('renders the title, number badge, and children', () => {
    render(
      <StepCard id="x" index={0} title="Identity">
        <p>body</p>
      </StepCard>,
    );
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('locked variant shows a lock glyph instead of the number', () => {
    render(
      <StepCard id="x" index={1} title="Scope" locked>
        <p>scope</p>
      </StepCard>,
    );
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
  });

  it('exposes a scroll anchor with the step id', () => {
    const { container } = render(
      <StepCard id="schedule" index={2} title="Schedule">
        <p>x</p>
      </StepCard>,
    );
    expect(container.querySelector('#step-schedule')).not.toBeNull();
  });

  it('dim variant applies reduced opacity', () => {
    const { container } = render(
      <StepCard id="x" index={0} title="Identity" dim>
        <p>body</p>
      </StepCard>,
    );
    expect(container.querySelector('section')?.className).toContain('opacity-50');
  });
});
