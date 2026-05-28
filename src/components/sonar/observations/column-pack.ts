import type { ReactNode } from 'react';

export interface ColumnDef<T> {
  /**
   * Stable key — used as React key on the header cell and as the column id
   * in tests. Must be unique within a column pack.
   */
  key: string;
  /**
   * Header text shown in the table head. Empty string for cells with no
   * header (e.g. the trailing "Actions" column whose action is self-evident).
   */
  label: string;
  /** Cell renderer. Returns a ReactNode. */
  render: (row: T) => ReactNode;
  /** Optional alignment for the header + cells. Defaults to 'left'. */
  align?: 'left' | 'right' | 'center';
  /** Optional title shown as tooltip on the header. */
  headerTitle?: string;
  /**
   * Optional column width (e.g. "26%", "120px") for the table's `<colgroup>`.
   * Set on every column to keep alignment between sibling tables (configurations
   * + run history) that share a layout. If any column in a pack sets `width`,
   * the table renders a `<colgroup>` populated from these values.
   */
  width?: string;
}

export interface ColumnPack<T> {
  columns: ColumnDef<T>[];
}
