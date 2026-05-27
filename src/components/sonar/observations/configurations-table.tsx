import type { ColumnPack } from './column-pack';

interface Props<T> {
  rows: T[];
  columns: ColumnPack<T>;
  /** Stable row key extractor (typically the row's primary id). */
  keyFn: (row: T) => string;
  /** Rendered in italic slate when `rows` is empty. */
  emptyMessage: string;
}

export function ConfigurationsTable<T>({
  rows,
  columns,
  keyFn,
  emptyMessage,
}: Props<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate italic">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
            {columns.columns.map((c) => (
              <th
                key={c.key}
                className="py-2 pr-3"
                style={{ textAlign: c.align ?? 'left' }}
                title={c.headerTitle}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyFn(row)}
              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            >
              {columns.columns.map((c) => (
                <td
                  key={c.key}
                  className="py-2 pr-3"
                  style={{ textAlign: c.align ?? 'left' }}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
