'use client';

import { useEffect, useRef } from 'react';

export type TristateState = 'none' | 'partial' | 'all';

interface Props {
  state: TristateState;
  onChange: (next: 'all' | 'none') => void;
  ariaLabel: string;
}

/**
 * Native checkbox with the indeterminate ref dance — used by any
 * GroupedAccordion picker consumer (e.g. the audit wizard's per-counterparty
 * and per-class parent checkboxes). Click toggles between 'all' and 'none';
 * 'partial' is a visual state derived from children, not directly settable.
 */
export function TristateCheckbox({ state, onChange, ariaLabel }: Props) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'partial';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      checked={state === 'all'}
      onChange={() => onChange(state === 'all' ? 'none' : 'all')}
    />
  );
}
