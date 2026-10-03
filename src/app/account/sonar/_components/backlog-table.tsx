import type { ReactNode } from 'react';

export interface BacklogColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  nowrap?: boolean;
}

/**
 * The two backlogs' table, in DataTable's markup (ruling C-11): DataTable's header text, slate on its grey, is 4.15:1, short of
 * the 4.5:1 axe requires; charcoal on the same grey clears it. data-table.tsx is not edited in this lane.
 */
export function BacklogTable<T>({ columns, data, keyFn, emptyMessage }: {
  columns: BacklogColumn<T>[];
  data: T[];
  keyFn: (row: T) => string;
  emptyMessage: string;
}) {
  const cell = (c: BacklogColumn<T>) => `${c.align === 'right' ? 'text-right' : 'text-left'} ${c.nowrap ? 'whitespace-nowrap' : ''}`;
  return (
    <div className="overflow-x-auto rounded border border-slate/15 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-light-gray">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`${cell(c)} text-xs font-medium uppercase tracking-wider text-charcoal py-2.5 px-4`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 px-4 text-center text-sm text-slate">{emptyMessage}</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={keyFn(row)} className={`${i > 0 ? 'border-t border-slate/10' : ''} hover:bg-light-gray/50`}>
                {columns.map((c) => (
                  <td key={c.key} className={`${cell(c)} py-2.5 px-4`}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
