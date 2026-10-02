'use client';
import { createContext, useContext, type ReactNode } from 'react';

const OpenRisksContext = createContext<number | null>(null);

/** The open supply-risk count, read once by the gated layout; null when unread. */
export function OpenRisksProvider({ count, children }: { count: number | null; children: ReactNode }) {
  return <OpenRisksContext.Provider value={count}>{children}</OpenRisksContext.Provider>;
}

export function useOpenRisks(): number | null {
  return useContext(OpenRisksContext);
}
