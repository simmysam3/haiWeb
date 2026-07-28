import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DefinitionTip } from '../definition-tip';
import { definitionFor } from '../pill';

describe('definitionFor', () => {
  it('resolves copy from the embedded map', () => {
    expect(definitionFor('lead_time_col', 'published')).toContain('officially listed');
  });

  it('returns undefined for an unknown category or value', () => {
    expect(definitionFor('lead_time_col', 'nope')).toBeUndefined();
    expect(definitionFor('nope', 'published')).toBeUndefined();
  });
});

describe('<DefinitionTip>', () => {
  it('exposes the body via aria-describedby without rendering a visible tooltip', () => {
    render(
      <DefinitionTip body="Some definition." testId="tip">
        Label
      </DefinitionTip>,
    );

    const host = screen.getByTestId('tip');
    const describedby = host.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby as string)).toHaveTextContent('Some definition.');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip on focus and hides it on Escape', async () => {
    const user = userEvent.setup();
    render(
      <DefinitionTip body="Some definition." testId="tip">
        Label
      </DefinitionTip>,
    );

    await user.tab();
    expect(screen.getByTestId('tip')).toHaveFocus();
    expect(screen.getByRole('tooltip')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders no tooltip machinery when body is empty', () => {
    render(
      <DefinitionTip body="" testId="tip">
        Label
      </DefinitionTip>,
    );

    expect(screen.getByTestId('tip')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByText('Label')).toBeInTheDocument();
  });
});
