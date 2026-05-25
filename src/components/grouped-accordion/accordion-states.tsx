'use client';

import type { ReactNode } from 'react';

/**
 * Inline state stubs for the accordion body — rendered inside an
 * AccordionGroupRow when loading / error / empty.
 */

export function AccordionLoading({ children = 'Loading…' }: { children?: ReactNode }) {
  return <p className="text-xs italic text-slate py-1">{children}</p>;
}

export function AccordionError({ children }: { children: ReactNode }) {
  return <p className="text-xs text-problem py-1">{children}</p>;
}

export function AccordionEmpty({ children }: { children: ReactNode }) {
  return <p className="text-xs italic text-slate py-1">{children}</p>;
}
