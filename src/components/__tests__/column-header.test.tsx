import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ColumnHeader } from '../column-header';

function renderHeader(ui: React.ReactNode) {
  return render(
    <table>
      <thead>
        <tr>{ui}</tr>
      </thead>
    </table>,
  );
}

describe('<ColumnHeader>', () => {
  it('renders a th element, not a nested span inside a caller th', () => {
    renderHeader(<ColumnHeader label="Run date" />);

    const cell = screen.getByText('Run date').closest('th');
    expect(cell).toBeInTheDocument();
  });

  it('renders no definition affordance when no definition resolves', () => {
    renderHeader(<ColumnHeader label="Run date" />);

    expect(screen.getByText('Run date')).toBeInTheDocument();
    expect(screen.queryByTestId('column-header-tip')).not.toBeInTheDocument();
  });

  it('resolves definition copy from category and value', () => {
    renderHeader(<ColumnHeader label="Published" category="lead_time_col" value="published" />);

    const tip = screen.getByTestId('column-header-tip');
    const describedby = tip.getAttribute('aria-describedby');
    expect(document.getElementById(describedby as string)).toHaveTextContent('officially listed');
  });

  it('is not a pill', () => {
    renderHeader(<ColumnHeader label="Published" category="lead_time_col" value="published" />);

    expect(screen.queryByTestId('pill')).not.toBeInTheDocument();
    expect(screen.getByTestId('column-header-tip').className).not.toContain('rounded-full');
  });
});
