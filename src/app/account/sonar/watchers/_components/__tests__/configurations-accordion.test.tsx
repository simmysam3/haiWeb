import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ConfigurationsAccordion } from '../configurations-accordion';

describe('<ConfigurationsAccordion>', () => {
  it('starts collapsed: summary visible, children hidden', () => {
    render(
      <ConfigurationsAccordion count={4} scheduledCount={2}>
        <table data-testid="configs-table" />
      </ConfigurationsAccordion>,
    );
    expect(
      screen.getByRole('button', { name: /configurations/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('4 configurations · 2 scheduled')).toBeInTheDocument();
    expect(screen.queryByTestId('configs-table')).not.toBeInTheDocument();
  });

  it('expands on click to reveal children, collapses on second click', async () => {
    const user = userEvent.setup();
    render(
      <ConfigurationsAccordion count={4} scheduledCount={2}>
        <table data-testid="configs-table" />
      </ConfigurationsAccordion>,
    );
    const trigger = screen.getByRole('button', { name: /configurations/i });

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('configs-table')).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('configs-table')).not.toBeInTheDocument();
  });

  it('uses singular/zero-aware summary copy', () => {
    const { rerender } = render(
      <ConfigurationsAccordion count={1} scheduledCount={0}>
        <div />
      </ConfigurationsAccordion>,
    );
    expect(screen.getByText('1 configuration · 0 scheduled')).toBeInTheDocument();

    rerender(
      <ConfigurationsAccordion count={0} scheduledCount={0}>
        <div />
      </ConfigurationsAccordion>,
    );
    expect(screen.getByText('0 configurations · 0 scheduled')).toBeInTheDocument();
  });
});
