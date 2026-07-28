'use client';
import { DefinitionTip } from './definition-tip';
import { definitionFor } from './pill';

// Table column header carrying an optional definition tooltip. Replaces the
// former practice of using <Pill> as a <th> — pills read as status chrome
// rather than table structure. Renders the complete <th>: callers swap their
// entire <th>…</th> for this component.

interface ColumnHeaderProps {
  label: string;
  /** Resolves copy from the shared definition map alongside `value`. */
  category?: string;
  value?: string;
  /** Extra classes on the <th> (e.g. text-center). */
  className?: string;
}

export function ColumnHeader({ label, category, value, className = '' }: ColumnHeaderProps) {
  const resolved = category && value ? definitionFor(category, value) : undefined;

  return (
    <th className={`px-3 py-2 font-semibold ${className}`.trim()}>
      {resolved ? (
        <DefinitionTip
          body={resolved}
          testId="column-header-tip"
          className="relative inline-flex cursor-help items-center gap-0.5"
        >
          {label}
          <span aria-hidden className="text-[9px] leading-none text-slate-400">
            &#9432;
          </span>
        </DefinitionTip>
      ) : (
        label
      )}
    </th>
  );
}
