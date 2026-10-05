// src/components/help/help-context.ts
'use client';

export type HelpSummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; summary: string; contact: string }
  | { status: 'failed' };
