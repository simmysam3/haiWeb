// src/components/help/help-context.ts
'use client';

import { createContext, useContext } from 'react';
import type { HelpLanguage } from '@haiwave/protocol';
import type { HelpUiMessage } from './help-storage';
import type { HelpState } from './help-state';

export const HELP_PANEL_ID = 'hw-help-panel';

export type HelpSummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; summary: string; contact: string }
  | { status: 'failed' };

export interface HelpContextValue {
  state: HelpState;
  language: HelpLanguage;
  streaming: boolean;
  /** The last finished answer, for the aria-live region (announced once, not per token). */
  announcement: string;
  summary: HelpSummaryState;
  setLanguage(lang: HelpLanguage): void;
  toggle(): void;
  minimize(): void;
  close(): void;
  reset(): void;
  send(text: string): void;
  stop(): void;
  retry(assistantId: string): void;
  feedback(message: HelpUiMessage, rating: 'up' | 'down', note?: string): void;
  summarize(): void;
}

export const HelpContext = createContext<HelpContextValue | null>(null);

export function useHelp(): HelpContextValue | null {
  return useContext(HelpContext);
}
