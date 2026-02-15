"use client";

import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, keyFn, emptyMessage = "No data" }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate/15">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4 ${col.className || ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={keyFn(row)} className="border-b border-slate/10 hover:bg-light-gray/50">
              {columns.map((col) => (
                <td key={col.key} className={`py-3 px-4 ${col.className || ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
