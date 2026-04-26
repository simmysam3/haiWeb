'use client';

import { useState } from 'react';

export function IdChip({
  id,
  chars = 6,
  className = '',
}: {
  id: string;
  chars?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!id) return null;

  const isShort = id.length <= chars;
  const display = expanded || isShort ? id : `${id.slice(0, chars)}…`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isShort) setExpanded((v) => !v);
      }}
      title={expanded ? 'Click to collapse' : id}
      className={`font-mono text-xs text-slate hover:text-navy transition-colors cursor-pointer ${className}`}
    >
      {display}
    </button>
  );
}
