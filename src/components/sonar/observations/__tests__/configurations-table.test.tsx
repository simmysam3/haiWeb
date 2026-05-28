import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ColumnPack } from '../column-pack';
import { ConfigurationsTable } from '../configurations-table';

interface FakeRow {
  id: string;
  name: string;
  status: 'enabled' | 'disabled';
}

const fakeColumns: ColumnPack<FakeRow> = {
  columns: [
    { key: 'name', label: 'Name', render: (r) => r.name },
    { key: 'status', label: 'Status', render: (r) => r.status },
  ],
};

describe('<ConfigurationsTable>', () => {
  it('renders an empty state when rows is empty', () => {
    render(
      <ConfigurationsTable<FakeRow>
        rows={[]}
        columns={fakeColumns}
        keyFn={(r) => r.id}
        emptyMessage="No configs."
      />,
    );
    expect(screen.getByText('No configs.')).toBeInTheDocument();
  });

  it('renders one row per item with the column pack cells', () => {
    const rows: FakeRow[] = [
      { id: '1', name: 'First', status: 'enabled' },
      { id: '2', name: 'Second', status: 'disabled' },
    ];
    render(
      <ConfigurationsTable<FakeRow>
        rows={rows}
        columns={fakeColumns}
        keyFn={(r) => r.id}
        emptyMessage="empty"
      />,
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('disabled')).toBeInTheDocument();
  });

  it('renders column headers from the column pack', () => {
    const rows: FakeRow[] = [{ id: '1', name: 'First', status: 'enabled' }];
    render(
      <ConfigurationsTable<FakeRow>
        rows={rows}
        columns={fakeColumns}
        keyFn={(r) => r.id}
        emptyMessage="empty"
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
  });
});
