import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable, type Column } from '../data-table';
import { groundToken, ratioOn } from '@/test/contrast';

interface Row {
  id: string;
  name: string;
  qty: number;
}

const columns: Column<Row>[] = [
  { key: 'name', label: 'Name', render: (r) => r.name },
  { key: 'qty', label: 'Qty', render: (r) => r.qty, align: 'right', nowrap: true },
];

describe('DataTable header', () => {
  it('every header cell clears 4.5:1 on the header grey (WCAG 1.4.3; was slate, 4.16:1)', () => {
    render(<DataTable columns={columns} data={[{ id: 'a', name: 'Alpha', qty: 1 }]} keyFn={(r) => r.id} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    for (const th of headers) {
      expect(groundToken(th)).toBe('light-gray');
      expect(ratioOn(th)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
