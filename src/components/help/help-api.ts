// src/components/help/help-api.ts
'use client';

import { HelpCaseSummaryResponseSchema, type HelpCaseSummaryResponse, type HelpFeedbackRequest } from '@haiwave/protocol';

/** Best effort: feedback failures are not surfaced (the rating is already shown locally). */
export async function sendHelpFeedback(serverMessageId: string, body: HelpFeedbackRequest): Promise<boolean> {
  try {
    const res = await fetch(`/api/help/messages/${encodeURIComponent(serverMessageId)}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function requestCaseSummary(conversationId: string): Promise<HelpCaseSummaryResponse | null> {
  try {
    const res = await fetch(`/api/help/conversations/${encodeURIComponent(conversationId)}/case-summary`, { method: 'POST' });
    if (!res.ok) return null;
    const parsed = HelpCaseSummaryResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
