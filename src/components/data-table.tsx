"use client";

import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  nowrap?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string;
  emptyMessage?: ReactNode;
  toolbar?: ReactNode;
}

function alignClass(align?: "left" | "right" | "center"): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<T>({
  columns,
  data,
  keyFn,
  emptyMessage = "No data",
  toolbar,
}: DataTableProps<T>) {
  const empty = data.length === 0;

  return (
    <div>
      {toolbar && (
        <div className="flex items-center justify-end mb-2">{toolbar}</div>
      )}
      <div className="overflow-x-auto rounded border border-slate/15">
        <table className="w-full text-sm">
          <thead className="bg-light-gray">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${alignClass(col.align)} text-xs font-medium uppercase tracking-wider text-slate py-2.5 px-4 ${col.nowrap ? "whitespace-nowrap" : ""} ${col.className || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 px-4 text-center text-sm text-slate"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={keyFn(row)}
                  className={`${i > 0 ? "border-t border-slate/10" : ""} hover:bg-light-gray/50`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${alignClass(col.align)} py-2.5 px-4 ${col.nowrap ? "whitespace-nowrap" : ""} ${col.className || ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
